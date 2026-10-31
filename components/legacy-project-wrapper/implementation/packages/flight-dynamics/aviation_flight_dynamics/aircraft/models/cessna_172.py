from __future__ import annotations

import json
from pathlib import Path
from typing import Any, Dict

from aviation.aircraft import AircraftOperatingProfile, C172S_OPERATING_PROFILE

from ..aircraft_model import (
    AerodynamicCoefficients,
    AerodynamicModel,
    AircraftConfig,
    AircraftLimits,
    AircraftVariant,
    ControlSurfaceCoefficients,
    EngineConfig,
    FuelSystemConfig,
    PerformanceConfig,
    WingGeometry,
)
from ..mass_properties import CGLimits, InertiaTensor, MassProperties

MODEL_PATH = Path(__file__).with_suffix(".yaml")


def _load_raw_data() -> Dict[str, Any]:
    with MODEL_PATH.open("r", encoding="utf-8") as handle:
        return json.load(handle)


def _build_mass_properties(
    data: Dict[str, Any], profile: AircraftOperatingProfile
) -> MassProperties:
    cg_limits = CGLimits(**data["cg_limits_in"])
    inertia = InertiaTensor(**data["inertia"])
    return MassProperties(
        empty_weight_lbs=data["empty_weight_lbs"],
        max_gross_weight_lbs=profile.weight_limits.maximum_takeoff_weight_lb,
        reference_cg_in=data["reference_cg_in"],
        cg_limits_in=cg_limits,
        inertia=inertia,
        max_payload_lbs=data.get("max_payload_lbs"),
    )


def _build_aerodynamics(
    data: Dict[str, Any], profile: AircraftOperatingProfile
) -> AerodynamicModel:
    geometry = WingGeometry(
        **data["geometry"], wing_span_ft=profile.dimensions.wingspan_ft
    )
    coefficients = AerodynamicCoefficients(**data["coefficients"])
    control_surface_effects = ControlSurfaceCoefficients(
        **data["control_surface_effects"]
    )
    return AerodynamicModel(
        geometry=geometry,
        coefficients=coefficients,
        control_surface_effects=control_surface_effects,
    )


def _build_engine(data: Dict[str, Any]) -> EngineConfig:
    return EngineConfig(**data)


def _build_fuel(
    data: Dict[str, Any], profile: AircraftOperatingProfile
) -> FuelSystemConfig:
    return FuelSystemConfig(
        **data,
        capacity_gal=profile.fuel_limits.total_capacity_gal,
        unusable_gal=(
            profile.fuel_limits.total_capacity_gal
            - profile.fuel_limits.usable_capacity_gal
        ),
    )


def _build_limits(
    data: Dict[str, Any], profile: AircraftOperatingProfile
) -> AircraftLimits:
    speed = profile.airspeed_limits
    return AircraftLimits(
        **data,
        never_exceed_speed_kt=speed.vne_kias,
        max_operating_speed_kt=speed.vno_kias,
        maneuvering_speed_kt=speed.va_kias,
        stall_speed_clean_kt=speed.vs_kias,
        stall_speed_landing_kt=speed.vso_kias,
        max_flap_extended_speed_kt=speed.vfe_kias,
    )


def _build_performance(profile: AircraftOperatingProfile) -> PerformanceConfig:
    reference = profile.reference_performance
    return PerformanceConfig(
        cruise_speed_kt=reference.maximum_cruise_speed_ktas,
        climb_rate_fpm=reference.maximum_climb_rate_fpm,
        service_ceiling_ft=reference.service_ceiling_ft,
        takeoff_distance_ft=reference.takeoff_distance_ft,
        landing_distance_ft=reference.landing_distance_ft,
    )


def _build_variant(
    variant_id: str, data: Dict[str, Any], profile: AircraftOperatingProfile
) -> AircraftVariant:
    return AircraftVariant(
        variant_id=variant_id,
        name=data["name"],
        mass_properties=(
            _build_mass_properties(data["mass_properties"], profile)
            if "mass_properties" in data
            else None
        ),
        aerodynamics=(
            _build_aerodynamics(data["aerodynamics"], profile)
            if "aerodynamics" in data
            else None
        ),
        engine=_build_engine(data["engine"]) if "engine" in data else None,
        fuel=_build_fuel(data["fuel"], profile) if "fuel" in data else None,
        limits=_build_limits(data["limits"], profile) if "limits" in data else None,
        performance=(
            PerformanceConfig(**data["performance"])
            if "performance" in data
            else None
        ),
    )


def _build_aircraft_config(
    data: Dict[str, Any], profile: AircraftOperatingProfile
) -> AircraftConfig:
    variants_data = data.get("variants", {})
    variants = {
        variant_id: _build_variant(variant_id, variant_data, profile)
        for variant_id, variant_data in variants_data.items()
    }
    return AircraftConfig(
        aircraft_id=data["model_id"],
        name=profile.display_name,
        manufacturer=profile.manufacturer,
        aircraft_profile_id=profile.profile_id,
        mass_properties=_build_mass_properties(data["mass_properties"], profile),
        aerodynamics=_build_aerodynamics(data["aerodynamics"], profile),
        engine=_build_engine(data["engine"]),
        fuel=_build_fuel(data["fuel"], profile),
        limits=_build_limits(data["limits"], profile),
        performance=_build_performance(profile),
        variants=variants,
    )


def load_c172_config(
    profile: AircraftOperatingProfile = C172S_OPERATING_PROFILE,
) -> AircraftConfig:
    if profile.profile_id != C172S_OPERATING_PROFILE.profile_id:
        raise ValueError(
            "C172 physics model requires the cessna-172s aircraft operating profile"
        )
    return _build_aircraft_config(_load_raw_data(), profile)


C172_CONFIG = load_c172_config()
