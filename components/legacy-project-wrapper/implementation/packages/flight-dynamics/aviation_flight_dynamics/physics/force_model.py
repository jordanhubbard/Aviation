from __future__ import annotations

from dataclasses import dataclass
from math import atan2, sqrt

from ..aircraft import AircraftConfig
from .architecture import (
    AircraftState,
    AtmosphereState,
    ControlInputs,
    ForceMoment,
    Quaternion,
    Vector3,
)

FT_TO_M = 0.3048
SQFT_TO_M2 = 0.09290304
HP_TO_W = 745.7
GRAVITY_MPS2 = 9.80665
MIN_AIRSPEED_MPS = 1.0


@dataclass(frozen=True)
class ForceComponents:
    aerodynamic: Vector3
    propulsion: Vector3
    gravity: Vector3
    total: Vector3
    moment_body_nm: Vector3


class SimpleForceModel:
    def compute_forces(
        self,
        config: AircraftConfig,
        state: AircraftState,
        controls: ControlInputs,
        atmosphere: AtmosphereState,
    ) -> ForceMoment:
        components = self.compute_force_components(config, state, controls, atmosphere)
        return ForceMoment(components.total, components.moment_body_nm)

    def compute_force_components(
        self,
        config: AircraftConfig,
        state: AircraftState,
        controls: ControlInputs,
        atmosphere: AtmosphereState,
    ) -> ForceComponents:
        aero_force, aero_moment = _compute_aero_forces(
            config,
            state,
            controls,
            atmosphere,
        )
        propulsion_force = _compute_propulsion_force(config, state, controls)
        gravity_force = _compute_gravity_force(state)
        total_force = _vector_add(
            aero_force,
            _vector_add(propulsion_force, gravity_force),
        )
        return ForceComponents(
            aerodynamic=aero_force,
            propulsion=propulsion_force,
            gravity=gravity_force,
            total=total_force,
            moment_body_nm=aero_moment,
        )


def _compute_aero_forces(
    config: AircraftConfig,
    state: AircraftState,
    controls: ControlInputs,
    atmosphere: AtmosphereState,
) -> tuple[Vector3, Vector3]:
    velocity = state.rigid_body.velocity_body_mps
    airspeed = max(_vector_magnitude(velocity), MIN_AIRSPEED_MPS)
    alpha = atan2(-velocity.z, max(velocity.x, MIN_AIRSPEED_MPS))
    beta = atan2(velocity.y, max(velocity.x, MIN_AIRSPEED_MPS))

    geometry = config.aerodynamics.geometry
    coefficients = config.aerodynamics.coefficients
    control = config.aerodynamics.control_surface_effects

    area_m2 = geometry.wing_area_sqft * SQFT_TO_M2
    span_m = geometry.wing_span_ft * FT_TO_M
    chord_m = geometry.mean_aerodynamic_chord_ft * FT_TO_M

    dynamic_pressure = 0.5 * atmosphere.density_kg_m3 * airspeed * airspeed

    lift_coefficient = (
        coefficients.lift_coefficient_zero
        + coefficients.lift_curve_slope_per_rad * alpha
        + control.flap_lift_increment * controls.flaps
    )
    lift_coefficient = min(lift_coefficient, coefficients.lift_coefficient_max)

    drag_coefficient = (
        coefficients.drag_coefficient_zero
        + coefficients.induced_drag_factor * lift_coefficient * lift_coefficient
        + control.flap_drag_increment * controls.flaps
    )

    side_force_coefficient = (
        coefficients.side_force_beta * beta
        + control.rudder_effectiveness * controls.rudder
    )

    lift = dynamic_pressure * area_m2 * lift_coefficient
    drag = dynamic_pressure * area_m2 * drag_coefficient
    side_force = dynamic_pressure * area_m2 * side_force_coefficient

    aerodynamic_force = Vector3(-drag, side_force, -lift)

    roll_moment = dynamic_pressure * area_m2 * span_m * (
        coefficients.roll_moment_beta * beta
        + control.aileron_effectiveness * controls.aileron
    )
    pitch_moment = dynamic_pressure * area_m2 * chord_m * (
        coefficients.moment_coefficient_zero
        + coefficients.moment_coefficient_alpha_per_rad * alpha
        + control.elevator_effectiveness * controls.elevator
    )
    yaw_moment = dynamic_pressure * area_m2 * span_m * (
        coefficients.yaw_moment_beta * beta
        + control.rudder_effectiveness * controls.rudder
    )
    aerodynamic_moment = Vector3(roll_moment, pitch_moment, yaw_moment)

    return aerodynamic_force, aerodynamic_moment


def _compute_propulsion_force(
    config: AircraftConfig,
    state: AircraftState,
    controls: ControlInputs,
) -> Vector3:
    airspeed = max(
        _vector_magnitude(state.rigid_body.velocity_body_mps),
        MIN_AIRSPEED_MPS,
    )
    power_w = (
        config.engine.max_power_hp
        * HP_TO_W
        * controls.throttle
        * controls.mixture
        * controls.propeller
    )
    thrust_n = power_w / max(airspeed, 30.0)
    return Vector3(thrust_n, 0.0, 0.0)


def _compute_gravity_force(state: AircraftState) -> Vector3:
    weight_n = state.mass_kg * GRAVITY_MPS2
    gravity_ned = Vector3(0.0, 0.0, weight_n)
    body_to_ned = state.rigid_body.orientation
    return _rotate_vector(_quat_conjugate(body_to_ned), gravity_ned)


def _vector_add(left: Vector3, right: Vector3) -> Vector3:
    return Vector3(left.x + right.x, left.y + right.y, left.z + right.z)


def _vector_magnitude(vector: Vector3) -> float:
    return sqrt(vector.x * vector.x + vector.y * vector.y + vector.z * vector.z)


def _quat_conjugate(quaternion: Quaternion) -> Quaternion:
    return Quaternion(
        quaternion.w,
        -quaternion.x,
        -quaternion.y,
        -quaternion.z,
    )


def _quat_multiply(left: Quaternion, right: Quaternion) -> Quaternion:
    return Quaternion(
        left.w * right.w - left.x * right.x - left.y * right.y - left.z * right.z,
        left.w * right.x + left.x * right.w + left.y * right.z - left.z * right.y,
        left.w * right.y - left.x * right.z + left.y * right.w + left.z * right.x,
        left.w * right.z + left.x * right.y - left.y * right.x + left.z * right.w,
    )


def _rotate_vector(quaternion: Quaternion, vector: Vector3) -> Vector3:
    vector_quat = Quaternion(0.0, vector.x, vector.y, vector.z)
    rotated = _quat_multiply(
        _quat_multiply(quaternion, vector_quat),
        _quat_conjugate(quaternion),
    )
    return Vector3(rotated.x, rotated.y, rotated.z)
