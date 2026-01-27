from __future__ import annotations

from dataclasses import dataclass

from ..aircraft import AircraftConfig
from ..physics import AtmosphereState

SEA_LEVEL_DENSITY_KG_M3 = 1.225


@dataclass(frozen=True)
class TakeoffClimbPerformance:
    takeoff_distance_ft: float
    climb_rate_fpm: float
    weight_ratio: float
    density_ratio: float


def compute_takeoff_climb_performance(
    config: AircraftConfig,
    atmosphere: AtmosphereState,
    weight_lbs: float | None = None,
) -> TakeoffClimbPerformance:
    if weight_lbs is None:
        weight_lbs = config.mass_properties.max_gross_weight_lbs
    if weight_lbs <= 0:
        raise ValueError("weight_lbs must be positive.")

    base_distance = config.performance.takeoff_distance_ft
    if base_distance is None:
        raise ValueError("takeoff_distance_ft must be defined in performance config.")

    base_climb_rate = config.performance.climb_rate_fpm
    weight_ratio = weight_lbs / config.mass_properties.max_gross_weight_lbs
    density_ratio = atmosphere.density_kg_m3 / SEA_LEVEL_DENSITY_KG_M3

    adjusted_takeoff_distance = base_distance * weight_ratio * weight_ratio
    if density_ratio > 0:
        adjusted_takeoff_distance /= density_ratio

    adjusted_climb_rate = base_climb_rate
    if weight_ratio > 0:
        adjusted_climb_rate *= 1.0 / weight_ratio
    adjusted_climb_rate *= density_ratio

    return TakeoffClimbPerformance(
        takeoff_distance_ft=adjusted_takeoff_distance,
        climb_rate_fpm=adjusted_climb_rate,
        weight_ratio=weight_ratio,
        density_ratio=density_ratio,
    )
