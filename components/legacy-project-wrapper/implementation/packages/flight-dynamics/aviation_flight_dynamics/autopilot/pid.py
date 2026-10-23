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
    _has_prev_error: bool = field(default=False, init=False, repr=False)

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

        # On the first sample there is no previous error to difference against.
        # Treating prev_error as 0 produces a derivative kick of error/dt, which
        # on an autopilot is a control-surface spike the moment a mode engages.
        derivative = (error - self.prev_error) / dt if self._has_prev_error else 0.0
        self.prev_error = error
        self._has_prev_error = True

        return (
            self.gains.kp * error
            + self.gains.ki * self.integral
            + self.gains.kd * derivative
        )

    def reset(self) -> None:
        """Reset controller state (integral and previous error)."""
        self.integral = 0.0
        self.prev_error = 0.0
        self._has_prev_error = False
