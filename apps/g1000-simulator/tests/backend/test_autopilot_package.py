"""Unit tests for the flight-dynamics autopilot package.

Imports from packages/flight-dynamics/aviation_flight_dynamics/autopilot/.
Run from the repository root or with the flight-dynamics package installed /
on PYTHONPATH.
"""
from __future__ import annotations

import math

import pytest

from aviation_flight_dynamics.autopilot import (
    AltitudeHoldController,
    AutopilotMode,
    AutopilotModeController,
    AutopilotState,
    HeadingHoldController,
    LateralMode,
    PIDController,
    PIDGains,
    PitchController,
    RollController,
    VerticalMode,
)


# ---------------------------------------------------------------------------
# PIDGains / PIDController
# ---------------------------------------------------------------------------

class TestPIDController:
    def _make_controller(self, kp: float = 1.0, ki: float = 0.0, kd: float = 0.0) -> PIDController:
        return PIDController(gains=PIDGains(kp=kp, ki=ki, kd=kd))

    def test_proportional_output(self) -> None:
        ctrl = self._make_controller(kp=2.0)
        out = ctrl.update(3.0, dt=0.1)
        assert abs(out - 6.0) < 1e-9

    def test_zero_dt_returns_zero(self) -> None:
        ctrl = self._make_controller(kp=1.0)
        assert ctrl.update(5.0, dt=0.0) == 0.0

    def test_negative_dt_returns_zero(self) -> None:
        ctrl = self._make_controller(kp=1.0)
        assert ctrl.update(5.0, dt=-0.1) == 0.0

    def test_integral_accumulates(self) -> None:
        ctrl = self._make_controller(ki=1.0)
        ctrl.update(1.0, dt=0.5)  # integral = 0.5
        out = ctrl.update(1.0, dt=0.5)  # integral = 1.0, output = 1.0
        assert abs(out - 1.0) < 1e-9

    def test_derivative_on_first_call_is_zero(self) -> None:
        """On the first update there is no previous error, so derivative contribution is zero."""
        ctrl = self._make_controller(kd=10.0)
        out = ctrl.update(1.0, dt=0.1)
        # Only proportional term; kp defaults to 0, kd=10 but derivative=0 on first call
        ctrl2 = self._make_controller(kp=0.0, kd=10.0)
        out2 = ctrl2.update(1.0, dt=0.1)
        assert out2 == 0.0

    def test_derivative_computed_on_second_call(self) -> None:
        ctrl = self._make_controller(kp=0.0, ki=0.0, kd=1.0)
        ctrl.update(0.0, dt=0.1)
        # error goes from 0 to 2, derivative = (2 - 0) / 0.1 = 20
        out = ctrl.update(2.0, dt=0.1)
        assert abs(out - 20.0) < 1e-9

    def test_reset_clears_state(self) -> None:
        ctrl = self._make_controller(ki=1.0)
        ctrl.update(5.0, dt=1.0)
        ctrl.reset()
        assert ctrl.integral == 0.0
        assert ctrl.prev_error == 0.0

    def test_reset_then_behaves_like_fresh_controller(self) -> None:
        ctrl = self._make_controller(kp=1.0, ki=1.0)
        ctrl.update(10.0, dt=1.0)
        ctrl.reset()
        out = ctrl.update(3.0, dt=1.0)
        fresh = self._make_controller(kp=1.0, ki=1.0)
        expected = fresh.update(3.0, dt=1.0)
        assert abs(out - expected) < 1e-9


# ---------------------------------------------------------------------------
# PitchController
# ---------------------------------------------------------------------------

class TestPitchController:
    def test_returns_float(self) -> None:
        ctrl = PitchController(gains=PIDGains(kp=0.5, ki=0.0, kd=0.0))
        assert isinstance(ctrl.update(2.0, dt=0.1), float)

    def test_proportional_output(self) -> None:
        ctrl = PitchController(gains=PIDGains(kp=2.0, ki=0.0, kd=0.0))
        out = ctrl.update(3.0, dt=0.1)
        assert abs(out - 6.0) < 1e-9

    def test_reset_clears_state(self) -> None:
        ctrl = PitchController(gains=PIDGains(kp=1.0, ki=1.0, kd=0.0))
        ctrl.update(5.0, dt=1.0)
        ctrl.reset()
        fresh = PitchController(gains=PIDGains(kp=1.0, ki=1.0, kd=0.0))
        assert ctrl.update(1.0, dt=1.0) == fresh.update(1.0, dt=1.0)


