"""
Aviation Weather Services - Python wrapper
 
This module provides Python wrappers around the TypeScript weather services.
For Python-native applications, use this wrapper to access weather data.

For pure Python implementations without Node.js dependency, see:
- apps/flightplanner/backend/app/services/ (original implementations)

Example:
    from aviation.weather import fetch_metar_raw, flight_category
    
    # Fetch METAR
    metar = await fetch_metar_raw("KSFO")
    
    # Determine flight category
    cat = flight_category(visibility_sm=10.0, ceiling_ft=5000)
"""

from .client import (
    WeatherClient,
    fetch_metar_raw,
    fetch_metar_raws,
    parse_metar,
    flight_category,
    recommendation_for_category,
    warnings_for_conditions,
)

__all__ = [
    'WeatherClient',
    'fetch_metar_raw',
    'fetch_metar_raws',
    'parse_metar',
    'flight_category',
    'recommendation_for_category',
    'warnings_for_conditions',
]
