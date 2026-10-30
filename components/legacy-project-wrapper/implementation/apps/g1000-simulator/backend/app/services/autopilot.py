from __future__ import annotations

from dataclasses import dataclass
from typing import Dict

from aviation_flight_dynamics.autopilot import (
    AutopilotState,
    LateralMode,
    PIDController as SharedPIDController,
    PIDGains,
    VerticalMode,
)


# Retain the G1000-facing name while using the common SDK contract and validation.
PidConfig = PIDGains


@dataclass
class PidState:
    integrator: float = 0.0
    previous_error: float | None = None


class PidController:
    """G1000 compatibility adapter over the common bounded PID primitive."""

    def __init__(self, config: PidConfig) -> None:
        self.config = config
        self._controller = SharedPIDController(config)

    @property
    def state(self) -> PidState:
        return PidState(
            integrator=self._controller.integral,
            previous_error=self._controller.previous_error,
        )

    def reset(self) -> None:
        self._controller.reset()

    def update(self, error: float, delta: float) -> float:
        return self._controller.update(error, delta)


@dataclass(frozen=True)
class AutopilotTuning:
    roll_pid: PidConfig
    pitch_pid: PidConfig


DEFAULT_ROLL_PID = PidConfig(
    kp=0.6,
    ki=0.02,
    kd=0.1,
    integrator_min=-20.0,
    integrator_max=20.0,
    output_min=-25.0,
    output_max=25.0,
)

DEFAULT_PITCH_PID = PidConfig(
    kp=0.02,
    ki=0.005,
    kd=0.01,
    integrator_min=-10.0,
    integrator_max=10.0,
    output_min=-10.0,
    output_max=10.0,
)

DEFAULT_AUTOPILOT_TUNING = AutopilotTuning(
    roll_pid=DEFAULT_ROLL_PID,
    pitch_pid=DEFAULT_PITCH_PID,
)

AUTOPILOT_TUNING = {
    "cessna-172": DEFAULT_AUTOPILOT_TUNING,
}


def _pid_config_is_valid(config: PidConfig) -> bool:
    return config.is_valid()


def _normalize_pid_config(config: PidConfig, fallback: PidConfig) -> PidConfig:
    return config if _pid_config_is_valid(config) else fallback


def get_autopilot_tuning(
    aircraft_id: str,
    roll_pid_override: PidConfig | None = None,
    pitch_pid_override: PidConfig | None = None,
) -> AutopilotTuning:
    base = AUTOPILOT_TUNING.get(aircraft_id, DEFAULT_AUTOPILOT_TUNING)
    roll_pid = _normalize_pid_config(roll_pid_override or base.roll_pid, DEFAULT_ROLL_PID)
    pitch_pid = _normalize_pid_config(pitch_pid_override or base.pitch_pid, DEFAULT_PITCH_PID)
    return AutopilotTuning(roll_pid=roll_pid, pitch_pid=pitch_pid)


LATERAL_MODES = tuple(mode.value for mode in LateralMode)
VERTICAL_MODES = tuple(mode.value for mode in VerticalMode)


@dataclass
class AutopilotStatus(AutopilotState):
    """G1000 annunciation fields layered on the common flight-director state."""

    bank_limit_active: bool = False
    pitch_limit_active: bool = False

    def to_dict(self) -> Dict[str, float | str | bool]:
        return {
            "master_on": self.master_on,
            "lateral_mode": self.lateral_mode.value,
            "vertical_mode": self.vertical_mode.value,
            "lateral_armed": self.lateral_armed.value if self.lateral_armed else "",
            "vertical_armed": self.vertical_armed.value if self.vertical_armed else "",
            "target_vertical_speed_fpm": self.target_vertical_speed_fpm,
            "bank_limit_active": self.bank_limit_active,
            "pitch_limit_active": self.pitch_limit_active,
            "disconnect_reason": self.disconnect_reason,
        }