# ---------------------------------------------------------------------------
# RollController
# ---------------------------------------------------------------------------

class TestRollController:
    def test_proportional_output(self) -> None:
        ctrl = RollController(gains=PIDGains(kp=1.5, ki=0.0, kd=0.0))
        out = ctrl.update(10.0, dt=0.1)
        assert abs(out - 15.0) < 1e-9

    def test_reset(self) -> None:
        ctrl = RollController(gains=PIDGains(kp=1.0, ki=0.5, kd=0.0))
        ctrl.update(4.0, dt=1.0)
        ctrl.reset()
        fresh = RollController(gains=PIDGains(kp=1.0, ki=0.5, kd=0.0))
        assert ctrl.update(2.0, dt=1.0) == fresh.update(2.0, dt=1.0)


# ---------------------------------------------------------------------------
# AltitudeHoldController
# ---------------------------------------------------------------------------

class TestAltitudeHoldController:
    def test_positive_altitude_error_yields_positive_pitch_command(self) -> None:
        ctrl = AltitudeHoldController(gains=PIDGains(kp=0.01, ki=0.0, kd=0.0))
        cmd = ctrl.update(500.0, dt=0.1)  # 500 ft above target
        assert cmd > 0.0

    def test_zero_error_yields_zero_command(self) -> None:
        ctrl = AltitudeHoldController(gains=PIDGains(kp=0.01, ki=0.0, kd=0.0))
        assert ctrl.update(0.0, dt=0.1) == 0.0

    def test_reset(self) -> None:
        ctrl = AltitudeHoldController(gains=PIDGains(kp=0.01, ki=0.001, kd=0.0))
        ctrl.update(200.0, dt=1.0)
        ctrl.reset()
        fresh = AltitudeHoldController(gains=PIDGains(kp=0.01, ki=0.001, kd=0.0))
        assert ctrl.update(100.0, dt=1.0) == fresh.update(100.0, dt=1.0)


# ---------------------------------------------------------------------------
# HeadingHoldController
# ---------------------------------------------------------------------------

class TestHeadingHoldController:
    def test_positive_error_yields_positive_bank_command(self) -> None:
        ctrl = HeadingHoldController(gains=PIDGains(kp=1.0, ki=0.0, kd=0.0))
        cmd = ctrl.update(10.0, dt=0.1)  # 10-degree heading error
        assert cmd > 0.0

    def test_negative_error_yields_negative_bank_command(self) -> None:
        ctrl = HeadingHoldController(gains=PIDGains(kp=1.0, ki=0.0, kd=0.0))
        cmd = ctrl.update(-10.0, dt=0.1)
        assert cmd < 0.0

    def test_zero_error_yields_zero_command(self) -> None:
        ctrl = HeadingHoldController(gains=PIDGains(kp=1.0, ki=0.0, kd=0.0))
        assert ctrl.update(0.0, dt=0.1) == 0.0


# ---------------------------------------------------------------------------
# AutopilotMode enum
# ---------------------------------------------------------------------------

def test_autopilot_mode_values() -> None:
    assert AutopilotMode.OFF.value == "OFF"
    assert AutopilotMode.ON.value == "ON"
    assert AutopilotMode.APPROACH.value == "APPROACH"


# ---------------------------------------------------------------------------
# LateralMode / VerticalMode enums
# ---------------------------------------------------------------------------

def test_lateral_mode_values() -> None:
    assert LateralMode.ROL.value == "ROL"
    assert LateralMode.HDG.value == "HDG"
    assert LateralMode.NAV.value == "NAV"
    assert LateralMode.APR.value == "APR"
    assert LateralMode.BC.value == "BC"


def test_vertical_mode_values() -> None:
    assert VerticalMode.PIT.value == "PIT"
    assert VerticalMode.VS.value == "VS"
    assert VerticalMode.ALT.value == "ALT"
    assert VerticalMode.ALTS.value == "ALTS"
    assert VerticalMode.GS.value == "GS"
    assert VerticalMode.GP.value == "GP"


# ---------------------------------------------------------------------------
# AutopilotState dataclass
# ---------------------------------------------------------------------------

