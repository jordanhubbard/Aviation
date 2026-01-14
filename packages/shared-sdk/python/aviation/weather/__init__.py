"""
Weather services for aviation applications

Provides weather data and flight category calculations.

Note: Full Python API parity with TypeScript weather clients (OpenWeatherMap, 
Open-Meteo, METAR) is planned for a future release. For now, applications can:
1. Use the flight category calculations provided here
2. Use existing weather services from their app-specific modules
3. Call the TypeScript weather APIs if needed

The flight category calculations are pure functions and fully implemented.
"""

from .flight_category import (
    FlightCategory,
    STANDARD_THRESHOLDS,
    calculate_flight_category,
    get_flight_category_recommendation,
    get_flight_category_color,
    is_vfr_recommended,
    get_weather_warnings
)

__all__ = [
    'FlightCategory',
    'STANDARD_THRESHOLDS',
    'calculate_flight_category',
    'get_flight_category_recommendation',
    'get_flight_category_color',
    'is_vfr_recommended',
    'get_weather_warnings'
]
