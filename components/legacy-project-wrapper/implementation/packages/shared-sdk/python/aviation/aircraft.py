"""Portable aircraft operating profiles shared by Aviation applications."""

from __future__ import annotations

import math
import re
from dataclasses import dataclass
from types import MappingProxyType
from typing import Any, Mapping

_TYPE_DESIGNATOR_ROWS = """C150|Cessna|150|Light Single-Engine
C152|Cessna|152|Light Single-Engine
C162|Cessna|162 Skycatcher|Light Single-Engine
C172|Cessna|172 Skyhawk|Light Single-Engine
C175|Cessna|175|Light Single-Engine
C177|Cessna|177 Cardinal|Light Single-Engine
C180|Cessna|180|Light Single-Engine
C182|Cessna|182 Skylane|Light Single-Engine
C185|Cessna|185|Light Single-Engine
C206|Cessna|206|Light Single-Engine
C207|Cessna|207|Light Single-Engine
C208|Cessna|208 Caravan|Light Turboprop
C210|Cessna|210 Centurion|Light Single-Engine
C310|Cessna|310|Light Twin-Engine
C337|Cessna|337 Skymaster|Light Twin-Engine
C340|Cessna|340|Light Twin-Engine
C402|Cessna|402|Light Twin-Engine
C414|Cessna|414|Light Twin-Engine
C421|Cessna|421|Light Twin-Engine
C441|Cessna|441 Conquest|Light Turboprop
C500|Cessna|Citation I|Light Jet
C525|Cessna|CitationJet|Light Jet
C550|Cessna|Citation II|Light Jet
C560|Cessna|Citation V|Light Jet
C650|Cessna|Citation III|Mid-Size Jet
C680|Cessna|Citation Sovereign|Mid-Size Jet
C750|Cessna|Citation X|Large Jet
PA18|Piper|J-3 Cub|Light Single-Engine
PA20|Piper|Pacer|Light Single-Engine
PA22|Piper|Tri-Pacer|Light Single-Engine
PA24|Piper|Comanche|Light Single-Engine
PA25|Piper|Pawnee|Agricultural
PA28|Piper|Cherokee/Warrior/Archer|Light Single-Engine
PA30|Piper|Twin Comanche|Light Twin-Engine
PA31|Piper|Navajo|Light Twin-Engine
PA32|Piper|Cherokee Six/Saratoga|Light Single-Engine
PA34|Piper|Seneca|Light Twin-Engine
PA36|Piper|Pawnee Brave|Agricultural
PA38|Piper|Tomahawk|Light Single-Engine
PA44|Piper|Seminole|Light Twin-Engine
PA46|Piper|Malibu/Mirage/Matrix|Light Single-Engine
B190|Beechcraft|King Air 100|Light Turboprop
B200|Beechcraft|King Air 200|Light Turboprop
B300|Beechcraft|King Air 350|Light Turboprop
BE20|Beechcraft|King Air|Light Turboprop
BE23|Beechcraft|Musketeer/Sundowner|Light Single-Engine
BE24|Beechcraft|Sierra|Light Single-Engine
BE33|Beechcraft|Debonair/Bonanza|Light Single-Engine
BE35|Beechcraft|Bonanza|Light Single-Engine
BE36|Beechcraft|Bonanza A36|Light Single-Engine
BE40|Beechcraft|Beechjet 400|Light Jet
BE55|Beechcraft|Baron|Light Twin-Engine
BE58|Beechcraft|Baron|Light Twin-Engine
BE76|Beechcraft|Duchess|Light Twin-Engine
BE77|Beechcraft|Skipper|Light Single-Engine
BE9L|Beechcraft|King Air 90|Light Turboprop
BE9T|Beechcraft|King Air 90|Light Turboprop
SR20|Cirrus|SR20|Light Single-Engine
SR22|Cirrus|SR22|Light Single-Engine
SF50|Cirrus|Vision Jet|Light Jet
DA20|Diamond|Katana|Light Single-Engine
DA40|Diamond|Diamond Star|Light Single-Engine
DA42|Diamond|Twin Star|Light Twin-Engine
DA62|Diamond|DA62|Light Twin-Engine
CH7A|American Champion|7ECA Citabria|Aerobatic
CH7B|American Champion|7GCAA Citabria|Aerobatic
CH7C|American Champion|7GCBC Citabria|Aerobatic
CH7E|American Champion|7ECA Citabria|Aerobatic
CH7G|American Champion|7GCAA Citabria|Aerobatic
CH7K|American Champion|7KCAB Citabria|Aerobatic
CH8A|American Champion|8KCAB Decathlon|Aerobatic
CH8G|American Champion|8GCBC Scout|Light Single-Engine
BL8|American Champion|8KCAB Decathlon|Aerobatic
M20C|Mooney|M20C Ranger|Light Single-Engine
M20E|Mooney|M20E Super 21|Light Single-Engine
M20F|Mooney|M20F Executive 21|Light Single-Engine
M20J|Mooney|M20J 201|Light Single-Engine
M20K|Mooney|M20K 231|Light Single-Engine
M20M|Mooney|M20M TLS|Light Single-Engine
M20R|Mooney|M20R Ovation|Light Single-Engine
M20S|Mooney|M20S Eagle|Light Single-Engine
M20T|Mooney|M20T Acclaim|Light Single-Engine
AA1|Grumman|AA-1 Yankee|Light Single-Engine
AA1A|Grumman|AA-1A Trainer|Light Single-Engine
AA1B|Grumman|AA-1B Trainer|Light Single-Engine
AA1C|Grumman|AA-1C Lynx|Light Single-Engine
AA5A|Grumman|AA-5A Cheetah|Light Single-Engine
AA5B|Grumman|AA-5B Tiger|Light Single-Engine
AG5B|American General|AG-5B Tiger|Light Single-Engine
RV3|Van's|RV-3|Experimental
RV4|Van's|RV-4|Experimental
RV6|Van's|RV-6|Experimental
RV7|Van's|RV-7|Experimental
RV8|Van's|RV-8|Experimental
RV9|Van's|RV-9|Experimental
RV10|Van's|RV-10|Experimental
RV12|Van's|RV-12|Light Sport
RV14|Van's|RV-14|Experimental
M4|Maule|M-4|Light Single-Engine
M5|Maule|M-5|Light Single-Engine
M6|Maule|M-6|Light Single-Engine
M7|Maule|M-7|Light Single-Engine
M8|Maule|M-8|Light Single-Engine
M9|Maule|M-9|Light Single-Engine
TBM7|Socata|TBM 700|Light Turboprop
TBM8|Socata|TBM 800|Light Turboprop
TBM9|Daher|TBM 900|Light Turboprop
TB10|Socata|TB 10 Tobago|Light Single-Engine
TB20|Socata|TB 20 Trinidad|Light Single-Engine
TB21|Socata|TB 21 Trinidad TC|Light Single-Engine
EA30|Extra|EA-300|Aerobatic
EA32|Extra|EA-330|Aerobatic
PTS1|Pitts|S-1 Special|Aerobatic
PTS2|Pitts|S-2 Special|Aerobatic
ASK13|Alexander Schleicher|ASK 13|Glider
ASK21|Alexander Schleicher|ASK 21|Glider
K21|Alexander Schleicher|ASK 21|Glider
SGS233|Schweizer|SGS 2-33|Glider
SGS126|Schweizer|SGS 1-26|Glider
CTLS|Flight Design|CT-LS|Light Sport
FK9|FK Lightplanes|FK9|Light Sport
RANS|RANS|S-6ES Coyote II|Light Sport
BT-13|Vultee|BT-13 Valiant|Vintage Trainer
BT13|Vultee|BT-13 Valiant|Vintage Trainer
T6|North American/Beechcraft|T-6 Texan/Harvard|Military Trainer
T-6|North American/Beechcraft|T-6 Texan/Harvard|Military Trainer
AT6|North American|AT-6 Texan|Military Trainer
R22|Robinson|R22|Helicopter
R44|Robinson|R44|Helicopter
R66|Robinson|R66|Helicopter
H269|Hughes/Schweizer|269/300|Helicopter
S300|Schweizer|S-300|Helicopter
B737|Boeing|737|Commercial Jet
B738|Boeing|737-800|Commercial Jet
B739|Boeing|737-900|Commercial Jet
B752|Boeing|757-200|Commercial Jet
B763|Boeing|767-300|Commercial Jet
B772|Boeing|777-200|Commercial Jet
B773|Boeing|777-300|Commercial Jet
B787|Boeing|787 Dreamliner|Commercial Jet
A319|Airbus|A319|Commercial Jet
A320|Airbus|A320|Commercial Jet
A321|Airbus|A321|Commercial Jet
A330|Airbus|A330|Commercial Jet
A350|Airbus|A350|Commercial Jet
E145|Embraer|ERJ 145|Regional Jet
E170|Embraer|E-Jet 170|Regional Jet
E175|Embraer|E-Jet 175|Regional Jet
CRJ2|Bombardier|CRJ-200|Regional Jet
CRJ7|Bombardier|CRJ-700|Regional Jet
CRJ9|Bombardier|CRJ-900|Regional Jet
DH8A|De Havilland|Dash 8-100|Regional Turboprop
DH8B|De Havilland|Dash 8-200|Regional Turboprop
DH8C|De Havilland|Dash 8-300|Regional Turboprop
DH8D|De Havilland|Dash 8-400|Regional Turboprop
AT72|ATR|ATR 72|Regional Turboprop
AT42|ATR|ATR 42|Regional Turboprop"""

