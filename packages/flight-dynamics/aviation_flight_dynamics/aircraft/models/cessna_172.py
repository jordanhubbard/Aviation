from __future__ import annotations

import json
from pathlib import Path
from typing import Any, Dict

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


def _build_mass_properties(data: Dict[str, Any]) -> MassProperties:
    cg_limits = CGLimits(**data["cg_limits_in"])
    inertia = InertiaTensor(**data["inertia"])
    return MassProperties(
        empty_weight_lbs=data["empty_weight_lbs"],
        max_gross_weight_lbs=data["max_gross_weight_lbs"],
        reference_cg_in=data["reference_cg_in"],
        cg_limits_in=cg_limits,
        inertia=inertia,
        max_payload_lbs=data.get("max_payload_lbs"),
    )


def _build_aerodynamics(data: Dict[str, Any]) -> AerodynamicModel:
    geometry = WingGeometry(**data["geometry"])
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


def _build_fuel(data: Dict[str, Any]) -> FuelSystemConfig:
    return FuelSystemConfig(**data)


def _build_limits(data: Dict[str, Any]) -> AircraftLimits:
    return AircraftLimits(**data)


def _build_performance(data: Dict[str, Any]) -> PerformanceConfig:
    return PerformanceConfig(**data)


def _build_variant(variant_id: str, data: Dict[str, Any]) -> AircraftVariant:
    return AircraftVariant(
        variant_id=variant_id,
        name=data["name"],
        mass_properties=(
            _build_mass_properties(data["mass_properties"])
            if "mass_properties" in data
            else None
        ),
        aerodynamics=(
            _build_aerodynamics(data["aerodynamics"])
            if "aerodynamics" in data
            else None
        ),
        engine=_build_engine(data["engine"]) if "engine" in data else None,
        fuel=_build_fuel(data["fuel"]) if "fuel" in data else None,
        limits=_build_limits(data["limits"]) if "limits" in data else None,
        performance=(
            _build_performance(data["performance"])
            if "performance" in data
            else None
        ),
    )


def _build_aircraft_config(data: Dict[str, Any]) -> AircraftConfig:
    variants_data = data.get("variants", {})
    variants = {
        variant_id: _build_variant(variant_id, variant_data)
        for variant_id, variant_data in variants_data.items()
    }
    return AircraftConfig(
        aircraft_id=data["aircraft_id"],
        name=data["name"],
        manufacturer=data["manufacturer"],
        mass_properties=_build_mass_properties(data["mass_properties"]),
        aerodynamics=_build_aerodynamics(data["aerodynamics"]),
        engine=_build_engine(data["engine"]),
        fuel=_build_fuel(data["fuel"]),
        limits=_build_limits(data["limits"]),
        performance=_build_performance(data["performance"]),
        variants=variants,
    )


def load_c172_config() -> AircraftConfig:
    return _build_aircraft_config(_load_raw_data())


C172_CONFIG = load_c172_config()
