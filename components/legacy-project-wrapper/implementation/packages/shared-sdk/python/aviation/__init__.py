"""Aviation SDK - Python wrapper for shared aviation utilities."""

__version__ = "0.3.0"

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

from . import nav_data

from . import integrations
from .aircraft import (
    AircraftDimensions,
    AircraftFuelLimits,
    AircraftOperatingProfile,
    AircraftReferencePerformance,
    AircraftWeightLimits,
    AirspeedOperatingLimits,
    C172S_OPERATING_PROFILE,
    C182T_OPERATING_PROFILE,
    SR22_PERSPECTIVE_3600_OPERATING_PROFILE,
    aircraft_operating_profile_from_mapping,
    find_aircraft_operating_profile,
)
from .weight_balance import (
    C172S_LOADING_PROFILE,
    EnvelopePoint,
    LoadingCondition,
    LoadingInput,
    LoadingProfile,
    LoadingResult,
    LoadingStationDefinition,
    LoadingStationGroupLimit,
    calculate_load,
    find_loading_profile,
    interpolate_envelope,
    loading_profile_from_mapping,
    validate_loading_profile,
)

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
    # Aircraft profiles
    "AircraftDimensions",
    "AircraftFuelLimits",
    "AircraftOperatingProfile",
    "AircraftReferencePerformance",
    "AircraftWeightLimits",
    "AirspeedOperatingLimits",
    "C172S_OPERATING_PROFILE",
    "C182T_OPERATING_PROFILE",
    "SR22_PERSPECTIVE_3600_OPERATING_PROFILE",
    "aircraft_operating_profile_from_mapping",
    "find_aircraft_operating_profile",
    # Weight and balance
    "C172S_LOADING_PROFILE",
    "EnvelopePoint",
    "LoadingCondition",
    "LoadingInput",
    "LoadingProfile",
    "LoadingResult",
    "LoadingStationDefinition",
    "LoadingStationGroupLimit",
    "calculate_load",
    "find_loading_profile",
    "interpolate_envelope",
    "loading_profile_from_mapping",
    "validate_loading_profile",
    # Modules
    "integrations",
    "nav_data",
]

if weather is not None:
    __all__.append("weather")
