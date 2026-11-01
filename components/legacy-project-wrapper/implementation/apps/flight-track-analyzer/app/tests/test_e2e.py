"""Remote E2E data must be signed, isolated, tagged, and physically removed."""
import base64
import sqlite3
import time

from aviation.e2e import sign_e2e_headers, tag_test_record
from fastapi.testclient import TestClient

from flightlab.api import create_app
from tests.synth import Sim, foreflight_kml


def signed(run, secret):
    return sign_e2e_headers("flight-track-analyzer", run, secret, int(time.time() * 1000), 60_000)


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



def test_signed_browser_upload_is_tagged_persistent_and_deletable(tmp_path, monkeypatch):
    secret = "kmlab-isolated-upload-secret-at-least-32-bytes"
    monkeypatch.setenv("AVIATION_E2E_SECRET", secret)
    run = "e2e_" + "b" * 32
    foreign = "e2e_" + "c" * 32
    headers = signed(run, secret)
    data = foreflight_kml(Sim(seed=2, gps_alt=1.5).run_standard())
    app = create_app(str(tmp_path))
    production = app.state.store.ingest(data + b"\n", "production-fixture.kml", "NPROD")[0]
    client = TestClient(app)
    fixture = tag_test_record(run, {"aircraft": "E2E", "kml_base64": base64.b64encode(data).decode()})
    seeded = client.post("/__e2e/fixtures", json={"fixture_type": "flight", "record": fixture}, headers=headers)
    assert seeded.status_code == 200, seeded.text
    response = client.post("/api/flights", headers=headers,
        files={"files": ("browser-upload.kml", data + b"\n\n", "application/vnd.google-earth.kml+xml")},
        data={"aircraft": "E2EUP"})
    assert response.status_code == 200, response.text
    uploaded = response.json()["results"][0]
    assert uploaded["aircraft"] == "E2EUP" and uploaded["duplicate"] is False
    assert uploaded["id"] not in {seeded.json()["id"], production["id"]}
    meta = client.put(f"/api/flights/{uploaded['id']}/meta", headers=headers,
        json={"aircraft": "E2EUP", "oat_c": 15, "weight_lb": 2000})
    assert meta.status_code == 200, meta.text
    reference = client.put("/api/aircraft/E2EUP/poh", headers=headers, json={
        "takeoff": [{"pa_ft": 0, "oat_c": 15, "ground_roll_ft": 780, "total50_ft": 1385}],
        "notes": f"Synthetic reference {run}"})
    assert reference.status_code == 200, reference.text

    # Reopening the app must read SQLite rather than retain an in-process fixture.
    fresh = TestClient(create_app(str(tmp_path)))
    flights = fresh.get("/api/flights", headers=headers).json()["flights"]
    assert {flight["aircraft"] for flight in flights} == {"E2E", "E2EUP"}
    foreign_headers = signed(foreign, secret)
    assert fresh.delete(f"/api/flights/{uploaded['id']}", headers=foreign_headers).status_code == 404
    assert len(fresh.get("/api/flights", headers=headers).json()["flights"]) == 2
    assert [flight["aircraft"] for flight in fresh.get("/api/flights").json()["flights"]] == ["NPROD"]
    db = tmp_path / "__e2e" / run / "kmlab.sqlite3"
    with sqlite3.connect(db) as connection:
        for table in ("aircraft", "flights", "events", "patterns", "flight_conditions", "poh_meta", "poh_reference"):
            assert set(connection.execute(f"SELECT DISTINCT test_run_id, is_test_data FROM {table}")) == {(run, 1)}
        assert connection.execute("SELECT COUNT(*) FROM flights").fetchone()[0] == 2
    for flight in flights:
        deleted = fresh.delete(f"/api/flights/{flight['id']}", headers=headers)
        assert deleted.status_code == 200 and deleted.json()["deleted"] == flight["id"]
    assert fresh.get("/api/flights", headers=headers).json()["flights"] == []
    assert not list((db.parent / "raw").glob("*.kml"))
    with sqlite3.connect(db) as connection:
        for table in ("flights", "events", "patterns", "flight_conditions"):
            assert connection.execute(f"SELECT COUNT(*) FROM {table}").fetchone()[0] == 0
    assert fresh.delete(f"/__e2e/runs/{run}", headers=headers).status_code == 200
    assert fresh.delete(f"/__e2e/runs/{foreign}", headers=foreign_headers).status_code == 200
    assert fresh.get(f"/__e2e/runs/{run}", headers=headers).json()["count"] == 0
    assert not db.parent.exists()
    assert [flight["aircraft"] for flight in fresh.get("/api/flights").json()["flights"]] == ["NPROD"]
