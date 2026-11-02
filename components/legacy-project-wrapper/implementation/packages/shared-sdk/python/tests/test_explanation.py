"""Real RPC to the common broker; only SDK-owned fixtures, never live models."""
import json
import os
from pathlib import Path
from queue import Queue, Empty
import shutil
import subprocess
import time
from threading import Thread
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

import pytest

from aviation.e2e import sign_e2e_headers, tag_test_record
from aviation.explanation import ExplanationProxy, create_explanation_blueprint, create_explanation_router

APP = "flight-planner"
RUN = "e2e_" + "a" * 32
OTHER = "e2e_" + "b" * 32
SECRET = "synthetic-python-rpc-secret-32-characters-long"
ENTRY = Path(__file__).resolve().parents[3] / "ai-explainer/dist/run.js"


@pytest.fixture
def actor():
    assert ENTRY.is_file(), "Build the common ai-explainer before Python RPC tests"
    node = shutil.which("node")
    assert node
    process = subprocess.Popen([node, str(ENTRY), "--app", APP], stdout=subprocess.PIPE,
                               stderr=subprocess.PIPE, text=True, env={
        "PATH": os.path.dirname(node) + os.pathsep + os.defpath,
        "NODE_ENV": "test", "AVIATION_E2E_RUN_ID": RUN, "AVIATION_E2E_SECRET": SECRET,
    })
    lines = Queue()

    def read():
        for line in process.stdout:
            lines.put(line)

    reader = Thread(target=read, daemon=True)
    reader.start()
    try:
        try:
            ready = json.loads(lines.get(timeout=10))
        except (Empty, ValueError):
            raise AssertionError("Explanation broker did not become ready") from None
        assert ready["schema"] == "aviation/explanation-broker-ready@1"
        yield {"AVIATION_EXPLAIN_BROKER_URL": ready["url"], "AVIATION_E2E_RUN_ID": RUN,
               "AVIATION_E2E_SECRET": SECRET}
    finally:
        process.terminate()
        try:
            process.wait(timeout=5)
        except subprocess.TimeoutExpired:
            process.kill()
            process.wait(timeout=5)
        reader.join(timeout=1)
        process.stdout.close()
        process.stderr.close()


def headers(run=RUN, app=APP):
    return sign_e2e_headers(app, run, SECRET, int(time.time() * 1000))


def seed(proxy):
    response = proxy.forward("POST", "/api/explain/__e2e/fixtures",
        json.dumps({"fixture_type": "explanation", "record": tag_test_record(RUN, {"app_id": APP})}).encode(),
        {**headers(), "Content-Type": "application/json"})
    assert response.status == 200


def test_direct_proxy_submits_reads_and_cleans_actual_sdk_state(actor):
    proxy = ExplanationProxy(APP, environment=actor)
    assert proxy.forward("GET", "/api/explain/config").status == 403
    assert proxy.forward("GET", "/api/explain/config", headers=headers(OTHER)).status == 403
    seed(proxy)
    response = proxy.forward("POST", "/api/explain", json.dumps({"context": "Synthetic route facts"}).encode(),
                             {**headers(), "Content-Type": "application/json"})
    assert response.status == 202
    ticket = json.loads(response.body)
    read = proxy.forward("GET", "/api/explain/requests/" + ticket["requestId"],
                         headers={**headers(), "X-Aviation-Explain-Token": ticket["accessToken"]})
    assert read.status == 200
    assert "SDK fixture explanation." in json.loads(read.body)["explanation"]
    cleaned = proxy.forward("DELETE", "/api/explain/__e2e/runs/" + RUN, headers=headers())
    assert cleaned.status == 200 and json.loads(cleaned.body)["count"] == 0


def test_flask_workers_share_the_broker_instead_of_local_pending_state(actor):
    from flask import Flask
    proxy = ExplanationProxy(APP, environment=actor)
    seed(proxy)
    workers = []
    for index in range(2):
        app = Flask("worker" + str(index))
        app.register_blueprint(create_explanation_blueprint(APP, environment=actor))
        workers.append(app.test_client())
    submitted = workers[0].post("/api/explain", json={"context": "Synthetic heading correction"}, headers=headers())
    assert submitted.status_code == 202
    ticket = submitted.get_json()
    completed = workers[1].get("/api/explain/requests/" + ticket["requestId"],
                              headers={**headers(), "X-Aviation-Explain-Token": ticket["accessToken"]})
    assert completed.status_code == 200 and completed.get_json()["status"] == "completed"
    removed = workers[1].delete("/api/explain/requests/" + ticket["requestId"],
                               headers={**headers(), "X-Aviation-Explain-Token": ticket["accessToken"]})
    assert removed.status_code == 200
    assert json.loads(proxy.forward("DELETE", "/api/explain/__e2e/runs/" + RUN, headers=headers()).body)["count"] == 0