_ADDITIONAL_SUPPORTED_TYPE_DESIGNATORS = (
    "A10", "AN2", "C130", "DHC2", "DHC3", "DHC6", "F16",
    "F18", "KC135", "L39", "P51", "T28", "T34",
)

_ICAO_TYPE_DESIGNATOR = re.compile(r"^[A-Z0-9]{2,4}$")


def _require_text(name: str, value: str) -> None:
    if not value.strip():
        raise ValueError(f"{name} must be provided")


def _require_positive(name: str, value: float) -> None:
    if not math.isfinite(value) or value <= 0:
        raise ValueError(f"{name} must be positive and finite")


@dataclass(frozen=True)
class AirspeedOperatingLimits:
    vso_kias: float
    vs_kias: float
    vfe_kias: float
    va_kias: float
    vno_kias: float
    vne_kias: float

    def __post_init__(self) -> None:
        for name, value in self.__dict__.items():
            _require_positive(name, value)
        if self.vso_kias > self.vs_kias:
            raise ValueError("vso_kias must be less than or equal to vs_kias")
        if self.vs_kias >= self.va_kias:
            raise ValueError("vs_kias must be less than va_kias")
        if self.va_kias > self.vno_kias:
            raise ValueError("va_kias must be less than or equal to vno_kias")
        if self.vno_kias >= self.vne_kias:
            raise ValueError("vno_kias must be less than vne_kias")
        if not self.vso_kias < self.vfe_kias < self.vne_kias:
            raise ValueError("vfe_kias must fall between vso_kias and vne_kias")


