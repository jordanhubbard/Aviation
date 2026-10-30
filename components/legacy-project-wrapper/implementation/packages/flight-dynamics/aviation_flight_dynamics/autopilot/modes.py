"""Autopilot mode enumerations and state-machine controller."""
from __future__ import annotations

from dataclasses import dataclass, replace
from enum import Enum


class AutopilotMode(Enum):
    """Top-level autopilot engagement state."""

    OFF = "OFF"
    ON = "ON"
    APPROACH = "APPROACH"


class LateralMode(str, Enum):
    """Lateral (roll-axis) guidance modes."""

    ROL = "ROL"   # Wings-level / roll hold
    HDG = "HDG"   # Heading select
    NAV = "NAV"   # VOR/GPS navigation tracking
    APR = "APR"   # Localiser approach
    BC = "BC"     # Back-course localiser


class VerticalMode(str, Enum):
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
    lateral_armed: LateralMode | None = None
    vertical_armed: VerticalMode | None = None
    target_vertical_speed_fpm: float = 0.0
    disconnect_reason: str = ""


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
    - Armed modes become active only through an explicit capture transition.
    - Disengaging the master switch resets active and armed modes and records
      an optional application-supplied reason.
    """

    def __init__(self, state: AutopilotState | None = None) -> None:
        self._state = state if state is not None else AutopilotState()

    # ------------------------------------------------------------------
    # Public read access
    # ------------------------------------------------------------------

    @property
    def state(self) -> AutopilotState:
        """Return a copy of the current autopilot state."""
        return replace(self._state)

    # ------------------------------------------------------------------
    # Master switch
    # ------------------------------------------------------------------

    def engage(self) -> None:
        """Engage the autopilot master switch."""
        self._state.master_on = True
        self._state.disconnect_reason = ""

    def disengage(self, reason: str = "") -> None:
        """Disengage the autopilot and reset all modes to defaults."""
        self._state.master_on = False
        self._state.lateral_mode = LateralMode.ROL
        self._state.vertical_mode = VerticalMode.PIT
        self._state.approach_armed = False
        self._state.lateral_armed = None
        self._state.vertical_armed = None
        self._state.disconnect_reason = reason

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
        self._state.lateral_armed = None
        if mode in _APPROACH_LATERAL_MODES:
            self._state.approach_armed = True
        return True

    def arm_lateral_mode(self, mode: LateralMode) -> bool:
        """Arm a lateral mode without making it active."""
        if not self._state.master_on:
            return False
        self._state.lateral_armed = mode
        return True

    def capture_lateral_mode(self, mode: LateralMode) -> bool:
        """Activate a lateral mode only when that mode is armed."""
        if not self._state.master_on or self._state.lateral_armed != mode:
            return False
        self._state.lateral_mode = mode
        self._state.lateral_armed = None
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
        self._state.vertical_armed = None
        return True

    def arm_vertical_mode(self, mode: VerticalMode) -> bool:
        """Arm a vertical mode without making it active."""
        if not self._state.master_on:
            return False
        self._state.vertical_armed = mode
        return True

    def capture_vertical_mode(self, mode: VerticalMode) -> bool:
        """Activate a vertical mode only when that mode is armed."""
        if not self._state.master_on or self._state.vertical_armed != mode:
            return False
        self._state.vertical_mode = mode
        self._state.vertical_armed = None
        return True

    def set_target_vertical_speed(self, target_fpm: float) -> None:
        """Update the selected vertical-speed target."""
        self._state.target_vertical_speed_fpm = float(target_fpm)

    # ------------------------------------------------------------------
    # Convenience helpers
    # ------------------------------------------------------------------

    def arm_approach(self) -> None:
        """Arm the approach mode without changing the lateral mode."""
        if self._state.master_on:
            self._state.approach_armed = True
