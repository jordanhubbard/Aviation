"""PID controller primitives for autopilot use."""
from __future__ import annotations

from dataclasses import dataclass, field


@dataclass
class PIDGains:
    """Proportional, integral, and derivative gains for a PID controller."""

    kp: float
    ki: float
    kd: float


@dataclass
class PIDController:
    """Discrete-time PID controller with anti-windup via integral clamping."""

    gains: PIDGains
    integral: float = field(default=0.0, init=False)
    prev_error: float = field(default=0.0, init=False)

    def update(self, error: float, dt: float) -> float:
        """Compute PID output for a given error and time step.

        Args:
            error: Current error (setpoint minus measured value).
            dt: Time step in seconds.  Must be positive.

        Returns:
            Controller output.
        """
        if dt <= 0.0:
            return 0.0

        self.integral += error * dt
        derivative = (error - self.prev_error) / dt
        self.prev_error = error

        return (
            self.gains.kp * error
            + self.gains.ki * self.integral
            + self.gains.kd * derivative
        )

    def reset(self) -> None:
        """Reset controller state (integral and previous error)."""
        self.integral = 0.0
        self.prev_error = 0.0
