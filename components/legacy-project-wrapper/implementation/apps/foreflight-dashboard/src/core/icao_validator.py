"""ForeFlight compatibility adapters for the common aircraft-designator SDK.

The qualified catalog and matching behavior live in ``aviation.aircraft``.
This module preserves the dashboard's established API and response shapes.
"""

from typing import Dict, Optional, Set

from aviation.aircraft import (
    ADDITIONAL_SUPPORTED_TYPE_DESIGNATORS,
    AIRCRAFT_TYPE_DESIGNATORS,
    AIRCRAFT_TYPE_DESIGNATOR_SEARCH_URL,
    aircraft_type_designator_catalog_summary,
    aircraft_type_designator_validation_message,
    aircraft_type_designators_by_manufacturer,
    find_aircraft_type_designator,
    is_supported_aircraft_type_designator,
    suggest_aircraft_type_designators,
)

ICAO_SEARCH_URL = AIRCRAFT_TYPE_DESIGNATOR_SEARCH_URL

# Backward-compatible read-only snapshots for callers that still inspect these
# names. Domain ownership remains in aviation.aircraft.
VALID_ICAO_CODES: Dict[str, Dict[str, str]] = {
    code: {
        "manufacturer": record.manufacturer,
        "model": record.model,
        "category": record.category,
    }
    for code, record in AIRCRAFT_TYPE_DESIGNATORS.items()
}
ADDITIONAL_VALID_CODES: Set[str] = set(ADDITIONAL_SUPPORTED_TYPE_DESIGNATORS)
ALL_VALID_CODES = set(VALID_ICAO_CODES) | ADDITIONAL_VALID_CODES


def is_valid_icao_code(code: str) -> bool:
    """Preserve the dashboard API for SDK-snapshot membership."""

    return is_supported_aircraft_type_designator(code)


def get_icao_info(code: str) -> Optional[Dict[str, str]]:
    record = find_aircraft_type_designator(code)
    if record is None:
        return None
    return {
        "manufacturer": record.manufacturer,
        "model": record.model,
        "category": record.category,
    }


def suggest_similar_codes(code: str, max_suggestions: int = 5) -> list[str]:
    return suggest_aircraft_type_designators(code, max_suggestions)


def get_all_codes_by_manufacturer(manufacturer: str) -> list[str]:
    return aircraft_type_designators_by_manufacturer(manufacturer)


def get_validation_summary() -> Dict[str, object]:
    summary = aircraft_type_designator_catalog_summary()
    return {
        "total_codes": summary["totalCodes"],
        "detailed_codes": summary["detailedCodes"],
        "additional_codes": summary["additionalCodes"],
        "categories": summary["categories"],
        "manufacturers_count": summary["manufacturersCount"],
    }


def get_validation_error_message(code: str) -> str:
    return aircraft_type_designator_validation_message(code)


ICAO_RESOURCES = {
    "official_database": ICAO_SEARCH_URL,
    "searchable_database": ICAO_SEARCH_URL,
    "skybrary_reference": "https://skybrary.aero/aircraft-types",
}
