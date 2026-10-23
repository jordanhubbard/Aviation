from __future__ import annotations

from dataclasses import dataclass
from enum import Enum
from typing import Protocol

from ..aircraft import AircraftConfig


def _require_positive(name: str, value: float) -> None:
    if value <= 0:
        raise ValueError(f"{name} must be positive (got {value}).")


def _require_range(name: str, value: float, low: float, high: float) -> None:
    if value < low or value > high:
        raise ValueError(f"{name} must be between {low} and {high} (got {value}).")


@dataclass(frozen=True)
class Vector3:
    x: float
    y: float
    z: float


@dataclass(frozen=True)
class Quaternion:
    w: float
    x: float
    y: float
    z: float


@dataclass(frozen=True)
class RigidBodyState:
    position_ned_m: Vector3
    velocity_body_mps: Vector3
    orientation: Quaternion
    angular_rates_body_rps: Vector3


@dataclass(frozen=True)
class AircraftState:
    rigid_body: RigidBodyState
    mass_kg: float
    fuel_gal: float | None = None
    time_s: float = 0.0

    def __post_init__(self) -> None:
        _require_positive("mass_kg", self.mass_kg)
        if self.fuel_gal is not None:
            _require_range("fuel_gal", self.fuel_gal, 0.0, float("inf"))
        if self.time_s < 0:
            raise ValueError(f"time_s must be non-negative (got {self.time_s}).")


@dataclass(frozen=True)
class ControlInputs:
    throttle: float
    mixture: float
    propeller: float
    aileron: float
    elevator: float
    rudder: float
    flaps: float = 0.0
    gear_down: bool = True

    def __post_init__(self) -> None:
        _require_range("throttle", self.throttle, 0.0, 1.0)
        _require_range("mixture", self.mixture, 0.0, 1.0)
        _require_range("propeller", self.propeller, 0.0, 1.0)
        _require_range("aileron", self.aileron, -1.0, 1.0)
        _require_range("elevator", self.elevator, -1.0, 1.0)
        _require_range("rudder", self.rudder, -1.0, 1.0)
        _require_range("flaps", self.flaps, 0.0, 1.0)


@dataclass(frozen=True)
class AtmosphereState:
    density_kg_m3: float
    pressure_pa: float
    temperature_c: float
    wind_velocity_mps: Vector3

    def __post_init__(self) -> None:
        _require_positive("density_kg_m3", self.density_kg_m3)
        _require_positive("pressure_pa", self.pressure_pa)


@dataclass(frozen=True)
class ForceMoment:
    force_body_n: Vector3
    moment_body_nm: Vector3


class IntegratorMethod(Enum):
    EULER = "euler"
    RUNGE_KUTTA_4 = "rk4"


@dataclass(frozen=True)
class IntegratorConfig:
    method: IntegratorMethod = IntegratorMethod.RUNGE_KUTTA_4
    time_step_s: float = 0.02

    def __post_init__(self) -> None:
        _require_positive("time_step_s", self.time_step_s)


class ForceModel(Protocol):
    def compute_forces(
        self,
        config: AircraftConfig,
        state: AircraftState,
        controls: ControlInputs,
        atmosphere: AtmosphereState,
    ) -> ForceMoment:
        raise NotImplementedError


class PhysicsIntegrator(Protocol):
    def step(
        self,
        state: AircraftState,
        forces: ForceMoment,
        config: AircraftConfig,
        dt_s: float,
    ) -> AircraftState:
        raise NotImplementedError
