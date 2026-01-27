from __future__ import annotations

from dataclasses import dataclass, field
from typing import Dict

from .mass_properties import MassProperties


def _require_positive(name: str, value: float) -> None:
    if value <= 0:
        raise ValueError(f"{name} must be positive (got {value}).")


def _require_non_negative(name: str, value: float) -> None:
    if value < 0:
        raise ValueError(f"{name} must be non-negative (got {value}).")


def _require_range(name: str, low: float, high: float) -> None:
    if low >= high:
        raise ValueError(f"{name} range must be ascending (got {low} >= {high}).")


@dataclass(frozen=True)
class WingGeometry:
    wing_area_sqft: float
    wing_span_ft: float
    mean_aerodynamic_chord_ft: float

    def __post_init__(self) -> None:
        _require_positive("wing_area_sqft", self.wing_area_sqft)
        _require_positive("wing_span_ft", self.wing_span_ft)
        _require_positive("mean_aerodynamic_chord_ft", self.mean_aerodynamic_chord_ft)


@dataclass(frozen=True)
class AerodynamicCoefficients:
    lift_coefficient_zero: float
    lift_curve_slope_per_rad: float
    lift_coefficient_max: float
    drag_coefficient_zero: float
    induced_drag_factor: float
    moment_coefficient_zero: float
    moment_coefficient_alpha_per_rad: float
    side_force_beta: float = 0.0
    roll_moment_beta: float = 0.0
    yaw_moment_beta: float = 0.0

    def __post_init__(self) -> None:
        _require_positive("lift_curve_slope_per_rad", self.lift_curve_slope_per_rad)
        _require_positive("lift_coefficient_max", self.lift_coefficient_max)
        _require_non_negative("drag_coefficient_zero", self.drag_coefficient_zero)
        _require_non_negative("induced_drag_factor", self.induced_drag_factor)


@dataclass(frozen=True)
class ControlSurfaceCoefficients:
    aileron_effectiveness: float
    elevator_effectiveness: float
    rudder_effectiveness: float
    flap_lift_increment: float = 0.0
    flap_drag_increment: float = 0.0

    def __post_init__(self) -> None:
        _require_non_negative("flap_lift_increment", self.flap_lift_increment)
        _require_non_negative("flap_drag_increment", self.flap_drag_increment)


@dataclass(frozen=True)
class AerodynamicModel:
    geometry: WingGeometry
    coefficients: AerodynamicCoefficients
    control_surface_effects: ControlSurfaceCoefficients


@dataclass(frozen=True)
class EngineConfig:
    engine_type: str
    max_power_hp: float
    max_rpm: float
    idle_rpm: float
    redline_rpm: float
    propeller_diameter_ft: float
    fuel_flow_gph_at_max_power: float
    specific_fuel_consumption_lb_hp_hr: float

    def __post_init__(self) -> None:
        if not self.engine_type:
            raise ValueError("engine_type must be provided.")
        _require_positive("max_power_hp", self.max_power_hp)
        _require_positive("max_rpm", self.max_rpm)
        _require_non_negative("idle_rpm", self.idle_rpm)
        _require_positive("redline_rpm", self.redline_rpm)
        _require_positive("propeller_diameter_ft", self.propeller_diameter_ft)
        _require_non_negative(
            "fuel_flow_gph_at_max_power", self.fuel_flow_gph_at_max_power
        )
        _require_positive(
            "specific_fuel_consumption_lb_hp_hr",
            self.specific_fuel_consumption_lb_hp_hr,
        )
        if self.idle_rpm > self.max_rpm:
            raise ValueError("idle_rpm must be less than or equal to max_rpm.")
        if self.max_rpm > self.redline_rpm:
            raise ValueError("max_rpm must be less than or equal to redline_rpm.")


@dataclass(frozen=True)
class FuelSystemConfig:
    capacity_gal: float
    unusable_gal: float
    fuel_density_lbs_per_gal: float = 6.0

    def __post_init__(self) -> None:
        _require_positive("capacity_gal", self.capacity_gal)
        _require_non_negative("unusable_gal", self.unusable_gal)
        _require_positive("fuel_density_lbs_per_gal", self.fuel_density_lbs_per_gal)
        if self.unusable_gal >= self.capacity_gal:
            raise ValueError("unusable_gal must be less than capacity_gal.")


