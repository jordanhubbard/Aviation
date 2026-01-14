"""
Aviation utilities for Python applications

Provides airport search, weather, navigation, and other aviation-specific functionality.
"""

from .airports import (
    get_airport,
    search_airports,
    search_airports_advanced,
    haversine_distance
)

__all__ = [
    "get_airport",
    "search_airports",
    "search_airports_advanced",
    "haversine_distance"
]
