"""Owned worker lifecycle: real HTTP read interruption and no startup polling."""

from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
import json
import os
from pathlib import Path
import signal
import sqlite3
import subprocess
import sys
import threading
import time

import pytest

from app.services.nms_cache import NMSCache
from app.services.nms_worker import configuration, run


def test_environment_must_be_explicit_and_default_data_path_is_valid(monkeypatch, tmp_path):
    monkeypatch.delenv("FAA_NMS_ENVIRONMENT", raising=False)
    with pytest.raises(ValueError, match="Explicit"):
        configuration()
    monkeypatch.setenv("FAA_NMS_ENVIRONMENT", "staging")
    monkeypatch.setenv("FAA_NMS_CLIENT_ID", "fixture-client")
    monkeypatch.setenv("FAA_NMS_CLIENT_SECRET", "fixture-secret")
    monkeypatch.delenv("FAA_NMS_CACHE_DIR", raising=False)
    monkeypatch.setenv("DATA_DIR", str(tmp_path))
    environment, key, secret, root = configuration()
    assert environment == "staging" and key == "fixture-client" and secret == "fixture-secret"
    assert Path(root) == tmp_path / "nms" / "staging"


def test_once_with_reserved_cadence_does_not_contact_provider_and_restores_signals(
    tmp_path, capsys, monkeypatch
):
    now = [1000.0]
    cache = NMSCache(tmp_path, "production", clock=lambda: now[0])
    ticket = cache.reserve()
    cache.finish(ticket, [])

    class Client:
        environment = "production"
        closed = False

        def features(self, *args, **kwargs):
            pytest.fail("reserved cadence must not contact FAA")

        def close(self):
            self.closed = True

    monkeypatch.setattr(
        cache,
        "query",
        lambda *a, **kw: pytest.fail("worker must not scan the NOTAM collection while idle"),
    )
    c = Client()
    previous = signal.getsignal(signal.SIGTERM)
    assert run(cache, c, once=True) == 0 and c.closed
    assert signal.getsignal(signal.SIGTERM) == previous
    assert "nms_worker_stopped" in capsys.readouterr().out


@pytest.mark.skipif(sys.platform == "win32", reason="POSIX SIGTERM lifecycle qualification")
def test_sigterm_interrupts_real_http_read_releases_lease_and_stops_cleanly(tmp_path):
    entered, release = threading.Event(), threading.Event()

    class Handler(BaseHTTPRequestHandler):
        def log_message(self, *args):
            pass

        def do_POST(self):
            body = json.dumps({"access_token": "fixture-bearer", "expires_in": 1799}).encode()
            self.send_response(200)
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)

        def do_GET(self):
            self.send_response(200)
            self.end_headers()
            self.wfile.write(b'{"status":')
            self.wfile.flush()
            entered.set()
            release.wait(15)
            try:
                self.wfile.write(b'"Success","data":{"geojson":[]}}')
            except (BrokenPipeError, ConnectionResetError):
                pass

    server = ThreadingHTTPServer(("127.0.0.1", 0), Handler)
    serving = threading.Thread(target=server.serve_forever, daemon=True)
    serving.start()
    script = tmp_path / "worker.py"
    script.write_text("""import sys
from app.services.nms_client import NMSClient
from app.services.nms_cache import NMSCache
from app.services.nms_worker import run
c=NMSClient('staging','fixture-client','fixture-secret')
c.origin=sys.argv[2]
raise SystemExit(run(NMSCache(sys.argv[1],'staging'),c))
""")
    env = dict(os.environ)
    env["PYTHONPATH"] = os.pathsep.join(sys.path)
    process = subprocess.Popen(
        [
            sys.executable,
            str(script),
            str(tmp_path / "cache"),
            f"http://127.0.0.1:{server.server_port}",
        ],
        env=env,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        text=True,
    )
    try:
        assert entered.wait(10), "worker never reached the owned HTTP fixture"
        before = time.monotonic()
        process.terminate()
        stdout, stderr = process.communicate(timeout=5)
        assert process.returncode == 0, stderr
        assert time.monotonic() - before < 5
        assert "nms_worker_stopped" in stdout
        with sqlite3.connect(tmp_path / "cache" / "notams.sqlite3") as db:
            state = json.loads(db.execute("select value from state").fetchone()[0])
        assert state["owner"] is None and state["watermark"] is None
        assert state["attempted"] == ["DOMESTIC"] and state["completed"] == []
    finally:
        release.set()
        if process.poll() is None:
            process.kill()
            process.communicate(timeout=5)
        server.shutdown()
        server.server_close()
        serving.join(timeout=5)
