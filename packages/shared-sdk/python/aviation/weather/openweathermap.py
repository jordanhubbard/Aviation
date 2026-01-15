"""
OpenWeatherMap API Client

Fetches current weather data from OpenWeatherMap.org for a given location.
Requires an API key set in the environment variable OPENWEATHERMAP_API_KEY.
"""

from __future__ import annotations

import os
from typing import Any, Dict, Optional

import httpx


class OpenWeatherMapError(RuntimeError):
    """Exception raised when OpenWeatherMap API requests fail."""
    pass


def get_current_weather(*, lat: float, lon: float, api_key: Optional[str] = None) -> Dict[str, Any]:
    """
    Fetch current weather from OpenWeatherMap.
    
    Args:
        lat: Latitude
        lon: Longitude
        api_key: OpenWeatherMap API key (defaults to OPENWEATHERMAP_API_KEY env var)
        
    Returns:
        Dict containing current weather data from OpenWeatherMap API
        
    Raises:
        OpenWeatherMapError: If API key is missing or request fails
        
    Example:
        >>> weather = get_current_weather(lat=37.7749, lon=-122.4194)
        >>> print(weather['main']['temp'])  # Temperature in Fahrenheit
        65.5
    """
    key = api_key or os.environ.get("OPENWEATHERMAP_API_KEY") or os.environ.get("OPENWEATHER_API_KEY")
    if not key:
        raise OpenWeatherMapError("Missing OPENWEATHERMAP_API_KEY for OpenWeatherMap requests")

    params = {
        "lat": lat,
        "lon": lon,
        "appid": key,
        "units": "imperial",  # Fahrenheit, mph
    }

    try:
        resp = httpx.get(
            "https://api.openweathermap.org/data/2.5/weather",
            params=params,
            timeout=20
        )
        resp.raise_for_status()
        return resp.json()
    except httpx.HTTPStatusError as e:
        raise OpenWeatherMapError(f"OpenWeatherMap API error: {e.response.status_code}") from e
    except Exception as e:
        raise OpenWeatherMapError(f"Failed to fetch weather data: {e}") from e


def to_weather_data(airport_code: str, payload: Dict[str, Any]) -> Dict[str, Any]:
    """
    Convert OpenWeatherMap API response to standardized weather data format.
    
    Args:
        airport_code: Airport identifier for the location
        payload: Raw response from OpenWeatherMap API
        
    Returns:
        Dict with standardized weather data:
            - airport: Airport code
            - conditions: Weather description
            - temperature: Temperature in Fahrenheit
            - wind_speed: Wind speed in knots
            - wind_direction: Wind direction in degrees
            - visibility: Visibility in statute miles
            - ceiling: Estimated ceiling in feet AGL
            - metar: Empty string (not provided by OpenWeatherMap)
            
    Example:
        >>> raw = get_current_weather(lat=37.7749, lon=-122.4194)
        >>> weather = to_weather_data('KSFO', raw)
        >>> print(weather)
        {
            'airport': 'KSFO',
            'conditions': 'clear sky',
            'temperature': 65,
            'wind_speed': 13,
            'wind_direction': 280,
            'visibility': 6.2,
            'ceiling': 10000,
            'metar': ''
        }
    """
    # Extract nested data safely
    weather = payload.get("weather")
    wx0 = weather[0] if isinstance(weather, list) and weather else {}
    main = payload.get("main") if isinstance(payload.get("main"), dict) else {}
    wind = payload.get("wind") if isinstance(payload.get("wind"), dict) else {}
    clouds = payload.get("clouds") if isinstance(payload.get("clouds"), dict) else {}

    # Temperature (already in Fahrenheit)
    temp_f = float(main.get("temp") or 0.0)
    
    # Wind (convert mph to knots)
    wind_speed_mph = wind.get("speed")
    wind_speed_kt = _mph_to_knots(wind_speed_mph)
    wind_dir = int(wind.get("deg") or 0)
    
    # Visibility (convert meters to statute miles)
    vis_m = payload.get("visibility")
    vis_sm = _meters_to_sm(vis_m)
    
    # Ceiling (estimate from cloud cover percentage)
    cloud_pct = clouds.get("all")
    ceiling_ft = _estimate_ceiling_ft(cloud_pct)

    # Weather conditions description
    conditions = str(wx0.get("description") or wx0.get("main") or "Unknown")

    return {
        "airport": airport_code.upper(),
        "conditions": conditions,
        "temperature": round(temp_f),
        "wind_speed": round(wind_speed_kt),
        "wind_direction": wind_dir,
        "visibility": round(vis_sm, 1),
        "ceiling": round(ceiling_ft),
        "metar": "",  # OpenWeatherMap doesn't provide METAR
    }


def _mph_to_knots(mph: Optional[float]) -> float:
    """Convert miles per hour to knots."""
    if mph is None:
        return 0.0
    return float(mph) * 0.868976


def _meters_to_sm(meters: Optional[float]) -> float:
    """Convert meters to statute miles."""
    if meters is None:
        return 0.0
    return float(meters) / 1609.34


def _estimate_ceiling_ft(cloud_pct: Optional[float]) -> float:
    """
    Estimate ceiling from cloud cover percentage.
    
    This is a rough heuristic when actual ceiling data is unavailable.
    """
    if cloud_pct is None:
        return 10000.0
    
    pct = float(cloud_pct)
    if pct >= 75:
        return 1500.0  # Overcast
    if pct >= 50:
        return 3000.0  # Broken
    if pct >= 25:
        return 5000.0  # Scattered
    return 10000.0  # Few/clear
