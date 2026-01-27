from __future__ import annotations

from dataclasses import dataclass
from math import sqrt

from ..aircraft import AircraftConfig, InertiaTensor
from .architecture import (
    AircraftState,
    ForceMoment,
    IntegratorConfig,
    IntegratorMethod,
    Quaternion,
    RigidBodyState,
    Vector3,
)

SLUG_FT2_TO_KG_M2 = 1.3558179483314004


@dataclass(frozen=True)
class StateDerivative:
    position_ned_m: Vector3
    velocity_body_mps: Vector3
    orientation: Quaternion
    angular_rates_body_rps: Vector3
    time_s: float


@dataclass
class SixDofIntegrator:
    config: IntegratorConfig = IntegratorConfig()

    def step(
        self,
        state: AircraftState,
        forces: ForceMoment,
        config: AircraftConfig,
        dt_s: float | None = None,
    ) -> AircraftState:
        dt = dt_s if dt_s is not None else self.config.time_step_s
        if dt <= 0:
            raise ValueError(f"dt_s must be positive (got {dt}).")
        if self.config.method == IntegratorMethod.EULER:
            return _euler_step(state, forces, config, dt)
        if self.config.method == IntegratorMethod.RUNGE_KUTTA_4:
            return _rk4_step(state, forces, config, dt)
        raise ValueError(f"Unsupported integrator method: {self.config.method}")


def _euler_step(
    state: AircraftState,
    forces: ForceMoment,
    config: AircraftConfig,
    dt: float,
) -> AircraftState:
    derivative = _compute_derivative(state, forces, config)
    return _apply_derivative(state, derivative, dt)


def _rk4_step(
    state: AircraftState,
    forces: ForceMoment,
    config: AircraftConfig,
    dt: float,
) -> AircraftState:
    half_dt = dt * 0.5
    k1 = _compute_derivative(state, forces, config)
    k2 = _compute_derivative(
        _apply_derivative(state, k1, half_dt),
        forces,
        config,
    )
    k3 = _compute_derivative(
        _apply_derivative(state, k2, half_dt),
        forces,
        config,
    )
    k4 = _compute_derivative(
        _apply_derivative(state, k3, dt),
        forces,
        config,
    )
    combined = _combine_derivatives(k1, k2, k3, k4)
    return _apply_derivative(state, combined, dt / 6.0)


def _compute_derivative(
    state: AircraftState,
    forces: ForceMoment,
    config: AircraftConfig,
) -> StateDerivative:
    mass = state.mass_kg
    if mass <= 0:
        raise ValueError(f"mass_kg must be positive (got {mass}).")

    velocity_ned = _rotate_vector(
        state.rigid_body.orientation,
        state.rigid_body.velocity_body_mps,
    )
    accel_body = _vector_scale(forces.force_body_n, 1.0 / mass)
    angular_accel = _angular_acceleration(forces, config.mass_properties.inertia)
    orientation_dot = _quat_derivative(
        state.rigid_body.orientation,
        state.rigid_body.angular_rates_body_rps,
    )

    return StateDerivative(
        position_ned_m=velocity_ned,
        velocity_body_mps=accel_body,
        orientation=orientation_dot,
        angular_rates_body_rps=angular_accel,
        time_s=1.0,
    )


def _angular_acceleration(
    forces: ForceMoment,
    inertia: InertiaTensor,
) -> Vector3:
    inertia_si = _inertia_to_si(inertia)
    if inertia_si.x == 0 or inertia_si.y == 0 or inertia_si.z == 0:
        raise ValueError("Inertia values must be non-zero.")
    return Vector3(
        forces.moment_body_nm.x / inertia_si.x,
        forces.moment_body_nm.y / inertia_si.y,
        forces.moment_body_nm.z / inertia_si.z,
    )


def _inertia_to_si(inertia: InertiaTensor) -> Vector3:
    return Vector3(
        inertia.ix_slug_ft2 * SLUG_FT2_TO_KG_M2,
        inertia.iy_slug_ft2 * SLUG_FT2_TO_KG_M2,
        inertia.iz_slug_ft2 * SLUG_FT2_TO_KG_M2,
    )


def _apply_derivative(
    state: AircraftState,
    derivative: StateDerivative,
    dt: float,
) -> AircraftState:
    rigid_body = RigidBodyState(
        position_ned_m=_vector_add(
            state.rigid_body.position_ned_m,
            _vector_scale(derivative.position_ned_m, dt),
        ),
        velocity_body_mps=_vector_add(
            state.rigid_body.velocity_body_mps,
            _vector_scale(derivative.velocity_body_mps, dt),
        ),
        orientation=_normalize_quaternion(
            _quat_add(
                state.rigid_body.orientation,
                _quat_scale(derivative.orientation, dt),
            )
        ),
        angular_rates_body_rps=_vector_add(
            state.rigid_body.angular_rates_body_rps,
            _vector_scale(derivative.angular_rates_body_rps, dt),
        ),
    )
    return AircraftState(
        rigid_body=rigid_body,
        mass_kg=state.mass_kg,
        fuel_gal=state.fuel_gal,
        time_s=state.time_s + dt * derivative.time_s,
    )


