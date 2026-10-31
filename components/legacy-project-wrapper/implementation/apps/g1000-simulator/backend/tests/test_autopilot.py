from __future__ import annotations

from aviation.aircraft import C172S_OPERATING_PROFILE
from aviation_flight_dynamics.aircraft import C172_CONFIG as SDK_C172_CONFIG
from aviation_flight_dynamics.autopilot import (
    AutopilotModeController,
    AutopilotState,
    LateralMode,
    PIDGains,
    VerticalMode,
)

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
    assert C172_CONFIG.profile_id == C172S_OPERATING_PROFILE.profile_id
    assert (
        C172_CONFIG.performance.cruise_speed_kt
        == C172S_OPERATING_PROFILE.reference_performance.maximum_cruise_speed_ktas
    )
    assert (
        C172_CONFIG.performance.max_speed_kt
        == C172S_OPERATING_PROFILE.airspeed_limits.vne_kias
    )
    assert (
        C172_CONFIG.weights.max_gross_lbs
        == C172S_OPERATING_PROFILE.weight_limits.maximum_takeoff_weight_lb
    )
    assert (
        C172_CONFIG.fuel.capacity_gal
        == C172S_OPERATING_PROFILE.fuel_limits.total_capacity_gal
    )
    assert (
        C172_CONFIG.dimensions.length_ft
        == C172S_OPERATING_PROFILE.dimensions.length_ft
    )
    assert (
        C172_CONFIG.dimensions.height_ft
        == C172S_OPERATING_PROFILE.dimensions.height_ft
    )


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


def test_g1000_delegates_flight_director_transitions_to_sdk() -> None:
    simulator = FlightDynamicsSimulator()
    assert isinstance(simulator.autopilot, AutopilotState)
    assert isinstance(simulator._mode_controller, AutopilotModeController)

    simulator.set_autopilot(lateral_mode="NAV")
    assert simulator.autopilot.lateral_mode == LateralMode.HDG
    assert simulator.autopilot.lateral_armed == LateralMode.NAV
    assert simulator.autopilot.to_dict()["lateral_armed"] == "NAV"

    simulator._update_lateral_capture(0.0)
    assert simulator.autopilot.lateral_mode == LateralMode.NAV
    assert simulator.autopilot.lateral_armed is None

    simulator.set_autopilot(vertical_mode="VS", target_vertical_speed_fpm=500.0)
    assert simulator.autopilot.vertical_mode == VerticalMode.VS
    assert simulator.autopilot.vertical_armed == VerticalMode.ALT
    assert simulator.autopilot.target_vertical_speed_fpm == 500.0

    simulator._update_vertical_capture(0.0)
    assert simulator.autopilot.vertical_mode == VerticalMode.ALT
    assert simulator.autopilot.vertical_armed is None

    simulator._disconnect_autopilot("limit")
    assert simulator.autopilot.master_on is False
    assert simulator.autopilot.disconnect_reason == "limit"
    assert simulator.autopilot.lateral_mode == LateralMode.ROL
    assert simulator.autopilot.vertical_mode == VerticalMode.PIT
