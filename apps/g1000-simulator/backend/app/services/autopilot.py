from __future__ import annotations

from dataclasses import dataclass


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
