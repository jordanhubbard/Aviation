"""Compatibility formulas shared by retained Aviation applications.

These helpers preserve the scalar API used by early applications while keeping the
actual formulas in the common flight-dynamics package.
"""
from __future__ import annotations

import math


def calculate_lift(
    speed: float,
    wing_area: float,
    lift_coefficient: float,
    air_density: float,
) -> float:
    return 0.5 * lift_coefficient * air_density * wing_area * speed**2


def calculate_drag(
    speed: float,
    wing_area: float,
    drag_coefficient: float,
    air_density: float,
) -> float:
    return 0.5 * drag_coefficient * air_density * wing_area * speed**2


def calculate_thrust(power: float, efficiency: float, engine_factor: float = 1.0) -> float:
    return power * efficiency * engine_factor


def calculate_fuel_consumption(thrust: float, fuel_efficiency: float) -> float:
    if fuel_efficiency <= 0:
        raise ValueError("fuel_efficiency must be positive")
    return thrust / fuel_efficiency


def apply_wind_effect(velocity: float, wind_speed: float, wind_angle: float) -> float:
    return velocity + wind_speed * math.cos(wind_angle)


def apply_turbulence_effect(velocity: float, turbulence_intensity: float) -> float:
    if not 0.0 <= turbulence_intensity <= 1.0:
        raise ValueError("turbulence_intensity must be between 0 and 1")
    return velocity * (1.0 - turbulence_intensity)
