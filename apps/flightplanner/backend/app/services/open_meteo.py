from __future__ import annotations

from typing import Any, Dict, List, Tuple

import httpx

from app.utils.ttl_cache import weather_cache


class OpenMeteoError(RuntimeError):
    pass


def get_current_weather(*, lat: float, lon: float) -> Dict[str, Any]:
    cache_key = f"om:current:{round(lat, 3)}:{round(lon, 3)}"

    def _fetch() -> Dict[str, Any]:
        params = {
            "latitude": lat,
            "longitude": lon,
            "current_weather": True,
            "timezone": "UTC",
            "temperature_unit": "fahrenheit",
            "windspeed_unit": "kn",
        }

        resp = httpx.get("https://api.open-meteo.com/v1/forecast", params=params, timeout=20)
        resp.raise_for_status()
        payload = resp.json()
        cw = payload.get("current_weather")
        if not isinstance(cw, dict):
            raise OpenMeteoError("Unexpected Open-Meteo current_weather schema")
        return cw

    return weather_cache.get_or_set(cache_key, ttl_s=600, fn=_fetch, allow_stale_on_error=True)


def get_daily_forecast(*, lat: float, lon: float, days: int) -> List[Dict[str, Any]]:
    if days < 1 or days > 16:
        raise OpenMeteoError("days must be between 1 and 16")

    cache_key = f"om:daily:{round(lat, 3)}:{round(lon, 3)}:{days}"

    def _fetch() -> List[Dict[str, Any]]:
        params = {
            "latitude": lat,
            "longitude": lon,
            "daily": "temperature_2m_max,temperature_2m_min,precipitation_sum,windspeed_10m_max",
            "forecast_days": days,
            "timezone": "UTC",
            "temperature_unit": "fahrenheit",
            "windspeed_unit": "kn",
        }

        resp = httpx.get("https://api.open-meteo.com/v1/forecast", params=params, timeout=20)
        resp.raise_for_status()
        payload = resp.json()
        daily = payload.get("daily")
        if not isinstance(daily, dict):
            raise OpenMeteoError("Unexpected Open-Meteo response")

        times = daily.get("time")
        tmax = daily.get("temperature_2m_max")
        tmin = daily.get("temperature_2m_min")
        precip = daily.get("precipitation_sum")
        wind = daily.get("windspeed_10m_max")

        if not (isinstance(times, list) and isinstance(tmax, list) and isinstance(tmin, list)):
            raise OpenMeteoError("Unexpected Open-Meteo daily schema")

        out: List[Dict[str, Any]] = []
        for i, date in enumerate(times):
            out.append(
                {
                    "date": date,
                    "temp_max_f": tmax[i] if i < len(tmax) else None,
                    "temp_min_f": tmin[i] if i < len(tmin) else None,
                    "precipitation_mm": (
                        precip[i] if isinstance(precip, list) and i < len(precip) else None
                    ),
                    "wind_speed_max_kt": (
                        wind[i] if isinstance(wind, list) and i < len(wind) else None
                    ),
                }
            )

        return out

    return weather_cache.get_or_set(cache_key, ttl_s=1800, fn=_fetch, allow_stale_on_error=True)


def get_hourly_forecast(*, lat: float, lon: float, hours: int = 24) -> List[Dict[str, Any]]:
    if hours < 1 or hours > 168:
        raise OpenMeteoError("hours must be between 1 and 168")

    cache_key = f"om:hourly:{round(lat, 3)}:{round(lon, 3)}:{hours}"

    def _fetch() -> List[Dict[str, Any]]:
        params = {
            "latitude": lat,
            "longitude": lon,
            "hourly": "visibility,cloudcover,precipitation,windspeed_10m",
            "forecast_days": 2,
            "timezone": "UTC",
            "windspeed_unit": "kn",
        }

        resp = httpx.get("https://api.open-meteo.com/v1/forecast", params=params, timeout=20)
        resp.raise_for_status()
        payload = resp.json()
        hourly = payload.get("hourly")
        if not isinstance(hourly, dict):
            raise OpenMeteoError("Unexpected Open-Meteo hourly schema")

        times = hourly.get("time")
        vis = hourly.get("visibility")
        clouds = hourly.get("cloudcover")
        precip = hourly.get("precipitation")
        wind = hourly.get("windspeed_10m")

        if not isinstance(times, list):
            raise OpenMeteoError("Unexpected Open-Meteo hourly schema")

        out: List[Dict[str, Any]] = []
        for i, t in enumerate(times[:hours]):
            out.append(
                {
                    "time": t,
                    "visibility_m": vis[i] if isinstance(vis, list) and i < len(vis) else None,
                    "cloudcover_pct": (
                        clouds[i] if isinstance(clouds, list) and i < len(clouds) else None
                    ),
                    "precipitation_mm": (
                        precip[i] if isinstance(precip, list) and i < len(precip) else None
                    ),
                    "wind_speed_kt": wind[i] if isinstance(wind, list) and i < len(wind) else None,
                }
            )

        return out

    return weather_cache.get_or_set(cache_key, ttl_s=1800, fn=_fetch, allow_stale_on_error=True)


def sample_points_along_route(
    points: List[Tuple[float, float]], interval: int = 5
) -> List[Tuple[float, float]]:
    return points[:: max(1, interval)]
