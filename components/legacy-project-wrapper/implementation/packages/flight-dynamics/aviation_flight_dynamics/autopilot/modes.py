"""Autopilot mode enumerations and state-machine controller."""
from __future__ import annotations

from dataclasses import dataclass
from enum import Enum


class AutopilotMode(Enum):
    """Top-level autopilot engagement state."""

    OFF = "OFF"
    ON = "ON"
    APPROACH = "APPROACH"


class LateralMode(Enum):
    """Lateral (roll-axis) guidance modes."""

    ROL = "ROL"   # Wings-level / roll hold
    HDG = "HDG"   # Heading select
    NAV = "NAV"   # VOR/GPS navigation tracking
    APR = "APR"   # Localiser approach
    BC = "BC"     # Back-course localiser


class VerticalMode(Enum):
    """Vertical (pitch-axis) guidance modes."""

    PIT = "PIT"   # Pitch hold
    VS = "VS"     # Vertical speed hold
    ALT = "ALT"   # Altitude hold
    ALTS = "ALTS" # Altitude select / capture
    GS = "GS"     # ILS glideslope
    GP = "GP"     # GPS glidepath (RNAV approach)


@dataclass
class AutopilotState:
    """Current autopilot engagement and mode state."""

    master_on: bool = False
    lateral_mode: LateralMode = LateralMode.ROL
    vertical_mode: VerticalMode = VerticalMode.PIT
    approach_armed: bool = False


# ---------------------------------------------------------------------------
# Valid lateral and vertical mode sets used for transition guards
# ---------------------------------------------------------------------------

_LATERAL_MODES_REQUIRING_MASTER = {
    LateralMode.HDG,
    LateralMode.NAV,
    LateralMode.APR,
    LateralMode.BC,
}

_APPROACH_LATERAL_MODES = {LateralMode.APR, LateralMode.BC}
_APPROACH_VERTICAL_MODES = {VerticalMode.GS, VerticalMode.GP}


class AutopilotModeController:
    """Manages valid autopilot mode transitions.

    The controller enforces the following invariants:
    - Mode changes are only accepted when the master switch is on.
    - Arming an approach sets ``approach_armed`` on the state.
    - Activating a glideslope/glidepath vertical mode requires the master
      switch to be on and approach to be armed.
    - Disengaging the master switch resets lateral and vertical modes to
      their default (ROL / PIT) and clears approach_armed.
    """

    def __init__(self) -> None:
        self._state = AutopilotState()

    # ------------------------------------------------------------------
    # Public read access
    # ------------------------------------------------------------------

    @property
    def state(self) -> AutopilotState:
        """Return a copy of the current autopilot state."""
        return AutopilotState(
            master_on=self._state.master_on,
            lateral_mode=self._state.lateral_mode,
            vertical_mode=self._state.vertical_mode,
            approach_armed=self._state.approach_armed,
        )

    # ------------------------------------------------------------------
    # Master switch
    # ------------------------------------------------------------------

    def engage(self) -> None:
        """Engage the autopilot master switch."""
        self._state.master_on = True

    def disengage(self) -> None:
        """Disengage the autopilot and reset all modes to defaults."""
        self._state.master_on = False
        self._state.lateral_mode = LateralMode.ROL
        self._state.vertical_mode = VerticalMode.PIT
        self._state.approach_armed = False

    # ------------------------------------------------------------------
    # Lateral mode selection
    # ------------------------------------------------------------------

    def set_lateral_mode(self, mode: LateralMode) -> bool:
        """Request a lateral mode change.

        Returns True if the transition was accepted, False otherwise.
        Approach lateral modes (APR / BC) additionally set approach_armed.
        """
        if not self._state.master_on:
            return False
        self._state.lateral_mode = mode
        if mode in _APPROACH_LATERAL_MODES:
            self._state.approach_armed = True
        return True

    # ------------------------------------------------------------------
    # Vertical mode selection
    # ------------------------------------------------------------------

    def set_vertical_mode(self, mode: VerticalMode) -> bool:
        """Request a vertical mode change.

        Returns True if the transition was accepted, False otherwise.
        Glideslope / glidepath modes require approach_armed to be True.
        """
        if not self._state.master_on:
            return False
        if mode in _APPROACH_VERTICAL_MODES and not self._state.approach_armed:
            return False
        self._state.vertical_mode = mode
        return True

    # ------------------------------------------------------------------
    # Convenience helpers
    # ------------------------------------------------------------------

    def arm_approach(self) -> None:
        """Arm the approach mode without changing the lateral mode."""
        if self._state.master_on:
            self._state.approach_armed = True
