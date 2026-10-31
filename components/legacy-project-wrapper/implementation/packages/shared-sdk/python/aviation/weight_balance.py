"""Portable aircraft loading profiles and weight-and-balance calculations."""

from __future__ import annotations

import math
from dataclasses import dataclass
from typing import Any, Mapping, Sequence

from .aircraft import AircraftOperatingProfile, C172S_OPERATING_PROFILE


def _require_text(name: str, value: str) -> None:
    if not value.strip():
        raise ValueError(f"{name} must be provided")


def _require_positive(name: str, value: float) -> None:
    if not math.isfinite(value) or value <= 0:
        raise ValueError(f"{name} must be positive and finite")


@dataclass(frozen=True)
class EnvelopePoint:
    weight: float
    forward: float
    aft: float

    def __post_init__(self) -> None:
        _require_positive("envelope weight", self.weight)
        _require_positive("forward limit", self.forward)
        _require_positive("aft limit", self.aft)
        if self.forward > self.aft:
            raise ValueError("forward limit must not exceed aft limit")


@dataclass(frozen=True)
class LoadingStationDefinition:
    station_id: str
    name: str
    arm: float
    maximum_weight: float | None = None

    def __post_init__(self) -> None:
        _require_text("station_id", self.station_id)
        _require_text("station name", self.name)
        _require_positive("station arm", self.arm)
        if self.maximum_weight is not None:
            _require_positive("station maximum_weight", self.maximum_weight)


@dataclass(frozen=True)
class LoadingStationGroupLimit:
    name: str
    station_ids: tuple[str, ...]
    maximum_weight: float

    def __post_init__(self) -> None:
        _require_text("station group name", self.name)
        if not self.station_ids:
            raise ValueError("station group must not be empty")
        _require_positive("station group maximum_weight", self.maximum_weight)


@dataclass(frozen=True)
class LoadingProfile:
    profile_id: str
    aircraft_profile_id: str
    display_name: str
    empty_weight: float
    empty_moment: float
    max_gross: float
    usable_fuel_capacity: float
    fuel_arm: float
    fuel_density: float
    stations: tuple[LoadingStationDefinition, ...]
    station_group_limits: tuple[LoadingStationGroupLimit, ...]
    envelope: tuple[EnvelopePoint, ...]

    def __post_init__(self) -> None:
        _require_text("profile_id", self.profile_id)
        _require_text("aircraft_profile_id", self.aircraft_profile_id)
        _require_text("display_name", self.display_name)
        _require_positive("empty_weight", self.empty_weight)
        _require_positive("empty_moment", self.empty_moment)
        _require_positive("max_gross", self.max_gross)
        _require_positive("usable_fuel_capacity", self.usable_fuel_capacity)
        _require_positive("fuel_arm", self.fuel_arm)
        _require_positive("fuel_density", self.fuel_density)
        if self.empty_weight > self.max_gross:
            raise ValueError("empty_weight must not exceed max_gross")
        if not self.stations:
            raise ValueError("stations must not be empty")
        station_ids = [station.station_id for station in self.stations]
        if len(set(station_ids)) != len(station_ids):
            raise ValueError("station IDs must be unique")
        known_stations = set(station_ids)
        for group in self.station_group_limits:
            if any(station_id not in known_stations for station_id in group.station_ids):
                raise ValueError(f"{group.name} must reference known stations")
        _validate_envelope(self.envelope)
        if interpolate_envelope(self.envelope, self.empty_weight) is None:
            raise ValueError("empty_weight must be represented by the loading envelope")


@dataclass(frozen=True)
class LoadingInput:
    station_weights: tuple[float, ...]
    fuel_gallons: float
    fuel_burn_gallons: float


@dataclass(frozen=True)
class LoadingCondition:
    weight: float
    cg: float
    limits: tuple[float, float] | None
    problems: tuple[str, ...]
    within_limits: bool


@dataclass(frozen=True)
class LoadingResult:
    takeoff: LoadingCondition
    landing: LoadingCondition


def _validate_envelope(envelope: Sequence[EnvelopePoint]) -> None:
    rows = sorted(envelope, key=lambda row: row.weight)
    if len(rows) < 2 or any(
        row.weight <= rows[index - 1].weight for index, row in enumerate(rows) if index
    ):
        raise ValueError(
            "Envelope must contain at least two valid rows with distinct weights"
        )


def interpolate_envelope(
    envelope: Sequence[EnvelopePoint], weight: float
) -> tuple[float, float] | None:
    """Interpolate forward and aft limits for a weight inside the envelope."""

    if not math.isfinite(weight):
        raise ValueError("weight must be finite")
    _validate_envelope(envelope)
    rows = sorted(envelope, key=lambda row: row.weight)
    if weight < rows[0].weight or weight > rows[-1].weight:
        return None
    for low, high in zip(rows, rows[1:]):
        if low.weight <= weight <= high.weight:
            ratio = (weight - low.weight) / (high.weight - low.weight)
            return (
                low.forward + ratio * (high.forward - low.forward),
                low.aft + ratio * (high.aft - low.aft),
            )
    return None


def validate_loading_profile(
    profile: LoadingProfile,
    aircraft: AircraftOperatingProfile | None = None,
) -> LoadingProfile:
    """Validate a loading profile and its optional aircraft-profile link."""

    if aircraft is not None:
        if profile.aircraft_profile_id != aircraft.profile_id:
            raise ValueError("aircraft_profile_id must match the linked aircraft profile")
        if profile.max_gross != aircraft.weight_limits.maximum_takeoff_weight_lb:
            raise ValueError("max_gross must match the linked aircraft profile")
        if profile.usable_fuel_capacity != aircraft.fuel_limits.usable_capacity_gal:
            raise ValueError(
                "usable_fuel_capacity must match the linked aircraft profile"
            )
    return profile


