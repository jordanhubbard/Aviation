from __future__ import annotations

from dataclasses import dataclass
from typing import Dict


def clamp(value: float, minimum: float, maximum: float) -> float:
    return max(minimum, min(maximum, value))


@dataclass(frozen=True)
class PidConfig:
    kp: float
    ki: float
    kd: float
    integrator_min: float
    integrator_max: float
    output_min: float
    output_max: float


@dataclass
class PidState:
    integrator: float = 0.0
    previous_error: float | None = None


class PidController:
    def __init__(self, config: PidConfig) -> None:
        self.config = config
        self.state = PidState()

    def reset(self) -> None:
        self.state = PidState()

    def update(self, error: float, delta: float) -> float:
        if delta <= 0:
            return 0.0
        integrator = clamp(
            self.state.integrator + error * delta,
            self.config.integrator_min,
            self.config.integrator_max,
        )
        derivative = (
            0.0
            if self.state.previous_error is None
            else (error - self.state.previous_error) / delta
        )
        output = (
            self.config.kp * error
            + self.config.ki * integrator
            + self.config.kd * derivative
        )
        output = clamp(output, self.config.output_min, self.config.output_max)
        self.state.integrator = integrator
        self.state.previous_error = error
        return output


LATERAL_MODES = ("ROL", "HDG", "NAV", "APR", "BC")
VERTICAL_MODES = ("PIT", "VS", "ALT", "ALTS", "GS", "GP")


@dataclass
class AutopilotStatus:
    master_on: bool
    lateral_mode: str
    vertical_mode: str
    lateral_armed: str
    vertical_armed: str
    target_vertical_speed_fpm: float
    bank_limit_active: bool
    pitch_limit_active: bool
    disconnect_reason: str

    def to_dict(self) -> Dict[str, float | str | bool]:
        return {
            "master_on": self.master_on,
            "lateral_mode": self.lateral_mode,
            "vertical_mode": self.vertical_mode,
            "lateral_armed": self.lateral_armed,
            "vertical_armed": self.vertical_armed,
            "target_vertical_speed_fpm": self.target_vertical_speed_fpm,
            "bank_limit_active": self.bank_limit_active,
            "pitch_limit_active": self.pitch_limit_active,
            "disconnect_reason": self.disconnect_reason,
        }
