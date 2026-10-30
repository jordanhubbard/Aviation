"""PID controller primitives for autopilot use."""
from __future__ import annotations

import math
from dataclasses import dataclass, field


@dataclass
class PIDGains:
    """PID gains with optional integral and output bounds.

    Infinite defaults preserve the unbounded behavior used by existing callers.
    Applications that model actuator limits can declare finite bounds without
    implementing a second controller.
    """

    kp: float
    ki: float
    kd: float
    integrator_min: float = -math.inf
    integrator_max: float = math.inf
    output_min: float = -math.inf
    output_max: float = math.inf

    def is_valid(self) -> bool:
        """Return whether gains and bounds define a usable controller."""
        return (
            self.kp >= 0.0
            and self.ki >= 0.0
            and self.kd >= 0.0
            and self.integrator_min < self.integrator_max
            and self.output_min < self.output_max
        )


@dataclass
class PIDController:
    """Discrete-time PID controller with anti-windup via integral clamping."""

    gains: PIDGains
    integral: float = field(default=0.0, init=False)
    prev_error: float = field(default=0.0, init=False)
    _has_prev_error: bool = field(default=False, init=False, repr=False)

    def __post_init__(self) -> None:
        if not self.gains.is_valid():
            raise ValueError("PID gains and bounds must be valid")

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

        self.integral = max(
            self.gains.integrator_min,
            min(self.gains.integrator_max, self.integral + error * dt),
        )

        # On the first sample there is no previous error to difference against.
        # Treating prev_error as 0 produces a derivative kick of error/dt, which
        # on an autopilot is a control-surface spike the moment a mode engages.
        derivative = (error - self.prev_error) / dt if self._has_prev_error else 0.0
        self.prev_error = error
        self._has_prev_error = True

        output = (
            self.gains.kp * error
            + self.gains.ki * self.integral
            + self.gains.kd * derivative
        )
        return max(self.gains.output_min, min(self.gains.output_max, output))

    @property
    def previous_error(self) -> float | None:
        """Return the previous sample, or ``None`` before the first update."""
        return self.prev_error if self._has_prev_error else None

    def reset(self) -> None:
        """Reset controller state (integral and previous error)."""
        self.integral = 0.0
        self.prev_error = 0.0
        self._has_prev_error = False
