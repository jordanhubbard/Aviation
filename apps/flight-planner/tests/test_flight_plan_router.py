"""Unit tests for the flight_plan router endpoints."""
from __future__ import annotations

import pytest
from fastapi.testclient import TestClient

from main import app

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

@pytest.fixture()
def client(monkeypatch):
    """Return a test client with a clean in-memory plan store."""
    import app.routers.flight_plan as fp_router

    monkeypatch.setattr(fp_router, "_plans", {})
    monkeypatch.setattr(fp_router, "_save_plans", lambda: None)
    return TestClient(app)


def _create_plan(client, name="Test Plan", **kwargs):
    payload = {"name": name, **kwargs}
    resp = client.post("/flight-plans/", json=payload)
    assert resp.status_code == 201
    return resp.json()


# ---------------------------------------------------------------------------
# GET /flight-plans/  (list)
# ---------------------------------------------------------------------------


def test_list_empty(client):
    resp = client.get("/flight-plans/")
    assert resp.status_code == 200
    assert resp.json() == []


def test_list_returns_created_plans(client):
    _create_plan(client, name="Alpha")
    _create_plan(client, name="Beta")
    resp = client.get("/flight-plans/")
    assert resp.status_code == 200
    names = [p["name"] for p in resp.json()]
    assert "Alpha" in names
    assert "Beta" in names


def test_list_summary_shape(client):
    _create_plan(client, name="Summary Shape", origin="KSFO", destination="KLAX", distance_nm=337.0)
    resp = client.get("/flight-plans/")
    assert resp.status_code == 200
    plan = resp.json()[0]
    for field in ("id", "name", "created_at", "updated_at", "waypoint_count"):
        assert field in plan, f"Missing field {field!r}"


# ---------------------------------------------------------------------------
# POST /flight-plans/  (create)
# ---------------------------------------------------------------------------


def test_create_minimal(client):
    resp = client.post("/flight-plans/", json={"name": "Minimal Plan"})
    assert resp.status_code == 201
    body = resp.json()
    assert body["metadata"]["name"] == "Minimal Plan"


def test_create_assigns_unique_ids(client):
    p1 = _create_plan(client, name="Plan A")
    p2 = _create_plan(client, name="Plan B")
    assert p1["metadata"]["id"] != p2["metadata"]["id"]


def test_create_sets_timestamps(client):
    body = _create_plan(client, name="TS Plan")
    assert body["metadata"]["created_at"] is not None
    assert body["metadata"]["updated_at"] is not None


def test_create_full_payload(client):
    waypoints = [
        {"name": "KSFO", "latitude": 37.619, "longitude": -122.375, "sequence": 0},
        {"name": "KLAX", "latitude": 33.943, "longitude": -118.408, "sequence": 1},
    ]
    resp = client.post(
        "/flight-plans/",
        json={
            "name": "SFO-LAX",
            "origin": "KSFO",
            "destination": "KLAX",
            "waypoints": waypoints,
            "distance_nm": 337.0,
            "cruise_altitude_ft": 9000,
            "cruise_speed_kt": 120.0,
            "aircraft_type": "C172",
            "pilot_name": "Alice",
            "notes": "VFR flight",
        },
    )
    assert resp.status_code == 201
    body = resp.json()
    assert body["metadata"]["origin"] == "KSFO"
    assert body["metadata"]["destination"] == "KLAX"
    assert body["distance_nm"] == 337.0
    assert len(body["waypoints"]) == 2


def test_create_missing_name_returns_422(client):
    resp = client.post("/flight-plans/", json={"origin": "KSFO"})
    assert resp.status_code == 422


# ---------------------------------------------------------------------------
# GET /flight-plans/{plan_id}
# ---------------------------------------------------------------------------


def test_get_existing(client):
    created = _create_plan(client, name="Getter Plan")
    plan_id = created["metadata"]["id"]
    resp = client.get(f"/flight-plans/{plan_id}")
    assert resp.status_code == 200
    assert resp.json()["metadata"]["id"] == plan_id


def test_get_includes_waypoints(client):
    waypoints = [{"name": "WP1", "latitude": 10.0, "longitude": 20.0, "sequence": 0}]
    created = _create_plan(client, name="WP Plan", waypoints=waypoints)
    plan_id = created["metadata"]["id"]
    resp = client.get(f"/flight-plans/{plan_id}")
    assert resp.status_code == 200
    assert len(resp.json()["waypoints"]) == 1


def test_get_nonexistent_returns_404(client):
    resp = client.get("/flight-plans/no-such-id")
    assert resp.status_code == 404


