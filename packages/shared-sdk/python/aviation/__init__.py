"""Aviation SDK - Python wrapper for shared aviation utilities."""

__version__ = "0.2.0"

# Airport services
from .airports import (
    Airport,
    AirportDatabase,
    search_airports,
    get_airport_by_code,
    find_nearby_airports,
)

# Import sub-packages for convenient access
from . import weather
from . import integrations

__all__ = [
    # Airports
    "Airport",
    "AirportDatabase",
    "search_airports",
    "get_airport_by_code",
    "find_nearby_airports",
    # Modules
    "weather",
    "integrations",
]