@dataclass(frozen=True)
class AircraftFuelLimits:
    total_capacity_gal: float
    usable_capacity_gal: float

    def __post_init__(self) -> None:
        _require_positive("total_capacity_gal", self.total_capacity_gal)
        _require_positive("usable_capacity_gal", self.usable_capacity_gal)
        if self.usable_capacity_gal > self.total_capacity_gal:
            raise ValueError("usable_capacity_gal must not exceed total_capacity_gal")


@dataclass(frozen=True)
class AircraftWeightLimits:
    maximum_takeoff_weight_lb: float

    def __post_init__(self) -> None:
        _require_positive("maximum_takeoff_weight_lb", self.maximum_takeoff_weight_lb)


@dataclass(frozen=True)
class AircraftDimensions:
    length_ft: float
    height_ft: float
    wingspan_ft: float

    def __post_init__(self) -> None:
        for name, value in self.__dict__.items():
            _require_positive(name, value)


@dataclass(frozen=True)
class AircraftReferencePerformance:
    maximum_cruise_speed_ktas: float
    maximum_climb_rate_fpm: float
    service_ceiling_ft: float
    takeoff_ground_roll_ft: float
    takeoff_distance_ft: float
    landing_ground_roll_ft: float
    landing_distance_ft: float

    def __post_init__(self) -> None:
        for name, value in self.__dict__.items():
            _require_positive(name, value)