def test_autopilot_state_defaults() -> None:
    state = AutopilotState()
    assert state.master_on is False
    assert state.lateral_mode == LateralMode.ROL
    assert state.vertical_mode == VerticalMode.PIT
    assert state.approach_armed is False


# ---------------------------------------------------------------------------
# AutopilotModeController
# ---------------------------------------------------------------------------

class TestAutopilotModeController:
    def _engaged(self) -> AutopilotModeController:
        ctrl = AutopilotModeController()
        ctrl.engage()
        return ctrl

    # Master switch
    def test_initial_state_is_disengaged(self) -> None:
        ctrl = AutopilotModeController()
        assert ctrl.state.master_on is False

    def test_engage_sets_master_on(self) -> None:
        ctrl = self._engaged()
        assert ctrl.state.master_on is True

    def test_disengage_resets_to_defaults(self) -> None:
        ctrl = self._engaged()
        ctrl.set_lateral_mode(LateralMode.HDG)
        ctrl.disengage()
        assert ctrl.state.master_on is False
        assert ctrl.state.lateral_mode == LateralMode.ROL
        assert ctrl.state.vertical_mode == VerticalMode.PIT
        assert ctrl.state.approach_armed is False

    # Lateral mode changes
    def test_set_lateral_mode_rejected_when_master_off(self) -> None:
        ctrl = AutopilotModeController()
        result = ctrl.set_lateral_mode(LateralMode.HDG)
        assert result is False
        assert ctrl.state.lateral_mode == LateralMode.ROL

    def test_set_lateral_mode_accepted_when_master_on(self) -> None:
        ctrl = self._engaged()
        result = ctrl.set_lateral_mode(LateralMode.HDG)
        assert result is True
        assert ctrl.state.lateral_mode == LateralMode.HDG

    def test_set_approach_lateral_mode_arms_approach(self) -> None:
        ctrl = self._engaged()
        ctrl.set_lateral_mode(LateralMode.APR)
        assert ctrl.state.approach_armed is True

    def test_set_bc_lateral_mode_arms_approach(self) -> None:
        ctrl = self._engaged()
        ctrl.set_lateral_mode(LateralMode.BC)
        assert ctrl.state.approach_armed is True

    def test_set_nav_lateral_mode_does_not_arm_approach(self) -> None:
        ctrl = self._engaged()
        ctrl.set_lateral_mode(LateralMode.NAV)
        assert ctrl.state.approach_armed is False

    # Vertical mode changes
    def test_set_vertical_mode_rejected_when_master_off(self) -> None:
        ctrl = AutopilotModeController()
        result = ctrl.set_vertical_mode(VerticalMode.ALT)
        assert result is False

    def test_set_vertical_mode_accepted_when_master_on(self) -> None:
        ctrl = self._engaged()
        result = ctrl.set_vertical_mode(VerticalMode.ALT)
        assert result is True
        assert ctrl.state.vertical_mode == VerticalMode.ALT

    def test_glideslope_requires_approach_armed(self) -> None:
        ctrl = self._engaged()
        result = ctrl.set_vertical_mode(VerticalMode.GS)
        assert result is False

    def test_glideslope_accepted_after_arming_approach(self) -> None:
        ctrl = self._engaged()
        ctrl.arm_approach()
        result = ctrl.set_vertical_mode(VerticalMode.GS)
        assert result is True
        assert ctrl.state.vertical_mode == VerticalMode.GS

    def test_glidepath_accepted_after_arming_approach(self) -> None:
        ctrl = self._engaged()
        ctrl.arm_approach()
        result = ctrl.set_vertical_mode(VerticalMode.GP)
        assert result is True
        assert ctrl.state.vertical_mode == VerticalMode.GP

    # arm_approach helper
    def test_arm_approach_requires_master_on(self) -> None:
        ctrl = AutopilotModeController()
        ctrl.arm_approach()
        assert ctrl.state.approach_armed is False

    def test_arm_approach_sets_flag_when_master_on(self) -> None:
        ctrl = self._engaged()
        ctrl.arm_approach()
        assert ctrl.state.approach_armed is True

    # state property returns a copy
    def test_state_property_returns_copy(self) -> None:
        ctrl = self._engaged()
        state1 = ctrl.state
        ctrl.set_lateral_mode(LateralMode.HDG)
        state2 = ctrl.state
        # The original state snapshot should not have been mutated.
        assert state1.lateral_mode == LateralMode.ROL
        assert state2.lateral_mode == LateralMode.HDG
