from __future__ import annotations

from fastapi.testclient import TestClient


def test_airports_search_smoke(client: TestClient) -> None:
    resp = client.get("/api/airports/search", params={"q": "KSFO", "limit": 5})
    assert resp.status_code == 200
    body = resp.json()
    assert isinstance(body, list)
    assert len(body) >= 1


def test_plan_route_smoke(client: TestClient) -> None:
    resp = client.post(
        "/api/plan",
        json={
            "mode": "route",
            "origin": "KSFO",
            "destination": "KLAX",
            "speed": 110.0,
            "speed_unit": "knots",
            "altitude": 5500,
            "avoid_airspaces": False,
            "avoid_terrain": False,
            "apply_wind": False,
        },
    )

    assert resp.status_code == 200
    body = resp.json()
    assert body["route"][0] == "KSFO"
    assert body["route"][-1] == "KLAX"
    assert body["distance_nm"] > 0
    assert body["time_hr"] > 0


def test_plan_local_smoke(client: TestClient) -> None:
    resp = client.post(
        "/api/plan",
        json={
            "mode": "local",
            "airport": "KSFO",
            "radius_nm": 25,
        },
    )

    assert resp.status_code == 200
    body = resp.json()
    assert body["airport"] == "KSFO"
    assert "nearby_airports" in body


def test_weather_route_smoke(client: TestClient, monkeypatch) -> None:
    import app.routers.weather as weather_router

    monkeypatch.setattr(
        weather_router.open_meteo,
        "get_current_weather",
        lambda lat, lon: {
            "temperature": 70.0,
            "windspeed": 10.0,
            "winddirection": 180,
            "time": "2025-01-01T00:00",
        },
    )

    resp = client.post(
        "/api/weather/route",
        json={"points": [[37.6213, -122.3790], [34.0522, -118.2437]], "max_points": 2},
    )

    assert resp.status_code == 200
    body = resp.json()
    assert len(body["points"]) == 2
    assert body["points"][0]["wind_speed_kt"] == 10.0
