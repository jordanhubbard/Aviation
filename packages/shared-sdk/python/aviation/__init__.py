<<<<<<< HEAD
"""Aviation SDK - Python wrapper for shared aviation utilities."""

__version__ = "0.2.0"

# Import sub-packages for convenient access
from . import weather
from . import integrations

__all__ = ['weather', 'integrations']
=======
"""Aviation data services for Python applications."""

from .airports import (
    Airport,
    AirportDatabase,
    search_airports,
    get_airport_by_code,
    find_nearby_airports,
)

__all__ = [
    "Airport",
    "AirportDatabase",
    "search_airports",
    "get_airport_by_code",
    "find_nearby_airports",
]
>>>>>>> feature/extract-navigation-utils
