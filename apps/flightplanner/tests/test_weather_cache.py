from __future__ import annotations

from typing import Any, Dict


class DummyResponse:
    def __init__(
        self, *, status_code: int = 200, json_data: Dict[str, Any] | None = None, text: str = ""
    ) -> None:
        self.status_code = status_code
        self._json = json_data or {}
        self.text = text

    def raise_for_status(self) -> None:
        if self.status_code >= 400:
            raise RuntimeError(f"HTTP {self.status_code}")

    def json(self) -> Dict[str, Any]:
        return self._json


def test_metar_fetch_is_cached(monkeypatch) -> None:
    from app.services import metar
    from app.utils.ttl_cache import weather_cache

    weather_cache.clear()
    calls = {"n": 0}

    def fake_get(*_args, **_kwargs):
        calls["n"] += 1
        return DummyResponse(text="KAAA 171856Z 27010KT 10SM BKN020 20/10 A2992")

    monkeypatch.setattr(metar.httpx, "get", fake_get)

    assert metar.fetch_metar_raw("KAAA")
    assert metar.fetch_metar_raw("KAAA")
    assert calls["n"] == 1


def test_open_meteo_current_is_cached(monkeypatch) -> None:
    from app.services import open_meteo
    from app.utils.ttl_cache import weather_cache

    weather_cache.clear()
    calls = {"n": 0}

    def fake_get(*_args, **_kwargs):
        calls["n"] += 1
        return DummyResponse(
            json_data={
                "current_weather": {"temperature": 70.0, "windspeed": 10.0, "winddirection": 180}
            }
        )

    monkeypatch.setattr(open_meteo.httpx, "get", fake_get)

    open_meteo.get_current_weather(lat=40.0, lon=-75.0)
    open_meteo.get_current_weather(lat=40.0, lon=-75.0)
    assert calls["n"] == 1


def test_openweathermap_current_is_cached(monkeypatch) -> None:
    from app.services import openweathermap
    from app.utils.ttl_cache import weather_cache

    weather_cache.clear()
    monkeypatch.setenv("OPENWEATHERMAP_API_KEY", "test-key")

    calls = {"n": 0}

    def fake_get(*_args, **_kwargs):
        calls["n"] += 1
        return DummyResponse(
            json_data={
                "weather": [{"description": "clear"}],
                "main": {"temp": 50},
                "wind": {"speed": 5, "deg": 90},
            }
        )

    monkeypatch.setattr(openweathermap.httpx, "get", fake_get)

    openweathermap.get_current_weather(lat=40.0, lon=-75.0)
    openweathermap.get_current_weather(lat=40.0, lon=-75.0)
    assert calls["n"] == 1