@dataclass(frozen=True)
class AircraftOperatingProfile:
    profile_id: str
    icao_type_designator: str
    manufacturer: str
    model: str
    display_name: str
    airspeed_limits: AirspeedOperatingLimits
    fuel_limits: AircraftFuelLimits
    weight_limits: AircraftWeightLimits
    dimensions: AircraftDimensions
    reference_performance: AircraftReferencePerformance

    def __post_init__(self) -> None:
        _require_text("profile_id", self.profile_id)
        if not _ICAO_TYPE_DESIGNATOR.fullmatch(self.icao_type_designator):
            raise ValueError(
                "icao_type_designator must be 2-4 uppercase alphanumeric characters"
            )
        _require_text("manufacturer", self.manufacturer)
        _require_text("model", self.model)
        _require_text("display_name", self.display_name)


def aircraft_operating_profile_from_mapping(
    value: Mapping[str, Any],
) -> AircraftOperatingProfile:
    """Validate and construct a profile from the portable JSON record."""

    airspeed = value["airspeedLimits"]
    fuel = value["fuelLimits"]
    weight = value["weightLimits"]
    dimensions = value["dimensions"]
    performance = value["referencePerformance"]
    return AircraftOperatingProfile(
        profile_id=value["profileId"],
        icao_type_designator=value["icaoTypeDesignator"],
        manufacturer=value["manufacturer"],
        model=value["model"],
        display_name=value["displayName"],
        airspeed_limits=AirspeedOperatingLimits(
            vso_kias=airspeed["vsoKias"],
            vs_kias=airspeed["vsKias"],
            vfe_kias=airspeed["vfeKias"],
            va_kias=airspeed["vaKias"],
            vno_kias=airspeed["vnoKias"],
            vne_kias=airspeed["vneKias"],
        ),
        fuel_limits=AircraftFuelLimits(
            total_capacity_gal=fuel["totalCapacityGal"],
            usable_capacity_gal=fuel["usableCapacityGal"],
        ),
        weight_limits=AircraftWeightLimits(
            maximum_takeoff_weight_lb=weight["maximumTakeoffWeightLb"],
        ),
        dimensions=AircraftDimensions(
            length_ft=dimensions["lengthFt"],
            height_ft=dimensions["heightFt"],
            wingspan_ft=dimensions["wingspanFt"],
        ),
        reference_performance=AircraftReferencePerformance(
            maximum_cruise_speed_ktas=performance["maximumCruiseSpeedKtas"],
            maximum_climb_rate_fpm=performance["maximumClimbRateFpm"],
            service_ceiling_ft=performance["serviceCeilingFt"],
            takeoff_ground_roll_ft=performance["takeoffGroundRollFt"],
            takeoff_distance_ft=performance["takeoffDistanceFt"],
            landing_ground_roll_ft=performance["landingGroundRollFt"],
            landing_distance_ft=performance["landingDistanceFt"],
        ),
    )


C172S_OPERATING_PROFILE = AircraftOperatingProfile(
    profile_id="cessna-172s",
    icao_type_designator="C172",
    manufacturer="Cessna",
    model="172S",
    display_name="Cessna 172S Skyhawk",
    airspeed_limits=AirspeedOperatingLimits(
        vso_kias=40,
        vs_kias=48,
        vfe_kias=85,
        va_kias=105,
        vno_kias=129,
        vne_kias=163,
    ),
    fuel_limits=AircraftFuelLimits(
        total_capacity_gal=56,
        usable_capacity_gal=53,
    ),
    weight_limits=AircraftWeightLimits(maximum_takeoff_weight_lb=2550),
    dimensions=AircraftDimensions(
        length_ft=27.1666666667,
        height_ft=8.9166666667,
        wingspan_ft=36.0833333333,
    ),
    reference_performance=AircraftReferencePerformance(
        maximum_cruise_speed_ktas=124,
        maximum_climb_rate_fpm=730,
        service_ceiling_ft=14000,
        takeoff_ground_roll_ft=960,
        takeoff_distance_ft=1630,
        landing_ground_roll_ft=575,
        landing_distance_ft=1335,
    ),
)

