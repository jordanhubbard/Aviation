"""Axis-specific autopilot controllers built on the PID primitive."""
from __future__ import annotations

import math

from .pid import PIDController, PIDGains


class PitchController:
    """Controls elevator to track a target pitch angle (degrees)."""

    def __init__(self, gains: PIDGains) -> None:
        self._pid = PIDController(gains=gains)

    def update(self, error: float, dt: float) -> float:
        """Return elevator command for given pitch error and time step."""
        return self._pid.update(error, dt)

    def reset(self) -> None:
        self._pid.reset()


class RollController:
    """Controls aileron to track a target roll (bank) angle (degrees)."""

    def __init__(self, gains: PIDGains) -> None:
        self._pid = PIDController(gains=gains)

    def update(self, error: float, dt: float) -> float:
        """Return aileron command for given roll error and time step."""
        return self._pid.update(error, dt)

    def reset(self) -> None:
        self._pid.reset()


class AltitudeHoldController:
    """Controls pitch attitude (via PitchController) to hold a target altitude.

    The outer loop converts altitude error (feet) into a pitch-angle command
    which the inner PitchController then tracks.
    """

    def __init__(self, gains: PIDGains) -> None:
        self._pid = PIDController(gains=gains)

    def update(self, error: float, dt: float) -> float:
        """Return pitch-angle command (degrees) for given altitude error (feet)."""
        return self._pid.update(error, dt)

    def reset(self) -> None:
        self._pid.reset()


def _heading_error(target_deg: float, current_deg: float) -> float:
    """Compute shortest-path heading error in [-180, 180)."""
    raw = (target_deg - current_deg) % 360.0
    if raw >= 180.0:
        raw -= 360.0
    return raw


class HeadingHoldController:
    """Controls bank angle (via RollController) to intercept and hold a heading.

    The outer loop converts heading error (degrees) into a bank-angle command
    which the inner RollController then tracks.  The heading error is normalised
    to [-180, 180) so the controller always takes the shortest path.
    """

    def __init__(self, gains: PIDGains) -> None:
        self._pid = PIDController(gains=gains)

    def update(self, error: float, dt: float) -> float:
        """Return bank-angle command (degrees) for given heading error (degrees).

        *error* should already be the shortest-path difference; the method
        accepts it directly so callers can pre-normalise if desired.
        """
        return self._pid.update(error, dt)

    def reset(self) -> None:
        self._pid.reset()
