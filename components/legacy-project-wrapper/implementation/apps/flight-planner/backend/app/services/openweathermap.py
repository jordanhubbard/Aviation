from __future__ import annotations

import os
from typing import Any, Dict, Optional

import httpx

from app.utils.ttl_cache import weather_cache


class OpenWeatherMapError(RuntimeError):
    pass


def _api_key() -> str:
    key = os.environ.get("OPENWEATHERMAP_API_KEY") or os.environ.get("OPENWEATHER_API_KEY")
    if not key:
        raise OpenWeatherMapError("Missing OPENWEATHERMAP_API_KEY for OpenWeatherMap requests")
    return key


def get_current_weather(*, lat: float, lon: float) -> Dict[str, Any]:
    key = _api_key()

    cache_key = f"owm:current:{round(lat, 3)}:{round(lon, 3)}"

    def _fetch() -> Dict[str, Any]:
        params = {
            "lat": lat,
            "lon": lon,
            "appid": key,
            "units": "imperial",
        }

        resp = httpx.get(
            "https://api.openweathermap.org/data/2.5/weather", params=params, timeout=20
        )
        resp.raise_for_status()
        return resp.json()

    return weather_cache.get_or_set(cache_key, ttl_s=300, fn=_fetch, allow_stale_on_error=True)


def _mph_to_knots(mph: Optional[float]) -> float:
    if mph is None:
        return 0.0
    return float(mph) * 0.868976


def _meters_to_sm(meters: Optional[float]) -> float:
    if meters is None:
        return 0.0
    return float(meters) / 1609.34


def _estimate_ceiling_ft(cloud_pct: Optional[float]) -> float:
    if cloud_pct is None:
        return 10000.0
    pct = float(cloud_pct)
    if pct >= 75:
        return 1500.0
    if pct >= 50:
        return 3000.0
    if pct >= 25:
        return 5000.0
    return 10000.0


def to_weather_data(airport_code: str, payload: Dict[str, Any]) -> Dict[str, Any]:
    weather = payload.get("weather")
    wx0 = weather[0] if isinstance(weather, list) and weather else {}
    main = payload.get("main") if isinstance(payload.get("main"), dict) else {}
    wind = payload.get("wind") if isinstance(payload.get("wind"), dict) else {}
    clouds = payload.get("clouds") if isinstance(payload.get("clouds"), dict) else {}

    temp_f = float(main.get("temp") or 0.0)
    wind_speed_kt = _mph_to_knots(wind.get("speed"))
    wind_dir = int(wind.get("deg") or 0)
    vis_sm = _meters_to_sm(payload.get("visibility"))
    ceiling_ft = _estimate_ceiling_ft(clouds.get("all"))

    conditions = str(wx0.get("description") or wx0.get("main") or "Unknown")

    return {
        "airport": airport_code.upper(),
        "conditions": conditions,
        "temperature": round(temp_f),
        "wind_speed": round(wind_speed_kt),
        "wind_direction": wind_dir,
        "visibility": round(vis_sm, 1),
        "ceiling": round(ceiling_ft),
        "metar": "",
    }
