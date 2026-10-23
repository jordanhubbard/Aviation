"""Autotrim controller — gradually offloads sustained control inputs to trim."""
from __future__ import annotations

from dataclasses import dataclass


@dataclass
class TrimState:
    """Current trim tab positions.

    All values are normalised to [-1.0, 1.0] where positive is nose-up /
    right-wing-down / right-rudder.
    """

    elevator_trim: float = 0.0
    aileron_trim: float = 0.0
    rudder_trim: float = 0.0


class AutotrimController:
    """Gradually adjusts trim to reduce sustained (non-transient) control inputs.

    The algorithm is intentionally simple: each axis integrates the sustained
    control deflection at a configurable rate and adjusts the corresponding
    trim value, clamped to [-1.0, 1.0].

    Parameters
    ----------
    trim_rate:
        Fraction of a full trim deflection applied per second per unit of
        sustained control input.  Defaults to 0.05 (5 % per second).
    deadband:
        Control inputs whose absolute value is below this threshold are
        treated as zero (no trim change).  Defaults to 0.02.
    """

    def __init__(
        self,
        trim_rate: float = 0.05,
        deadband: float = 0.02,
    ) -> None:
        if trim_rate < 0.0:
            raise ValueError("trim_rate must be non-negative.")
        if deadband < 0.0:
            raise ValueError("deadband must be non-negative.")
        self.trim_rate = trim_rate
        self.deadband = deadband
        self._state = TrimState()

    # ------------------------------------------------------------------
    # Public interface
    # ------------------------------------------------------------------

    @property
    def trim_state(self) -> TrimState:
        """Return a copy of the current trim state."""
        return TrimState(
            elevator_trim=self._state.elevator_trim,
            aileron_trim=self._state.aileron_trim,
            rudder_trim=self._state.rudder_trim,
        )

    def update(
        self,
        elevator_input: float,
        aileron_input: float,
        rudder_input: float,
        dt: float,
    ) -> TrimState:
        """Update trim state based on current control inputs.

        Args:
            elevator_input: Normalised elevator deflection in [-1, 1].
            aileron_input: Normalised aileron deflection in [-1, 1].
            rudder_input: Normalised rudder deflection in [-1, 1].
            dt: Time step in seconds.

        Returns:
            Updated TrimState (also stored internally).
        """
        if dt <= 0.0:
            return self.trim_state

        self._state.elevator_trim = self._adjust(
            self._state.elevator_trim, elevator_input, dt
        )
        self._state.aileron_trim = self._adjust(
            self._state.aileron_trim, aileron_input, dt
        )
        self._state.rudder_trim = self._adjust(
            self._state.rudder_trim, rudder_input, dt
        )
        return self.trim_state

    def reset(self) -> None:
        """Reset all trim to neutral."""
        self._state = TrimState()

    # ------------------------------------------------------------------
    # Internal helpers
    # ------------------------------------------------------------------

    def _adjust(self, current: float, control_input: float, dt: float) -> float:
        """Compute new trim value for one axis."""
        if abs(control_input) < self.deadband:
            return current
        delta = control_input * self.trim_rate * dt
        return max(-1.0, min(1.0, current + delta))