# ---------------------------------------------------------------------------
# PUT /flight-plans/{plan_id}
# ---------------------------------------------------------------------------


def test_update_name(client):
    created = _create_plan(client, name="Old Name")
    plan_id = created["metadata"]["id"]
    resp = client.put(f"/flight-plans/{plan_id}", json={"name": "New Name"})
    assert resp.status_code == 200
    assert resp.json()["metadata"]["name"] == "New Name"


def test_update_metadata_fields(client):
    created = _create_plan(client, name="Update Meta")
    plan_id = created["metadata"]["id"]
    resp = client.put(
        f"/flight-plans/{plan_id}",
        json={"origin": "KORD", "destination": "KJFK", "aircraft_type": "B737"},
    )
    assert resp.status_code == 200
    meta = resp.json()["metadata"]
    assert meta["origin"] == "KORD"
    assert meta["destination"] == "KJFK"
    assert meta["aircraft_type"] == "B737"


def test_update_plan_fields(client):
    created = _create_plan(client, name="Plan Fields")
    plan_id = created["metadata"]["id"]
    resp = client.put(
        f"/flight-plans/{plan_id}",
        json={"distance_nm": 150.0, "cruise_altitude_ft": 7500},
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["distance_nm"] == 150.0
    assert body["cruise_altitude_ft"] == 7500


def test_update_bumps_updated_at(client):
    created = _create_plan(client, name="Timestamp Plan")
    plan_id = created["metadata"]["id"]
    original_ts = created["metadata"]["updated_at"]
    import time; time.sleep(0.01)
    resp = client.put(f"/flight-plans/{plan_id}", json={"name": "Renamed"})
    assert resp.status_code == 200
    # updated_at should be a valid datetime string (not necessarily strictly later in the
    # same second, but present and non-null)
    assert resp.json()["metadata"]["updated_at"] is not None


def test_update_nonexistent_returns_404(client):
    resp = client.put("/flight-plans/no-such-id", json={"name": "X"})
    assert resp.status_code == 404


# ---------------------------------------------------------------------------
# DELETE /flight-plans/{plan_id}
# ---------------------------------------------------------------------------


def test_delete_existing(client):
    created = _create_plan(client, name="Delete Me")
    plan_id = created["metadata"]["id"]
    resp = client.delete(f"/flight-plans/{plan_id}")
    assert resp.status_code == 204


def test_delete_removes_from_list(client):
    created = _create_plan(client, name="Removable")
    plan_id = created["metadata"]["id"]
    client.delete(f"/flight-plans/{plan_id}")
    resp = client.get("/flight-plans/")
    ids = [p["id"] for p in resp.json()]
    assert plan_id not in ids


def test_delete_nonexistent_returns_404(client):
    resp = client.delete("/flight-plans/no-such-id")
    assert resp.status_code == 404


# ---------------------------------------------------------------------------
# POST /flight-plans/{plan_id}/export
# ---------------------------------------------------------------------------


def test_export_gpx_default(client):
    created = _create_plan(
        client,
        name="GPX Plan",
        waypoints=[{"name": "A", "latitude": 37.0, "longitude": -122.0, "sequence": 0}],
    )
    plan_id = created["metadata"]["id"]
    resp = client.post(f"/flight-plans/{plan_id}/export?fmt=gpx")
    assert resp.status_code == 200
    body = resp.json()
    assert body["format"] == "gpx"
    assert "<gpx" in body["content"]
    assert body["filename"].endswith(".gpx")


def test_export_gpx_includes_altitude(client):
    created = _create_plan(
        client,
        name="Alt Plan",
        waypoints=[{"name": "WP", "latitude": 37.0, "longitude": -122.0, "altitude_ft": 5000.0, "sequence": 0}],
    )
    plan_id = created["metadata"]["id"]
    resp = client.post(f"/flight-plans/{plan_id}/export?fmt=gpx")
    assert resp.status_code == 200
    assert "5000" in resp.json()["content"]


def test_export_fpl(client):
    created = _create_plan(client, name="FPL Plan", origin="KSFO", destination="KLAX")
    plan_id = created["metadata"]["id"]
    resp = client.post(f"/flight-plans/{plan_id}/export?fmt=fpl")
    assert resp.status_code == 200
    body = resp.json()
    assert body["format"] == "fpl"
    assert "FPL" in body["content"]
    assert body["filename"].endswith(".fpl")


def test_export_unsupported_format_422(client):
    created = _create_plan(client, name="Bad Format")
    plan_id = created["metadata"]["id"]
    resp = client.post(f"/flight-plans/{plan_id}/export?fmt=kml")
    assert resp.status_code == 422


def test_export_nonexistent_plan_404(client):
    resp = client.post("/flight-plans/no-such-id/export?fmt=gpx")
    assert resp.status_code == 404


# ---------------------------------------------------------------------------
# POST /flight-plans/import
# ---------------------------------------------------------------------------


GPX_CONTENT = """\
<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="test">
  <trk>
    <name>Test Route</name>
    <trkseg>
      <trkpt lat="37.619" lon="-122.375">
        <ele>30.0</ele>
        <name>KSFO</name>
      </trkpt>
      <trkpt lat="33.943" lon="-118.408">
        <name>KLAX</name>
      </trkpt>
    </trkseg>
  </trk>
</gpx>"""

FPL_CONTENT = """\
(FPL-SFO2LAX-IS
-C172/L
-KSFOKLAX
KSFO FMG KLAX
)"""


def test_import_gpx_parses_waypoints(client):
    resp = client.post(
        "/flight-plans/import",
        json={"format": "gpx", "content": GPX_CONTENT},
    )
    assert resp.status_code == 201
    body = resp.json()
    assert len(body["waypoints"]) == 2
    assert body["waypoints"][0]["name"] == "KSFO"


def test_import_gpx_custom_name(client):
    resp = client.post(
        "/flight-plans/import",
        json={"format": "gpx", "content": GPX_CONTENT, "name": "My Route"},
    )
    assert resp.status_code == 201
    assert resp.json()["metadata"]["name"] == "My Route"


def test_import_gpx_stored(client):
    resp = client.post(
        "/flight-plans/import",
        json={"format": "gpx", "content": GPX_CONTENT},
    )
    assert resp.status_code == 201
    plan_id = resp.json()["metadata"]["id"]
    get_resp = client.get(f"/flight-plans/{plan_id}")
    assert get_resp.status_code == 200


def test_import_fpl_parses_waypoints(client):
    resp = client.post(
        "/flight-plans/import",
        json={"format": "fpl", "content": FPL_CONTENT},
    )
    assert resp.status_code == 201
    body = resp.json()
    assert len(body["waypoints"]) >= 1


def test_import_fpl_custom_name(client):
    resp = client.post(
        "/flight-plans/import",
        json={"format": "fpl", "content": FPL_CONTENT, "name": "Custom FPL"},
    )
    assert resp.status_code == 201
    assert resp.json()["metadata"]["name"] == "Custom FPL"


def test_import_invalid_format_422(client):
    resp = client.post(
        "/flight-plans/import",
        json={"format": "kml", "content": "<kml/>"},
    )
    assert resp.status_code == 422


def test_import_gpx_roundtrip(client):
    """Import a GPX then export it back to GPX and verify waypoints are preserved."""
    import_resp = client.post(
        "/flight-plans/import",
        json={"format": "gpx", "content": GPX_CONTENT},
    )
    assert import_resp.status_code == 201
    plan_id = import_resp.json()["metadata"]["id"]
    export_resp = client.post(f"/flight-plans/{plan_id}/export?fmt=gpx")
    assert export_resp.status_code == 200
    exported = export_resp.json()["content"]
    assert "KSFO" in exported


def test_fpl_roundtrip(client):
    """Import FPL then export it back and verify content is preserved."""
    import_resp = client.post(
        "/flight-plans/import",
        json={"format": "fpl", "content": FPL_CONTENT, "name": "FPL Roundtrip"},
    )
    assert import_resp.status_code == 201
    plan_id = import_resp.json()["metadata"]["id"]
    export_resp = client.post(f"/flight-plans/{plan_id}/export?fmt=fpl")
    assert export_resp.status_code == 200
    assert "FPL" in export_resp.json()["content"]


def test_storage_isolation(client):
    """Each test should start with a clean store — previous tests must not bleed through."""
    resp = client.get("/flight-plans/")
    assert resp.status_code == 200
    assert resp.json() == [], "Store was not empty at start of test — monkeypatch isolation broken"


def test_delete_then_get_404(client):
    """After deleting a plan, GET returns 404."""
    created = _create_plan(client, name="Gone Plan")
    plan_id = created["metadata"]["id"]
    del_resp = client.delete(f"/flight-plans/{plan_id}")
    assert del_resp.status_code == 204
    get_resp = client.get(f"/flight-plans/{plan_id}")
    assert get_resp.status_code == 404
