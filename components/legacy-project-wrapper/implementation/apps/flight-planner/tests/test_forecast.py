from fastapi.testclient import TestClient

from main import app


def test_weather_forecast_ok(monkeypatch) -> None:
    import app.routers.weather as weather_router

    monkeypatch.setattr(
        weather_router,
        "get_airport_coordinates",
        lambda _code: {"latitude": 40.0, "longitude": -75.0},
    )
    monkeypatch.setattr(
        weather_router.open_meteo,
        "get_daily_forecast",
        lambda **_kwargs: [
            {
                "date": "2025-01-01",
                "temp_max_f": 70,
                "temp_min_f": 50,
                "precipitation_mm": 0.0,
                "wind_speed_max_kt": 12,
            },
            {
                "date": "2025-01-02",
                "temp_max_f": 72,
                "temp_min_f": 52,
                "precipitation_mm": 1.2,
                "wind_speed_max_kt": 15,
            },
        ],
    )

    client = TestClient(app)
    resp = client.get("/api/weather/AAA/forecast", params={"days": 2})
    assert resp.status_code == 200
    body = resp.json()
    assert body["airport"] == "AAA"
    assert body["days"] == 2
    assert len(body["daily"]) == 2
    assert body["daily"][0]["date"] == "2025-01-01"


def test_weather_forecast_invalid_days(monkeypatch) -> None:
    import app.routers.weather as weather_router

    monkeypatch.setattr(
        weather_router,
        "get_airport_coordinates",
        lambda _code: {"latitude": 40.0, "longitude": -75.0},
    )

    client = TestClient(app)
    resp = client.get("/api/weather/AAA/forecast", params={"days": 20})
    assert resp.status_code == 400