def test_fastapi_binding_exposes_the_same_queued_contract(actor):
    from fastapi import FastAPI
    from fastapi.testclient import TestClient
    app = FastAPI()
    app.include_router(create_explanation_router(APP, environment=actor))
    schema = app.openapi()
    operations = [operation for path in schema["paths"].values() for operation in path.values()]
    assert len({operation["operationId"] for operation in operations}) == len(operations)
    assert "202" in schema["paths"]["/api/explain"]["post"]["responses"]
    for path, name in [("/api/explain/requests/{request_id}", "request_id"),
                       ("/api/explain/__e2e/runs/{run_id}", "run_id")]:
        for operation in schema["paths"][path].values():
            assert any(parameter["in"] == "path" and parameter["name"] == name
                       for parameter in operation["parameters"])
    with TestClient(app) as client:
        seeded = client.post("/api/explain/__e2e/fixtures", json={"fixture_type": "explanation",
            "record": tag_test_record(RUN, {"app_id": APP})}, headers=headers())
        assert seeded.status_code == 200
        response = client.post("/api/explain", json={"context": "Synthetic route facts"}, headers=headers())
        assert response.status_code == 202
        ticket = response.json()
        read = client.get("/api/explain/requests/" + ticket["requestId"],
                          headers={**headers(), "X-Aviation-Explain-Token": ticket["accessToken"]})
        assert read.status_code == 200 and read.json()["status"] == "completed"
        assert client.delete("/api/explain/__e2e/runs/" + RUN, headers=headers()).json()["count"] == 0


def test_proxy_rejects_wrong_application_or_storage_mode(actor):
    wrong = ExplanationProxy("weather-briefing", environment=actor)
    assert wrong.forward("GET", "/api/explain/config", headers=headers(app="weather-briefing")).status == 503
    normal = ExplanationProxy(APP, broker_url=actor["AVIATION_EXPLAIN_BROKER_URL"], environment={})
    assert normal.forward("GET", "/api/explain/config").status == 503
    assert normal.forward("GET", "/api/explain/config", headers=headers()).status == 403


def test_proxy_blocks_unselected_destinations_paths_and_oversize_bodies():
    for url in ["https://127.0.0.1:12", "http://example.com:12", "http://user:secret@127.0.0.1:12",
                "http://127.0.0.1:12/path", "http://127.0.0.1:12?token=secret"]:
        proxy = ExplanationProxy(APP, broker_url=url, environment={})
        assert proxy.forward("GET", "/api/explain/config").status == 503
    proxy = ExplanationProxy(APP, environment={})
    assert proxy.forward("GET", "/.keystore").status == 404
    assert proxy.forward("GET", "/api/explain/requests/../config").status == 404
    assert proxy.forward("GET", "/api/explain").status == 405
    assert proxy.forward("POST", "/api/explain", b"x" * 524_289).status == 413


def test_normal_user_authorization_runs_before_forwarding():
    proxy = ExplanationProxy(APP, broker_url="http://127.0.0.1:1", environment={})
    assert proxy.forward("POST", "/api/explain", b"{}", authorize=lambda: False).status == 401


@pytest.fixture
def tripwire():
    hits = []

    class Handler(BaseHTTPRequestHandler):
        def do_GET(self):
            hits.append(self.path)
            if self.path == "/external":
                self.send_response(200)
            else:
                self.send_response(302)
                self.send_header("Location", "http://127.0.0.1:" + str(self.server.server_port) + "/external")
            self.send_header("X-Aviation-Application", APP)
            self.end_headers()

        def log_message(self, *_args):
            pass

    server = ThreadingHTTPServer(("127.0.0.1", 0), Handler)
    thread = Thread(target=server.serve_forever, daemon=True)
    thread.start()
    try:
        yield "http://127.0.0.1:" + str(server.server_port), hits
    finally:
        server.shutdown()
        server.server_close()
        thread.join(timeout=1)


def test_proxy_ignores_environment_http_proxies(actor, tripwire, monkeypatch):
    url, hits = tripwire
    for key in ["NO_PROXY", "no_proxy"]:
        monkeypatch.delenv(key, raising=False)
    monkeypatch.setenv("HTTP_PROXY", url)
    monkeypatch.setenv("http_proxy", url)
    response = ExplanationProxy(APP, environment=actor).forward("GET", "/api/explain/config", headers=headers())
    assert response.status == 200
    assert hits == []


def test_proxy_does_not_follow_redirects_from_an_incorrect_service(tripwire):
    url, hits = tripwire
    response = ExplanationProxy(APP, broker_url=url, environment={}).forward("GET", "/api/explain/config")
    assert response.status == 503
    assert hits == ["/api/explain/config"]
