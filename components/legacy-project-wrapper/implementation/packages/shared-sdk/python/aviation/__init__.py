"""Aviation SDK - Python wrapper for shared aviation utilities."""

__version__ = "0.8.0"

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
    ADDITIONAL_SUPPORTED_TYPE_DESIGNATORS,
    AIRCRAFT_TYPE_DESIGNATORS,
    AIRCRAFT_TYPE_DESIGNATOR_SEARCH_URL,
    AircraftDimensions,
    AircraftFuelLimits,
    AircraftOperatingProfile,
    AircraftReferencePerformance,
    AircraftWeightLimits,
    AircraftTypeDesignatorRecord,
    AirspeedOperatingLimits,
    C172S_OPERATING_PROFILE,
    C182T_OPERATING_PROFILE,
    SR22_PERSPECTIVE_3600_OPERATING_PROFILE,
    aircraft_operating_profile_from_mapping,
    aircraft_type_designator_catalog_summary,
    aircraft_type_designator_validation_message,
    aircraft_type_designators_by_manufacturer,
    find_aircraft_type_designator,
    find_aircraft_operating_profile,
    match_aircraft_operating_profile,
    is_supported_aircraft_type_designator,
    suggest_aircraft_type_designators,
)
from .logbook import (
    LOGBOOK_PILOT_ROLES,
    LogbookTimeInput,
    LogbookTimeValidationResult,
    LogbookValidationIssue,
    validate_logbook_time,
)
from .notam import (
    Notam,
    NotamValidationError,
    categorize_notam,
    categorize_notam_severity,
    filter_relevant_notams,
    format_notam_text,
    is_notam_effective,
    normalize_notam_record,
    sort_notams_by_severity,
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
    "ADDITIONAL_SUPPORTED_TYPE_DESIGNATORS",
    "AIRCRAFT_TYPE_DESIGNATORS",
    "AIRCRAFT_TYPE_DESIGNATOR_SEARCH_URL",
    "AircraftDimensions",
    "AircraftFuelLimits",
    "AircraftOperatingProfile",
    "AircraftReferencePerformance",
    "AircraftWeightLimits",
    "AircraftTypeDesignatorRecord",
    "AirspeedOperatingLimits",
    "C172S_OPERATING_PROFILE",
    "C182T_OPERATING_PROFILE",
    "SR22_PERSPECTIVE_3600_OPERATING_PROFILE",
    "aircraft_operating_profile_from_mapping",
    "aircraft_type_designator_catalog_summary",
    "aircraft_type_designator_validation_message",
    "aircraft_type_designators_by_manufacturer",
    "find_aircraft_type_designator",
    "find_aircraft_operating_profile",
    "match_aircraft_operating_profile",
    "is_supported_aircraft_type_designator",
    "suggest_aircraft_type_designators",
    # Logbook validation
    "LOGBOOK_PILOT_ROLES",
    "LogbookTimeInput",
    "LogbookTimeValidationResult",
    "LogbookValidationIssue",
    "validate_logbook_time",
    # NOTAM record semantics
    "Notam",
    "NotamValidationError",
    "categorize_notam",
    "categorize_notam_severity",
    "filter_relevant_notams",
    "format_notam_text",
    "is_notam_effective",
    "normalize_notam_record",
    "sort_notams_by_severity",
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
