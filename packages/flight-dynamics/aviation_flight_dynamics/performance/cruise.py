from __future__ import annotations

from dataclasses import dataclass

from ..aircraft import AircraftConfig


@dataclass(frozen=True)
class CruisePerformance:
    true_airspeed_kt: float
    fuel_flow_gph: float
    endurance_hr: float
    range_nm: float
    power_setting: float
    fuel_available_gal: float


def compute_cruise_performance(
    config: AircraftConfig,
    power_setting: float,
    fuel_gal: float | None = None,
) -> CruisePerformance:
    power_fraction = _clamp(power_setting, 0.0, 1.0)
    cruise_speed = config.performance.cruise_speed_kt
    true_airspeed = cruise_speed * power_fraction

    fuel_flow = config.engine.fuel_flow_gph_at_max_power * power_fraction
    if fuel_gal is None:
        fuel_gal = config.fuel.capacity_gal - config.fuel.unusable_gal
    if fuel_gal < 0:
        raise ValueError("fuel_gal must be non-negative.")

    endurance_hr = fuel_gal / fuel_flow if fuel_flow > 0 else 0.0
    range_nm = true_airspeed * endurance_hr

    return CruisePerformance(
        true_airspeed_kt=true_airspeed,
        fuel_flow_gph=fuel_flow,
        endurance_hr=endurance_hr,
        range_nm=range_nm,
        power_setting=power_fraction,
        fuel_available_gal=fuel_gal,
    )


def _clamp(value: float, low: float, high: float) -> float:
    if value < low:
        return low
    if value > high:
        return high
    return value