def loading_profile_from_mapping(
    value: Mapping[str, Any],
    aircraft: AircraftOperatingProfile | None = None,
) -> LoadingProfile:
    """Construct a validated profile from the portable JSON record."""

    profile = LoadingProfile(
        profile_id=value["profileId"],
        aircraft_profile_id=value["aircraftProfileId"],
        display_name=value["displayName"],
        empty_weight=value["emptyWeight"],
        empty_moment=value["emptyMoment"],
        max_gross=value["maxGross"],
        usable_fuel_capacity=value["usableFuelCapacity"],
        fuel_arm=value["fuelArm"],
        fuel_density=value["fuelDensity"],
        stations=tuple(
            LoadingStationDefinition(
                station_id=station["stationId"],
                name=station["name"],
                arm=station["arm"],
                maximum_weight=station.get("maximumWeight"),
            )
            for station in value["stations"]
        ),
        station_group_limits=tuple(
            LoadingStationGroupLimit(
                name=group["name"],
                station_ids=tuple(group["stationIds"]),
                maximum_weight=group["maximumWeight"],
            )
            for group in value["stationGroupLimits"]
        ),
        envelope=tuple(
            EnvelopePoint(
                weight=point["weight"],
                forward=point["forward"],
                aft=point["aft"],
            )
            for point in value["envelope"]
        ),
    )
    return validate_loading_profile(profile, aircraft)


def calculate_load(profile: LoadingProfile, loading: LoadingInput) -> LoadingResult:
    """Calculate takeoff and after-burn landing loading conditions."""

    values = (*loading.station_weights, loading.fuel_gallons, loading.fuel_burn_gallons)
    if (
        any(not math.isfinite(value) for value in values)
        or loading.fuel_gallons < 0
        or loading.fuel_burn_gallons < 0
        or loading.fuel_burn_gallons > loading.fuel_gallons
        or any(weight < 0 for weight in loading.station_weights)
        or len(profile.stations) != len(loading.station_weights)
    ):
        raise ValueError(
            "Enter valid station and fuel values. Fuel burn cannot exceed fuel loaded."
        )

    loading_problems: list[str] = []
    weight_by_station_id: dict[str, float] = {}
    for station, weight in zip(profile.stations, loading.station_weights):
        weight_by_station_id[station.station_id] = weight
        if station.maximum_weight is not None and weight > station.maximum_weight:
            loading_problems.append(f"{station.name} exceeds station limit")
    for group in profile.station_group_limits:
        group_weight = sum(weight_by_station_id[station_id] for station_id in group.station_ids)
        if group_weight > group.maximum_weight:
            loading_problems.append(f"{group.name} exceeds combined limit")

    base_weight = profile.empty_weight + sum(loading.station_weights)
    base_moment = profile.empty_moment + sum(
        station.arm * weight
        for station, weight in zip(profile.stations, loading.station_weights)
    )

    def condition(gallons: float) -> LoadingCondition:
        weight = base_weight + gallons * profile.fuel_density
        cg = (base_moment + gallons * profile.fuel_density * profile.fuel_arm) / weight
        limits = interpolate_envelope(profile.envelope, weight)
        problems = list(loading_problems)
        if gallons > profile.usable_fuel_capacity:
            problems.append("Fuel exceeds usable capacity")
        if weight > profile.max_gross:
            problems.append("Above maximum gross weight")
        if limits is None:
            problems.append("Weight outside entered CG envelope range")
        elif cg < limits[0] or cg > limits[1]:
            problems.append("CG outside entered limits")
        return LoadingCondition(
            weight=weight,
            cg=cg,
            limits=limits,
            problems=tuple(problems),
            within_limits=not problems,
        )

    return LoadingResult(
        takeoff=condition(loading.fuel_gallons),
        landing=condition(loading.fuel_gallons - loading.fuel_burn_gallons),
    )


C172S_LOADING_PROFILE = validate_loading_profile(
    LoadingProfile(
        profile_id="cessna-172s-sample-loading",
        aircraft_profile_id=C172S_OPERATING_PROFILE.profile_id,
        display_name="Cessna 172S Skyhawk sample loading",
        empty_weight=1642,
        empty_moment=62600,
        max_gross=C172S_OPERATING_PROFILE.weight_limits.maximum_takeoff_weight_lb,
        usable_fuel_capacity=C172S_OPERATING_PROFILE.fuel_limits.usable_capacity_gal,
        fuel_arm=48,
        fuel_density=6,
        stations=(
            LoadingStationDefinition("pilot", "Pilot", 37),
            LoadingStationDefinition("copilot", "Copilot", 37),
            LoadingStationDefinition("rear-passengers", "Rear passengers", 73),
            LoadingStationDefinition("baggage-a", "Baggage area A", 95, 120),
            LoadingStationDefinition("baggage-b", "Baggage area B", 123, 50),
        ),
        station_group_limits=(
            LoadingStationGroupLimit(
                "Baggage areas A and B", ("baggage-a", "baggage-b"), 120
            ),
        ),
        envelope=(
            EnvelopePoint(1500, 35, 47.3),
            EnvelopePoint(1950, 35, 47.3),
            EnvelopePoint(2550, 41, 47.3),
        ),
    ),
    C172S_OPERATING_PROFILE,
)

_LOADING_PROFILES = (C172S_LOADING_PROFILE,)


def find_loading_profile(identifier: str) -> LoadingProfile | None:
    """Resolve a bundled profile by loading-profile or aircraft-profile ID."""

    query = identifier.strip()
    return next(
        (
            profile
            for profile in _LOADING_PROFILES
            if profile.profile_id == query or profile.aircraft_profile_id == query
        ),
        None,
    )


__all__ = [
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
]
