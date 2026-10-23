from __future__ import annotations

from dataclasses import dataclass, field
from typing import Iterable, Literal

from .aircraft_model import AircraftConfig

ValidationSeverity = Literal["error", "warning"]


@dataclass(frozen=True)
class ValidationIssue:
    severity: ValidationSeverity
    message: str
    field: str | None = None


@dataclass
class ValidationReport:
    issues: list[ValidationIssue] = field(default_factory=list)

    def add_error(self, message: str, field: str | None = None) -> None:
        self.issues.append(ValidationIssue("error", message, field))

    def add_warning(self, message: str, field: str | None = None) -> None:
        self.issues.append(ValidationIssue("warning", message, field))

    @property
    def errors(self) -> list[ValidationIssue]:
        return [issue for issue in self.issues if issue.severity == "error"]

    @property
    def warnings(self) -> list[ValidationIssue]:
        return [issue for issue in self.issues if issue.severity == "warning"]

    @property
    def is_valid(self) -> bool:
        return not self.errors

    def extend(self, issues: Iterable[ValidationIssue]) -> None:
        self.issues.extend(list(issues))

    def summary(self) -> dict[str, int]:
        return {
            "errors": len(self.errors),
            "warnings": len(self.warnings),
            "total": len(self.issues),
        }


def validate_aircraft_config(
    config: AircraftConfig,
    *,
    include_variants: bool = True,
) -> ValidationReport:
    report = ValidationReport()
    _validate_aircraft_config(config, report, context="base")
    if include_variants:
        for variant_id, variant in config.variants.items():
            resolved = variant.apply_to(config)
            _validate_aircraft_config(
                resolved,
                report,
                context=f"variant:{variant_id}",
            )
    return report


def _validate_aircraft_config(
    config: AircraftConfig,
    report: ValidationReport,
    *,
    context: str,
) -> None:
    limits = config.limits
    performance = config.performance
    mass = config.mass_properties
    fuel = config.fuel
    engine = config.engine
    aero = config.aerodynamics

    _require_between(
        report,
        limits.maneuvering_speed_kt,
        limits.stall_speed_clean_kt,
        limits.max_operating_speed_kt,
        field=_field_path(context, "limits.maneuvering_speed_kt"),
        message="maneuvering_speed_kt should fall between stall and max operating speeds",
    )

    if limits.stall_speed_landing_kt > limits.stall_speed_clean_kt:
        report.add_error(
            "stall_speed_landing_kt should not exceed stall_speed_clean_kt",
            field=_field_path(context, "limits.stall_speed_landing_kt"),
        )

    if performance.cruise_speed_kt > limits.max_operating_speed_kt:
        report.add_warning(
            "cruise_speed_kt exceeds max_operating_speed_kt",
            field=_field_path(context, "performance.cruise_speed_kt"),
        )

    if mass.max_payload_lbs is None:
        report.add_warning(
            "max_payload_lbs is not defined",
            field=_field_path(context, "mass_properties.max_payload_lbs"),
        )
    else:
        max_payload_limit = mass.max_gross_weight_lbs - mass.empty_weight_lbs
        if mass.max_payload_lbs > max_payload_limit:
            report.add_error(
                "max_payload_lbs exceeds max_gross_weight_lbs minus empty_weight_lbs",
                field=_field_path(context, "mass_properties.max_payload_lbs"),
            )

    if performance.takeoff_distance_ft is None:
        report.add_warning(
            "takeoff_distance_ft is not defined",
            field=_field_path(context, "performance.takeoff_distance_ft"),
        )
    if performance.landing_distance_ft is None:
        report.add_warning(
            "landing_distance_ft is not defined",
            field=_field_path(context, "performance.landing_distance_ft"),
        )

    if fuel.unusable_gal > fuel.capacity_gal * 0.2:
        report.add_warning(
            "unusable_gal exceeds 20% of capacity_gal",
            field=_field_path(context, "fuel.unusable_gal"),
        )

    if not 0.3 <= engine.specific_fuel_consumption_lb_hp_hr <= 0.7:
        report.add_warning(
            "specific_fuel_consumption_lb_hp_hr is outside typical piston ranges",
            field=_field_path(
                context,
                "engine.specific_fuel_consumption_lb_hp_hr",
            ),
        )

    if not 4.0 <= engine.propeller_diameter_ft <= 12.0:
        report.add_warning(
            "propeller_diameter_ft is outside typical single-engine ranges",
            field=_field_path(context, "engine.propeller_diameter_ft"),
        )

    if not 1.0 <= aero.coefficients.lift_coefficient_max <= 2.5:
        report.add_warning(
            "lift_coefficient_max is outside typical general aviation ranges",
            field=_field_path(
                context,
                "aerodynamics.coefficients.lift_coefficient_max",
            ),
        )

    if aero.control_surface_effects.aileron_effectiveness <= 0:
        report.add_warning(
            "aileron_effectiveness should be positive",
            field=_field_path(
                context,
                "aerodynamics.control_surface_effects.aileron_effectiveness",
            ),
        )
    if aero.control_surface_effects.elevator_effectiveness <= 0:
        report.add_warning(
            "elevator_effectiveness should be positive",
            field=_field_path(
                context,
                "aerodynamics.control_surface_effects.elevator_effectiveness",
            ),
        )
    if aero.control_surface_effects.rudder_effectiveness <= 0:
        report.add_warning(
            "rudder_effectiveness should be positive",
            field=_field_path(
                context,
                "aerodynamics.control_surface_effects.rudder_effectiveness",
            ),
        )


def _require_between(
    report: ValidationReport,
    value: float,
    low: float,
    high: float,
    *,
    field: str,
    message: str,
) -> None:
    if not low <= value <= high:
        report.add_error(message, field=field)


def _field_path(context: str, field: str) -> str:
    return f"{context}.{field}"
