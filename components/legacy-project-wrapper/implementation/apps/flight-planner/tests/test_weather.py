from fastapi.testclient import TestClient

from main import app


def test_weather_missing_api_key_returns_503(monkeypatch) -> None:
    import app.routers.weather as weather_router

    monkeypatch.delenv("OPENWEATHERMAP_API_KEY", raising=False)
    monkeypatch.setattr(
        weather_router,
        "get_airport_coordinates",
        lambda _code: {"latitude": 40.0, "longitude": -75.0},
    )

    client = TestClient(app)
    resp = client.get("/api/weather/AAA")
    assert resp.status_code == 503
    assert "OPENWEATHERMAP_API_KEY" in resp.json()["detail"]


def test_weather_ok(monkeypatch) -> None:
    import app.routers.weather as weather_router

    monkeypatch.setenv("OPENWEATHERMAP_API_KEY", "test-key")
    monkeypatch.setattr(
        weather_router,
        "get_airport_coordinates",
        lambda _code: {"latitude": 40.0, "longitude": -75.0},
    )
    monkeypatch.setattr(
        weather_router.openweathermap,
        "get_current_weather",
        lambda **_kwargs: {
            "weather": [{"main": "Clear", "description": "clear sky"}],
            "main": {"temp": 72.4},
            "wind": {"speed": 10.0, "deg": 270},
            "visibility": 16093,
            "clouds": {"all": 0},
        },
    )
    monkeypatch.setattr(weather_router.metar, "fetch_metar_raw", lambda _station: None)

    client = TestClient(app)
    resp = client.get("/api/weather/AAA")
    assert resp.status_code == 200
    body = resp.json()
    assert body["airport"] == "AAA"
    assert body["conditions"]
    assert body["temperature"] == 72
    assert body["wind_direction"] == 270
    assert body["flight_category"] in {"VFR", "MVFR", "IFR", "LIFR", "UNKNOWN"}


def test_weather_metar_overrides_fields(monkeypatch) -> None:
    import app.routers.weather as weather_router

    monkeypatch.setenv("OPENWEATHERMAP_API_KEY", "test-key")
    monkeypatch.setattr(
        weather_router,
        "get_airport_coordinates",
        lambda _code: {"latitude": 40.0, "longitude": -75.0},
    )
    monkeypatch.setattr(
        weather_router.openweathermap,
        "get_current_weather",
        lambda **_kwargs: {
            "weather": [{"main": "Clouds", "description": "overcast"}],
            "main": {"temp": 50.0},
            "wind": {"speed": 5.0, "deg": 90},
            "visibility": 1000,
            "clouds": {"all": 90},
        },
    )
    monkeypatch.setattr(
        weather_router.metar,
        "fetch_metar_raw",
        lambda _station: "KAAA 171856Z 27010KT 10SM BKN020 20/10 A2992",
    )

    client = TestClient(app)
    resp = client.get("/api/weather/AAA")
    assert resp.status_code == 200
    body = resp.json()
    assert body["metar"].startswith("KAAA")
    assert body["wind_speed"] == 10
    assert body["wind_direction"] == 270
    assert body["visibility"] == 10.0
    assert body["ceiling"] == 2000
    assert body["temperature"] == 68
    assert body["flight_category"] == "MVFR"


def test_weather_recommendations_ok(monkeypatch) -> None:
    import app.routers.weather as weather_router

    monkeypatch.setattr(
        weather_router,
        "get_airport_coordinates",
        lambda _code: {"latitude": 40.0, "longitude": -75.0},
    )
    monkeypatch.setattr(
        weather_router.metar,
        "fetch_metar_raw",
        lambda _station: "KAAA 171856Z 27010KT 10SM BKN020 20/10 A2992",
    )
    monkeypatch.setattr(
        weather_router.open_meteo,
        "get_hourly_forecast",
        lambda **_kwargs: [
            {
                "time": "2025-01-01T00:00",
                "visibility_m": 16000,
                "cloudcover_pct": 10,
                "precipitation_mm": 0,
                "wind_speed_kt": 5,
            },
            {
                "time": "2025-01-01T01:00",
                "visibility_m": 16000,
                "cloudcover_pct": 10,
                "precipitation_mm": 0,
                "wind_speed_kt": 5,
            },
            {
                "time": "2025-01-01T02:00",
                "visibility_m": 16000,
                "cloudcover_pct": 10,
                "precipitation_mm": 0,
                "wind_speed_kt": 5,
            },
            {
                "time": "2025-01-01T03:00",
                "visibility_m": 16000,
                "cloudcover_pct": 80,
                "precipitation_mm": 2,
                "wind_speed_kt": 25,
            },
        ],
    )

    client = TestClient(app)
    resp = client.get("/api/weather/AAA/recommendations")
    assert resp.status_code == 200
    body = resp.json()
    assert body["airport"] == "AAA"
    assert body["current_category"] == "MVFR"
    assert body["best_departure_windows"]
