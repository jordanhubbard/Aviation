"""Remote E2E data must be signed, isolated, tagged, and physically removed."""
import base64
import hashlib
import hmac
import sqlite3
import time

from fastapi.testclient import TestClient

from flightlab.api import create_app
from tests.synth import Sim, foreflight_kml


def signed(run, secret):
    expiry = str(int(time.time() * 1000) + 60_000)
    signature = hmac.new(secret.encode(), f"flight-track-analyzer\n{run}\n{expiry}".encode(), hashlib.sha256).hexdigest()
    return {"x-aviation-test-run": run, "x-aviation-test-expires": expiry,
            "x-aviation-test-signature": signature}


def test_signed_flight_is_isolated_and_cleanup_removes_database(tmp_path, monkeypatch):
    secret = "kmlab-remote-e2e-secret-of-at-least-32-bytes"
    monkeypatch.setenv("AVIATION_E2E_SECRET", secret)
    app = create_app(str(tmp_path))
    client = TestClient(app)
    run = "e2e_" + "a" * 32
    headers = signed(run, secret)
    fixture = {"fixture_type": "flight", "record": {"is_test_data": True, "test_run_id": run,
               "aircraft": "E2E", "kml_base64": base64.b64encode(
                   foreflight_kml(Sim(seed=1, gps_alt=1.5).run_standard())).decode()}}

    assert client.post("/__e2e/fixtures", json=fixture).status_code == 403
    assert client.get("/api/flights", headers={"x-aviation-test-run": run}).status_code == 403
    bad_fixture = {**fixture, "record": {**fixture["record"], "test_run_id": "e2e_" + "b" * 32}}
    assert client.post("/__e2e/fixtures", json=bad_fixture, headers=headers).status_code == 422
    result = client.post("/__e2e/fixtures", json=fixture, headers=headers)
    assert result.status_code == 200, result.text
    assert result.json()["test_run_id"] == run
    assert client.get("/api/flights", headers=headers).json()["flights"]
    assert client.get("/api/flights").json()["flights"] == []
    db = tmp_path / "__e2e" / run / "kmlab.sqlite3"
    with sqlite3.connect(db) as connection:
        assert connection.execute("SELECT test_run_id, is_test_data FROM e2e_runs").fetchone() == (run, 1)
        for table in ("aircraft", "flights", "events", "patterns"):
            assert set(connection.execute(f"SELECT DISTINCT test_run_id, is_test_data FROM {table}")) == {(run, 1)}
    assert client.delete(f"/__e2e/runs/{run}", headers=headers).status_code == 200
    assert client.get(f"/__e2e/runs/{run}", headers=headers).json()["count"] == 0
    assert not db.exists()
    assert client.get("/api/flights").json()["flights"] == []
