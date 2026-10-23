"""
Aviation Weather Services - Python SDK

Comprehensive weather data services for flight planning, including:
- METAR fetching and parsing
- OpenWeatherMap current weather
- Open-Meteo forecasts (current, daily, hourly)
- Flight category determination (VFR/MVFR/IFR/LIFR)
- Weather recommendations and warnings
- Departure window scoring

This is a standalone Python implementation that does not require Node.js
or the TypeScript SDK.

Example:
    >>> from aviation.weather import fetch_metar_raw, parse_metar, flight_category
    >>> from aviation.weather import get_current_weather as get_open_meteo_current
    >>> 
    >>> # Fetch and parse METAR
    >>> metar = fetch_metar_raw("KSFO")
    >>> parsed = parse_metar(metar)
    >>> 
    >>> # Determine flight category
    >>> cat = flight_category(
    >>>     visibility_sm=parsed.get('visibility_sm'),
    >>>     ceiling_ft=parsed.get('ceiling_ft')
    >>> )
    >>> print(f"KSFO: {cat}")
    >>> 
    >>> # Get Open-Meteo forecast
    >>> weather = get_open_meteo_current(lat=37.7749, lon=-122.4194)
    >>> print(f"Temperature: {weather['temperature']}°F")
"""

# Flight Category
from .flight_category import (
    FlightCategory,
    FlightCategoryThresholds,
    DEFAULT_THRESHOLDS,
    flight_category,
    recommendation_for_category,
    warnings_for_conditions,
    meters_to_sm,
    estimate_ceiling_from_cloudcover,
    score_hour,
    best_departure_windows,
)

# METAR
from .metar import (
    fetch_metar_raw,
    fetch_metar_raws,
    parse_metar,
)

# OpenWeatherMap
from .openweathermap import (
    OpenWeatherMapError,
    get_current_weather as get_openweathermap_current,
    to_weather_data,
)

# Open-Meteo
from .open_meteo import (
    OpenMeteoError,
    get_current_weather as get_open_meteo_current,
    get_daily_forecast,
    get_hourly_forecast,
    sample_points_along_route,
)

__all__ = [
    # Types
    'FlightCategory',
    'FlightCategoryThresholds',
    'DEFAULT_THRESHOLDS',
    
    # Flight Category Functions
    'flight_category',
    'recommendation_for_category',
    'warnings_for_conditions',
    'meters_to_sm',
    'estimate_ceiling_from_cloudcover',
    'score_hour',
    'best_departure_windows',
    
    # METAR Functions
    'fetch_metar_raw',
    'fetch_metar_raws',
    'parse_metar',
    
    # OpenWeatherMap
    'OpenWeatherMapError',
    'get_openweathermap_current',
    'to_weather_data',
    
    # Open-Meteo
    'OpenMeteoError',
    'get_open_meteo_current',
    'get_daily_forecast',
    'get_hourly_forecast',
    'sample_points_along_route',
]
