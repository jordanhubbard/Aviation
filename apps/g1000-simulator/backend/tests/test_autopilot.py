from __future__ import annotations

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
    assert controller.update(10.0, 1.0) == 2.0
    assert controller.update(-10.0, 1.0) == -2.0


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