C182T_OPERATING_PROFILE = AircraftOperatingProfile(
    profile_id="cessna-182t",
    icao_type_designator="C182",
    manufacturer="Cessna",
    model="182T",
    display_name="Cessna 182T Skylane",
    airspeed_limits=AirspeedOperatingLimits(
        vso_kias=41,
        vs_kias=51,
        vfe_kias=100,
        va_kias=110,
        vno_kias=140,
        vne_kias=175,
    ),
    fuel_limits=AircraftFuelLimits(
        total_capacity_gal=92,
        usable_capacity_gal=87,
    ),
    weight_limits=AircraftWeightLimits(maximum_takeoff_weight_lb=3100),
    dimensions=AircraftDimensions(
        length_ft=29,
        height_ft=9.3333333333,
        wingspan_ft=36,
    ),
    reference_performance=AircraftReferencePerformance(
        maximum_cruise_speed_ktas=145,
        maximum_climb_rate_fpm=924,
        service_ceiling_ft=18100,
        takeoff_ground_roll_ft=795,
        takeoff_distance_ft=1514,
        landing_ground_roll_ft=590,
        landing_distance_ft=1350,
    ),
)

SR22_PERSPECTIVE_3600_OPERATING_PROFILE = AircraftOperatingProfile(
    profile_id="cirrus-sr22-perspective-3600",
    icao_type_designator="SR22",
    manufacturer="Cirrus Aircraft",
    model="SR22 Perspective 3600 lb",
    display_name="Cirrus SR22 Perspective",
    airspeed_limits=AirspeedOperatingLimits(
        vso_kias=64,
        vs_kias=74,
        vfe_kias=110,
        va_kias=140,
        vno_kias=176,
        vne_kias=205,
    ),
    fuel_limits=AircraftFuelLimits(
        total_capacity_gal=94.5,
        usable_capacity_gal=92,
    ),
    weight_limits=AircraftWeightLimits(maximum_takeoff_weight_lb=3600),
    dimensions=AircraftDimensions(
        length_ft=26,
        height_ft=8.9166666667,
        wingspan_ft=38.3333333333,
    ),
    reference_performance=AircraftReferencePerformance(
        maximum_cruise_speed_ktas=183,
        maximum_climb_rate_fpm=1270,
        service_ceiling_ft=17500,
        takeoff_ground_roll_ft=1082,
        takeoff_distance_ft=1868,
        landing_ground_roll_ft=1178,
        landing_distance_ft=2535,
    ),
)

_OPERATING_PROFILES = (
    C172S_OPERATING_PROFILE,
    C182T_OPERATING_PROFILE,
    SR22_PERSPECTIVE_3600_OPERATING_PROFILE,
)


def _normalize_identity_part(value: str) -> str:
    return " ".join(value.split()).casefold()


def find_aircraft_operating_profile(
    identifier: str,
) -> AircraftOperatingProfile | None:
    """Resolve a bundled profile by stable ID or ICAO designator."""

    query = identifier.strip()
    designator = query.upper()
    return next(
        (
            profile
            for profile in _OPERATING_PROFILES
            if profile.profile_id == query or profile.icao_type_designator == designator
        ),
        None,
    )


def match_aircraft_operating_profile(
    manufacturer: str,
    model: str,
) -> AircraftOperatingProfile | None:
    """Match an exact manufacturer/model identity after case/space normalization.

    Both fields are required. Partial and model-only matches fail closed so an
    application cannot silently attach reference limits to the wrong aircraft.
    """

    normalized_manufacturer = _normalize_identity_part(manufacturer)
    normalized_model = _normalize_identity_part(model)
    if not normalized_manufacturer or not normalized_model:
        return None
    return next(
        (
            profile
            for profile in _OPERATING_PROFILES
            if _normalize_identity_part(profile.manufacturer) == normalized_manufacturer
            and _normalize_identity_part(profile.model) == normalized_model
        ),
        None,
    )


@dataclass(frozen=True)
class AircraftTypeDesignatorRecord:
    """A qualified record in the SDK's bundled type-designator snapshot."""

    code: str
    manufacturer: str
    model: str
    category: str


