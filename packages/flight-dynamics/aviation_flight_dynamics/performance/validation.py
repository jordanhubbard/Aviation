from __future__ import annotations

from dataclasses import dataclass

from ..aircraft.validation import ValidationReport
from .cruise import CruisePerformance
from .takeoff_climb import TakeoffClimbPerformance


@dataclass(frozen=True)
class PerformanceReference:
    takeoff_distance_ft: float
    climb_rate_fpm: float
    cruise_speed_kt: float
    fuel_flow_gph: float


C172_PERFORMANCE_REFERENCE = PerformanceReference(
    takeoff_distance_ft=1630.0,
    climb_rate_fpm=720.0,
    cruise_speed_kt=122.0,
    fuel_flow_gph=10.0,
)


def validate_takeoff_climb_performance(
    performance: TakeoffClimbPerformance,
    reference: PerformanceReference,
    *,
    tolerance: float = 0.3,
) -> ValidationReport:
    report = ValidationReport()
    _check_within_percent(
        report,
        performance.takeoff_distance_ft,
        reference.takeoff_distance_ft,
        tolerance,
        field="takeoff_distance_ft",
    )
    _check_within_percent(
        report,
        performance.climb_rate_fpm,
        reference.climb_rate_fpm,
        tolerance,
        field="climb_rate_fpm",
    )
    return report


def validate_cruise_performance(
    performance: CruisePerformance,
    reference: PerformanceReference,
    *,
    tolerance: float = 0.3,
) -> ValidationReport:
    report = ValidationReport()
    expected_speed = reference.cruise_speed_kt * performance.power_setting
    expected_fuel_flow = reference.fuel_flow_gph * performance.power_setting
    _check_within_percent(
        report,
        performance.true_airspeed_kt,
        expected_speed,
        tolerance,
        field="true_airspeed_kt",
    )
    _check_within_percent(
        report,
        performance.fuel_flow_gph,
        expected_fuel_flow,
        tolerance,
        field="fuel_flow_gph",
    )
    if performance.range_nm < 0:
        report.add_error("range_nm must be non-negative", field="range_nm")
    if performance.endurance_hr < 0:
        report.add_error("endurance_hr must be non-negative", field="endurance_hr")
    return report


def _check_within_percent(
    report: ValidationReport,
    value: float,
    expected: float,
    tolerance: float,
    *,
    field: str,
) -> None:
    if expected <= 0:
        report.add_warning("reference value must be positive", field=field)
        return
    delta = abs(value - expected) / expected
    if delta > tolerance:
        report.add_warning(
            f"{field} deviates from reference by {delta:.0%}",
            field=field,
        )