@dataclass(frozen=True)
class AircraftLimits:
    never_exceed_speed_kt: float
    max_operating_speed_kt: float
    maneuvering_speed_kt: float
    stall_speed_clean_kt: float
    stall_speed_landing_kt: float
    max_bank_angle_deg: float = 60.0
    max_pitch_angle_deg: float = 30.0

    def __post_init__(self) -> None:
        _require_positive("never_exceed_speed_kt", self.never_exceed_speed_kt)
        _require_positive("max_operating_speed_kt", self.max_operating_speed_kt)
        _require_positive("maneuvering_speed_kt", self.maneuvering_speed_kt)
        _require_positive("stall_speed_clean_kt", self.stall_speed_clean_kt)
        _require_positive("stall_speed_landing_kt", self.stall_speed_landing_kt)
        _require_positive("max_bank_angle_deg", self.max_bank_angle_deg)
        _require_positive("max_pitch_angle_deg", self.max_pitch_angle_deg)
        _require_range(
            "stall_speed_clean_kt to max_operating_speed_kt",
            self.stall_speed_clean_kt,
            self.max_operating_speed_kt,
        )
        if self.max_operating_speed_kt > self.never_exceed_speed_kt:
            raise ValueError("max_operating_speed_kt must be <= never_exceed_speed_kt.")


@dataclass(frozen=True)
class PerformanceConfig:
    cruise_speed_kt: float
    climb_rate_fpm: float
    service_ceiling_ft: float
    takeoff_distance_ft: float | None = None
    landing_distance_ft: float | None = None

    def __post_init__(self) -> None:
        _require_positive("cruise_speed_kt", self.cruise_speed_kt)
        _require_positive("climb_rate_fpm", self.climb_rate_fpm)
        _require_positive("service_ceiling_ft", self.service_ceiling_ft)
        if self.takeoff_distance_ft is not None:
            _require_positive("takeoff_distance_ft", self.takeoff_distance_ft)
        if self.landing_distance_ft is not None:
            _require_positive("landing_distance_ft", self.landing_distance_ft)


@dataclass(frozen=True)
class AircraftVariant:
    variant_id: str
    name: str
    mass_properties: MassProperties | None = None
    aerodynamics: AerodynamicModel | None = None
    engine: EngineConfig | None = None
    fuel: FuelSystemConfig | None = None
    limits: AircraftLimits | None = None
    performance: PerformanceConfig | None = None

    def __post_init__(self) -> None:
        if not self.variant_id:
            raise ValueError("variant_id must be provided.")
        if not self.name:
            raise ValueError("variant name must be provided.")

    def apply_to(self, base: AircraftConfig) -> AircraftConfig:
        return AircraftConfig(
            aircraft_id=base.aircraft_id,
            name=self.name,
            manufacturer=base.manufacturer,
            variant_id=self.variant_id,
            mass_properties=self.mass_properties or base.mass_properties,
            aerodynamics=self.aerodynamics or base.aerodynamics,
            engine=self.engine or base.engine,
            fuel=self.fuel or base.fuel,
            limits=self.limits or base.limits,
            performance=self.performance or base.performance,
            variants=base.variants,
        )


@dataclass(frozen=True)
class AircraftConfig:
    aircraft_id: str
    name: str
    manufacturer: str
    mass_properties: MassProperties
    aerodynamics: AerodynamicModel
    engine: EngineConfig
    fuel: FuelSystemConfig
    limits: AircraftLimits
    performance: PerformanceConfig
    variant_id: str | None = None
    variants: Dict[str, AircraftVariant] = field(default_factory=dict)

    def __post_init__(self) -> None:
        if not self.aircraft_id:
            raise ValueError("aircraft_id must be provided.")
        if not self.name:
            raise ValueError("name must be provided.")
        if not self.manufacturer:
            raise ValueError("manufacturer must be provided.")
        for key, variant in self.variants.items():
            if variant.variant_id != key:
                raise ValueError(
                    f"Variant key '{key}' does not match variant.variant_id '{variant.variant_id}'."
                )

    def resolve_variant(self, variant_id: str | None) -> AircraftConfig:
        if not variant_id:
            return self
        variant = self.variants.get(variant_id)
        if not variant:
            raise KeyError(f"Unknown variant_id '{variant_id}'.")
        return variant.apply_to(self)