AIRCRAFT_TYPE_DESIGNATOR_SEARCH_URL = (
    "https://www.icao.int/operational-safety/doc-8643-aircraft-type-designators/search"
)

AIRCRAFT_TYPE_DESIGNATORS = MappingProxyType(
    {
        code: AircraftTypeDesignatorRecord(
            code=code,
            manufacturer=manufacturer,
            model=model,
            category=category,
        )
        for code, manufacturer, model, category in (
            row.split("|") for row in _TYPE_DESIGNATOR_ROWS.splitlines()
        )
    }
)
ADDITIONAL_SUPPORTED_TYPE_DESIGNATORS = frozenset(
    _ADDITIONAL_SUPPORTED_TYPE_DESIGNATORS
)
_SUPPORTED_TYPE_DESIGNATORS = frozenset(AIRCRAFT_TYPE_DESIGNATORS) | (
    ADDITIONAL_SUPPORTED_TYPE_DESIGNATORS
)


def _normalize_type_designator(code: str | None) -> str:
    return code.strip().upper() if code else ""


def is_supported_aircraft_type_designator(code: str | None) -> bool:
    """Return whether ``code`` appears in the qualified bundled snapshot.

    The result is not a claim that the snapshot is a complete or current
    substitute for ICAO Doc 8643.
    """

    return _normalize_type_designator(code) in _SUPPORTED_TYPE_DESIGNATORS


def find_aircraft_type_designator(
    code: str | None,
) -> AircraftTypeDesignatorRecord | None:
    """Return detailed metadata, excluding additional-only supported codes."""

    return AIRCRAFT_TYPE_DESIGNATORS.get(_normalize_type_designator(code))


def suggest_aircraft_type_designators(code: str | None, maximum: int = 5) -> list[str]:
    """Return deterministic suggestions, prioritizing two-character prefixes."""

    query = _normalize_type_designator(code)
    if not query or maximum <= 0:
        return []
    candidates = sorted(_SUPPORTED_TYPE_DESIGNATORS)
    prefix = (
        [candidate for candidate in candidates if candidate.startswith(query[:2])]
        if len(query) >= 2
        else []
    )
    prefix_set = set(prefix)
    query_characters = set(query)
    fuzzy = [
        candidate
        for candidate in candidates
        if candidate not in prefix_set
        and abs(len(candidate) - len(query)) <= 1
        and len(query_characters & set(candidate)) >= len(query) // 2
    ]
    return (prefix + fuzzy)[:maximum]


def aircraft_type_designators_by_manufacturer(manufacturer: str) -> list[str]:
    query = manufacturer.strip().casefold()
    if not query:
        return []
    return sorted(
        record.code
        for record in AIRCRAFT_TYPE_DESIGNATORS.values()
        if record.manufacturer.casefold() == query
    )


def aircraft_type_designator_catalog_summary() -> dict[str, object]:
    categories: dict[str, int] = {}
    manufacturers: set[str] = set()
    for record in AIRCRAFT_TYPE_DESIGNATORS.values():
        categories[record.category] = categories.get(record.category, 0) + 1
        manufacturers.add(record.manufacturer)
    return {
        "totalCodes": len(_SUPPORTED_TYPE_DESIGNATORS),
        "detailedCodes": len(AIRCRAFT_TYPE_DESIGNATORS),
        "additionalCodes": len(ADDITIONAL_SUPPORTED_TYPE_DESIGNATORS),
        "categories": dict(sorted(categories.items())),
        "manufacturersCount": len(manufacturers),
    }


def aircraft_type_designator_validation_message(code: str | None) -> str:
    normalized = _normalize_type_designator(code)
    if not normalized:
        return "Missing ICAO aircraft type code"
    message = f"Invalid ICAO aircraft type code: '{normalized}'"
    suggestions = suggest_aircraft_type_designators(normalized)
    if suggestions:
        message += f". Similar codes: {', '.join(suggestions)}"
    return (
        f"{message}. Verify in ICAO Doc 8643: "
        f"{AIRCRAFT_TYPE_DESIGNATOR_SEARCH_URL}"
    )


__all__ = [
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
]
