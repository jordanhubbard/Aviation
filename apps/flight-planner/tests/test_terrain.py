from fastapi.testclient import TestClient

from main import app


def test_terrain_point(monkeypatch) -> None:
    import app.services.terrain_service as terrain_service

    monkeypatch.delenv("OPENTOPOGRAPHY_API_KEY", raising=False)
    monkeypatch.delenv("TERRAIN_PROVIDER", raising=False)
    monkeypatch.setattr(terrain_service, "_fetch_open_meteo_elevations_m", lambda _pts: [100.0])
    client = TestClient(app)
    resp = client.get("/api/terrain/point", params={"lat": 40.0, "lon": -75.0})
    assert resp.status_code == 200
    body = resp.json()
    assert body["elevation_ft"] is not None
