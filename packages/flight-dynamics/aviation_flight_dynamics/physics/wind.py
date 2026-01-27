from __future__ import annotations

from dataclasses import dataclass, field
from math import pi, sin, sqrt

from .architecture import Vector3


@dataclass(frozen=True)
class WindModelConfig:
    steady_wind_mps: Vector3 = field(default_factory=lambda: Vector3(0.0, 0.0, 0.0))
    gust_amplitude_mps: float = 0.0
    gust_frequency_hz: float = 0.0
    turbulence_amplitude_mps: float = 0.0
    turbulence_frequency_hz: float = 0.0
    turbulence_phase_offset: float = 0.0

    def __post_init__(self) -> None:
        if self.gust_amplitude_mps < 0:
            raise ValueError("gust_amplitude_mps must be non-negative.")
        if self.turbulence_amplitude_mps < 0:
            raise ValueError("turbulence_amplitude_mps must be non-negative.")
        if self.gust_frequency_hz < 0:
            raise ValueError("gust_frequency_hz must be non-negative.")
        if self.turbulence_frequency_hz < 0:
            raise ValueError("turbulence_frequency_hz must be non-negative.")


@dataclass(frozen=True)
class WindComponents:
    steady: Vector3
    gust: Vector3
    turbulence: Vector3
    total: Vector3


class WindModel:
    def __init__(self, config: WindModelConfig | None = None) -> None:
        self.config = config or WindModelConfig()

    def wind_velocity_mps(self, time_s: float) -> Vector3:
        return self.wind_components(time_s).total

    def wind_components(self, time_s: float) -> WindComponents:
        steady = self.config.steady_wind_mps
        gust = _compute_gust(self.config, time_s)
        turbulence = _compute_turbulence(self.config, time_s)
        total = _vector_add(steady, _vector_add(gust, turbulence))
        return WindComponents(
            steady=steady,
            gust=gust,
            turbulence=turbulence,
            total=total,
        )


def _compute_gust(config: WindModelConfig, time_s: float) -> Vector3:
    if config.gust_amplitude_mps == 0 or config.gust_frequency_hz == 0:
        return Vector3(0.0, 0.0, 0.0)
    gust_speed = config.gust_amplitude_mps * sin(
        2.0 * pi * config.gust_frequency_hz * time_s
    )
    direction = _normalize_or_default(
        config.steady_wind_mps,
        Vector3(1.0, 0.0, 0.0),
    )
    return _vector_scale(direction, gust_speed)


def _compute_turbulence(config: WindModelConfig, time_s: float) -> Vector3:
    if config.turbulence_amplitude_mps == 0 or config.turbulence_frequency_hz == 0:
        return Vector3(0.0, 0.0, 0.0)
    omega = 2.0 * pi * config.turbulence_frequency_hz
    phase = config.turbulence_phase_offset
    turb_x = config.turbulence_amplitude_mps * sin(omega * time_s + phase)
    turb_y = config.turbulence_amplitude_mps * sin(
        omega * time_s + phase + 2.09439510239
    )
    turb_z = config.turbulence_amplitude_mps * sin(
        omega * time_s + phase + 4.18879020479
    )
    return Vector3(turb_x, turb_y, turb_z)


def _vector_add(left: Vector3, right: Vector3) -> Vector3:
    return Vector3(left.x + right.x, left.y + right.y, left.z + right.z)


def _vector_scale(vector: Vector3, scale: float) -> Vector3:
    return Vector3(vector.x * scale, vector.y * scale, vector.z * scale)


def _vector_magnitude(vector: Vector3) -> float:
    return sqrt(vector.x * vector.x + vector.y * vector.y + vector.z * vector.z)


def _normalize_or_default(vector: Vector3, fallback: Vector3) -> Vector3:
    magnitude = _vector_magnitude(vector)
    if magnitude == 0:
        return fallback
    return _vector_scale(vector, 1.0 / magnitude)
