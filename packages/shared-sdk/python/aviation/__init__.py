"""Aviation SDK - Python wrapper for shared aviation utilities."""

__version__ = "0.2.0"

# Airport services
from .airports import (
    Airport,
    AirportDatabase,
    get_airport,
    search_airports,
    search_airports_advanced,
    get_airport_by_code,
    find_nearby_airports,
    haversine_distance,
    load_airport_cache,
)

# Import sub-packages for convenient access
try:
    from . import weather
except (ModuleNotFoundError, ImportError):
    weather = None

from . import integrations

__all__ = [
    # Airports
    "Airport",
    "AirportDatabase",
    "get_airport",
    "search_airports",
    "search_airports_advanced",
    "get_airport_by_code",
    "find_nearby_airports",
    "haversine_distance",
    "load_airport_cache",
    # Modules
    "integrations",
]

if weather is not None:
    __all__.append("weather")