def _combine_derivatives(
    k1: StateDerivative,
    k2: StateDerivative,
    k3: StateDerivative,
    k4: StateDerivative,
) -> StateDerivative:
    return StateDerivative(
        position_ned_m=_vector_sum(
            k1.position_ned_m,
            k2.position_ned_m,
            k3.position_ned_m,
            k4.position_ned_m,
        ),
        velocity_body_mps=_vector_sum(
            k1.velocity_body_mps,
            k2.velocity_body_mps,
            k3.velocity_body_mps,
            k4.velocity_body_mps,
        ),
        orientation=_quat_sum(
            k1.orientation,
            k2.orientation,
            k3.orientation,
            k4.orientation,
        ),
        angular_rates_body_rps=_vector_sum(
            k1.angular_rates_body_rps,
            k2.angular_rates_body_rps,
            k3.angular_rates_body_rps,
            k4.angular_rates_body_rps,
        ),
        time_s=k1.time_s + 2.0 * k2.time_s + 2.0 * k3.time_s + k4.time_s,
    )


def _vector_sum(
    k1: Vector3,
    k2: Vector3,
    k3: Vector3,
    k4: Vector3,
) -> Vector3:
    return _vector_add(
        _vector_add(k1, _vector_scale(k2, 2.0)),
        _vector_add(_vector_scale(k3, 2.0), k4),
    )


def _quat_sum(
    k1: Quaternion,
    k2: Quaternion,
    k3: Quaternion,
    k4: Quaternion,
) -> Quaternion:
    return _quat_add(
        _quat_add(k1, _quat_scale(k2, 2.0)),
        _quat_add(_quat_scale(k3, 2.0), k4),
    )


def _vector_add(left: Vector3, right: Vector3) -> Vector3:
    return Vector3(left.x + right.x, left.y + right.y, left.z + right.z)


def _vector_scale(vector: Vector3, scale: float) -> Vector3:
    return Vector3(vector.x * scale, vector.y * scale, vector.z * scale)


def _quat_add(left: Quaternion, right: Quaternion) -> Quaternion:
    return Quaternion(
        left.w + right.w,
        left.x + right.x,
        left.y + right.y,
        left.z + right.z,
    )


def _quat_scale(quaternion: Quaternion, scale: float) -> Quaternion:
    return Quaternion(
        quaternion.w * scale,
        quaternion.x * scale,
        quaternion.y * scale,
        quaternion.z * scale,
    )


def _quat_derivative(quaternion: Quaternion, angular_rates: Vector3) -> Quaternion:
    omega = Quaternion(0.0, angular_rates.x, angular_rates.y, angular_rates.z)
    return _quat_scale(_quat_multiply(quaternion, omega), 0.5)


def _quat_multiply(left: Quaternion, right: Quaternion) -> Quaternion:
    return Quaternion(
        left.w * right.w - left.x * right.x - left.y * right.y - left.z * right.z,
        left.w * right.x + left.x * right.w + left.y * right.z - left.z * right.y,
        left.w * right.y - left.x * right.z + left.y * right.w + left.z * right.x,
        left.w * right.z + left.x * right.y - left.y * right.x + left.z * right.w,
    )


def _normalize_quaternion(quaternion: Quaternion) -> Quaternion:
    magnitude = sqrt(
        quaternion.w * quaternion.w
        + quaternion.x * quaternion.x
        + quaternion.y * quaternion.y
        + quaternion.z * quaternion.z
    )
    if magnitude == 0:
        raise ValueError("Quaternion magnitude cannot be zero.")
    return Quaternion(
        quaternion.w / magnitude,
        quaternion.x / magnitude,
        quaternion.y / magnitude,
        quaternion.z / magnitude,
    )


def _quat_conjugate(quaternion: Quaternion) -> Quaternion:
    return Quaternion(
        quaternion.w,
        -quaternion.x,
        -quaternion.y,
        -quaternion.z,
    )


def _rotate_vector(quaternion: Quaternion, vector: Vector3) -> Vector3:
    vector_quat = Quaternion(0.0, vector.x, vector.y, vector.z)
    rotated = _quat_multiply(
        _quat_multiply(quaternion, vector_quat),
        _quat_conjugate(quaternion),
    )
    return Vector3(rotated.x, rotated.y, rotated.z)
