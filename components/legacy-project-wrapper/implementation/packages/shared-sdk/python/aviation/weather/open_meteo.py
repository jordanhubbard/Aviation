"""
Open-Meteo API Client

Fetches weather forecast data from Open-Meteo.com (free, no API key required).
Supports current weather, daily forecasts, and hourly forecasts.
"""

from __future__ import annotations

from typing import Any, Dict, List, Tuple

import httpx


class OpenMeteoError(RuntimeError):
    """Exception raised when Open-Meteo API requests fail."""
    pass


def get_current_weather(*, lat: float, lon: float) -> Dict[str, Any]:
    """
    Fetch current weather from Open-Meteo.
    
    Args:
        lat: Latitude
        lon: Longitude
        
    Returns:
        Dict containing current weather data:
            - time: ISO timestamp
            - temperature: Temperature in Fahrenheit
            - windspeed: Wind speed in knots
            - winddirection: Wind direction in degrees
            - weathercode: WMO weather code
            
    Raises:
        OpenMeteoError: If request fails
        
    Example:
        >>> weather = get_current_weather(lat=37.7749, lon=-122.4194)
        >>> print(weather['temperature'])
        65.5
    """
    params = {
        "latitude": lat,
        "longitude": lon,
        "current_weather": True,
        "timezone": "UTC",
        "temperature_unit": "fahrenheit",
        "windspeed_unit": "kn",
    }

    try:
        resp = httpx.get(
            "https://api.open-meteo.com/v1/forecast",
            params=params,
            timeout=20
        )
        resp.raise_for_status()
        payload = resp.json()
        
        current_weather = payload.get("current_weather")
        if not isinstance(current_weather, dict):
            raise OpenMeteoError("Unexpected Open-Meteo current_weather schema")
        
        return current_weather
    except httpx.HTTPStatusError as e:
        raise OpenMeteoError(f"Open-Meteo API error: {e.response.status_code}") from e
    except Exception as e:
        raise OpenMeteoError(f"Failed to fetch current weather: {e}") from e


def get_daily_forecast(*, lat: float, lon: float, days: int = 7) -> List[Dict[str, Any]]:
    """
    Fetch daily forecast from Open-Meteo.
    
    Args:
        lat: Latitude
        lon: Longitude
        days: Number of days to forecast (1-16)
        
    Returns:
        List of daily forecast dicts, each containing:
            - date: ISO date (YYYY-MM-DD)
            - temp_max_f: Maximum temperature in Fahrenheit
            - temp_min_f: Minimum temperature in Fahrenheit
            - precipitation_mm: Precipitation sum in millimeters
            - wind_speed_max_kt: Maximum wind speed in knots
            
    Raises:
        OpenMeteoError: If request fails or days is out of range
        
    Example:
        >>> forecast = get_daily_forecast(lat=37.7749, lon=-122.4194, days=3)
        >>> print(forecast[0])
        {
            'date': '2024-01-15',
            'temp_max_f': 68.0,
            'temp_min_f': 52.0,
            'precipitation_mm': 0.2,
            'wind_speed_max_kt': 12.0
        }
    """
    if days < 1 or days > 16:
        raise OpenMeteoError("days must be between 1 and 16")

    params = {
        "latitude": lat,
        "longitude": lon,
        "daily": "temperature_2m_max,temperature_2m_min,precipitation_sum,windspeed_10m_max",
        "forecast_days": days,
        "timezone": "UTC",
        "temperature_unit": "fahrenheit",
        "windspeed_unit": "kn",
    }

    try:
        resp = httpx.get(
            "https://api.open-meteo.com/v1/forecast",
            params=params,
            timeout=20
        )
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

        result: List[Dict[str, Any]] = []
        for i, date in enumerate(times):
            result.append({
                "date": date,
                "temp_max_f": tmax[i] if i < len(tmax) else None,
                "temp_min_f": tmin[i] if i < len(tmin) else None,
                "precipitation_mm": precip[i] if isinstance(precip, list) and i < len(precip) else None,
                "wind_speed_max_kt": wind[i] if isinstance(wind, list) and i < len(wind) else None,
            })

        return result
    except httpx.HTTPStatusError as e:
        raise OpenMeteoError(f"Open-Meteo API error: {e.response.status_code}") from e
    except OpenMeteoError:
        raise
    except Exception as e:
        raise OpenMeteoError(f"Failed to fetch daily forecast: {e}") from e


def get_hourly_forecast(*, lat: float, lon: float, hours: int = 24) -> List[Dict[str, Any]]:
    """
    Fetch hourly forecast from Open-Meteo.
    
    Args:
        lat: Latitude
        lon: Longitude
        hours: Number of hours to forecast (1-168, i.e., up to 7 days)
        
    Returns:
        List of hourly forecast dicts, each containing:
            - time: ISO timestamp
            - visibility_m: Visibility in meters
            - cloudcover_pct: Cloud cover percentage (0-100)
            - precipitation_mm: Precipitation in millimeters
            - wind_speed_kt: Wind speed in knots
            
    Raises:
        OpenMeteoError: If request fails or hours is out of range
        
    Example:
        >>> forecast = get_hourly_forecast(lat=37.7749, lon=-122.4194, hours=12)
        >>> print(forecast[0])
        {
            'time': '2024-01-15T06:00',
            'visibility_m': 10000,
            'cloudcover_pct': 25,
            'precipitation_mm': 0.0,
            'wind_speed_kt': 8.5
        }
    """
    if hours < 1 or hours > 168:
        raise OpenMeteoError("hours must be between 1 and 168")

    params = {
        "latitude": lat,
        "longitude": lon,
        "hourly": "visibility,cloudcover,precipitation,windspeed_10m",
        "forecast_days": min(7, (hours // 24) + 2),  # Ensure enough days for requested hours
        "timezone": "UTC",
        "windspeed_unit": "kn",
    }

    try:
        resp = httpx.get(
            "https://api.open-meteo.com/v1/forecast",
            params=params,
            timeout=20
        )
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

        result: List[Dict[str, Any]] = []
        for i, t in enumerate(times[:hours]):
            result.append({
                "time": t,
                "visibility_m": vis[i] if isinstance(vis, list) and i < len(vis) else None,
                "cloudcover_pct": clouds[i] if isinstance(clouds, list) and i < len(clouds) else None,
                "precipitation_mm": precip[i] if isinstance(precip, list) and i < len(precip) else None,
                "wind_speed_kt": wind[i] if isinstance(wind, list) and i < len(wind) else None,
            })

        return result
    except httpx.HTTPStatusError as e:
        raise OpenMeteoError(f"Open-Meteo API error: {e.response.status_code}") from e
    except OpenMeteoError:
        raise
    except Exception as e:
        raise OpenMeteoError(f"Failed to fetch hourly forecast: {e}") from e


def sample_points_along_route(
    points: List[Tuple[float, float]],
    interval: int = 5
) -> List[Tuple[float, float]]:
    """
    Sample points along a route at regular intervals.
    
    Useful for reducing the number of weather API calls while still
    getting representative coverage along a flight path.
    
    Args:
        points: List of (lat, lon) coordinate tuples
        interval: Sample every Nth point (default: 5)
        
    Returns:
        Sampled list of (lat, lon) tuples
        
    Example:
        >>> route = [(37.77, -122.41), (37.78, -122.42), (37.79, -122.43), ...]
        >>> sampled = sample_points_along_route(route, interval=5)
        >>> len(sampled) < len(route)  # Fewer points
        True
    """
    return points[:: max(1, interval)]
