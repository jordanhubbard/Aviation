from __future__ import annotations

from aviation_flight_dynamics.aircraft import C172_CONFIG as SDK_C172_CONFIG
from aviation_flight_dynamics.autopilot import PIDGains

from app.models.aircraft_state import C172_CONFIG
from app.services.autopilot import (
    DEFAULT_AUTOPILOT_TUNING,
    PidConfig,
    PidController,
    get_autopilot_tuning,
)
from app.services.flight_dynamics import FlightDynamicsConfig, FlightDynamicsSimulator


def test_pid_controller_clamps_output() -> None:
    config = PidConfig(
        kp=1.0,
        ki=0.0,
        kd=0.0,
        integrator_min=-1.0,
        integrator_max=1.0,
        output_min=-2.0,
        output_max=2.0,
    )
    controller = PidController(config)
    assert isinstance(config, PIDGains)
    assert controller.update(10.0, 1.0) == 2.0
    assert controller.update(-10.0, 1.0) == -2.0
    assert controller.state.integrator == -1.0


def test_g1000_c172_compatibility_model_uses_sdk_authority() -> None:
    assert C172_CONFIG.id == SDK_C172_CONFIG.aircraft_id
    assert (
        C172_CONFIG.performance.cruise_speed_kt
        == SDK_C172_CONFIG.performance.cruise_speed_kt
    )
    assert (
        C172_CONFIG.performance.max_speed_kt
        == SDK_C172_CONFIG.limits.never_exceed_speed_kt
    )
    assert (
        C172_CONFIG.weights.max_gross_lbs
        == SDK_C172_CONFIG.mass_properties.max_gross_weight_lbs
    )
    assert C172_CONFIG.fuel.capacity_gal == SDK_C172_CONFIG.fuel.capacity_gal


def test_autopilot_tuning_fallback_and_override() -> None:
    fallback = get_autopilot_tuning("unknown-aircraft")
    assert fallback.roll_pid == DEFAULT_AUTOPILOT_TUNING.roll_pid
    assert fallback.pitch_pid == DEFAULT_AUTOPILOT_TUNING.pitch_pid

    override = PidConfig(
        kp=0.9,
        ki=0.02,
        kd=0.08,
        integrator_min=-5.0,
        integrator_max=5.0,
        output_min=-15.0,
        output_max=15.0,
    )
    tuned = get_autopilot_tuning("cessna-172", roll_pid_override=override)
    assert tuned.roll_pid == override
    assert tuned.pitch_pid == DEFAULT_AUTOPILOT_TUNING.pitch_pid

    invalid = PidConfig(
        kp=-1.0,
        ki=0.0,
        kd=0.0,
        integrator_min=-1.0,
        integrator_max=1.0,
        output_min=-1.0,
        output_max=1.0,
    )
    normalized = get_autopilot_tuning("cessna-172", roll_pid_override=invalid)
    assert normalized.roll_pid == DEFAULT_AUTOPILOT_TUNING.roll_pid


def test_flight_dynamics_applies_tuning_overrides() -> None:
    override = PidConfig(
        kp=0.7,
        ki=0.01,
        kd=0.05,
        integrator_min=-8.0,
        integrator_max=8.0,
        output_min=-18.0,
        output_max=18.0,
    )
    config = FlightDynamicsConfig(roll_pid_override=override)
    simulator = FlightDynamicsSimulator(config=config)
    assert simulator.config.roll_pid == override


def test_pit_mode_holds_current_pitch() -> None:
    simulator = FlightDynamicsSimulator()
    simulator.state.pitch_deg = 2.5
    simulator.set_autopilot(vertical_mode="PIT")
    assert simulator._pitch_hold_deg == 2.5
