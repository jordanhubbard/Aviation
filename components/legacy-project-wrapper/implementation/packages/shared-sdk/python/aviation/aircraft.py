"""Portable aircraft operating profiles shared by Aviation applications."""

from __future__ import annotations

import math
import re
from dataclasses import dataclass
from typing import Any, Mapping

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
    takeoff_distance_ft: float
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
            takeoff_distance_ft=performance["takeoffDistanceFt"],
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
        takeoff_distance_ft=1630,
        landing_distance_ft=1335,
    ),
)

_OPERATING_PROFILES = (C172S_OPERATING_PROFILE,)


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
            if profile.profile_id == query
            or profile.icao_type_designator == designator
        ),
        None,
    )


__all__ = [
    "AircraftDimensions",
    "AircraftFuelLimits",
    "AircraftOperatingProfile",
    "AircraftReferencePerformance",
    "AircraftWeightLimits",
    "AirspeedOperatingLimits",
    "C172S_OPERATING_PROFILE",
    "aircraft_operating_profile_from_mapping",
    "find_aircraft_operating_profile",
]
