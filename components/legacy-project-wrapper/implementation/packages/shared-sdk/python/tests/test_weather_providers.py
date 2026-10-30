"""Provider-cache tests owned by the common Aviation weather SDK."""

from __future__ import annotations

from typing import Any

from aviation.weather import metar, open_meteo, openweathermap, weather_cache


class Response:
    def __init__(
        self, *, payload: dict[str, Any] | None = None, text: str = ""
    ) -> None:
        self.status_code = 200
        self._payload = payload or {}
        self.text = text

    def raise_for_status(self) -> None:
        return None

    def json(self) -> dict[str, Any]:
        return self._payload


def test_metar_provider_is_cached(monkeypatch) -> None:
    weather_cache.clear()
    calls = 0

    def fake_get(*_args, **_kwargs):
        nonlocal calls
        calls += 1
        return Response(text="KAAA 171856Z 27010KT 10SM BKN020 20/10 A2992")

    monkeypatch.setattr(metar.httpx, "get", fake_get)
    assert metar.fetch_metar_raw("kaaa")
    assert metar.fetch_metar_raw("KAAA")
    assert calls == 1


def test_open_meteo_provider_is_cached(monkeypatch) -> None:
    weather_cache.clear()
    calls = 0

    def fake_get(*_args, **_kwargs):
        nonlocal calls
        calls += 1
        return Response(payload={"current_weather": {"temperature": 70.0}})

    monkeypatch.setattr(open_meteo.httpx, "get", fake_get)
    assert open_meteo.get_current_weather(lat=40.0, lon=-75.0)["temperature"] == 70.0
    assert open_meteo.get_current_weather(lat=40.0, lon=-75.0)["temperature"] == 70.0
    assert calls == 1


def test_openweathermap_provider_is_cached(monkeypatch) -> None:
    weather_cache.clear()
    monkeypatch.setenv("OPENWEATHERMAP_API_KEY", "test-key")
    calls = 0

    def fake_get(*_args, **_kwargs):
        nonlocal calls
        calls += 1
        return Response(payload={"main": {"temp": 65.0}})

    monkeypatch.setattr(openweathermap.httpx, "get", fake_get)
    assert (
        openweathermap.get_current_weather(lat=40.0, lon=-75.0)["main"]["temp"] == 65.0
    )
    assert (
        openweathermap.get_current_weather(lat=40.0, lon=-75.0)["main"]["temp"] == 65.0
    )
    assert calls == 1
