"""Unit tests for the AHRS service (apps/g1000-simulator/backend/app/services/ahrs.py)."""
from __future__ import annotations

import math
import sys
import os

# Ensure the backend app directory is on the path when running from the
# tests/backend/ context.
_BACKEND_DIR = os.path.join(os.path.dirname(__file__), "..", "..", "backend")
if _BACKEND_DIR not in sys.path:
    sys.path.insert(0, _BACKEND_DIR)

from app.services.ahrs import (
    AhrsSolution,
    clamp,
    compute_ahrs,
    compute_slip_skid,
    estimate_magnetic_variation,
    normalize_heading,
)


# ---------------------------------------------------------------------------
# clamp
# ---------------------------------------------------------------------------

def test_clamp_returns_minimum_when_below() -> None:
    assert clamp(-5.0, 0.0, 10.0) == 0.0


def test_clamp_returns_maximum_when_above() -> None:
    assert clamp(15.0, 0.0, 10.0) == 10.0


def test_clamp_returns_value_when_within_range() -> None:
    assert clamp(5.0, 0.0, 10.0) == 5.0


def test_clamp_returns_value_at_exact_minimum() -> None:
    assert clamp(0.0, 0.0, 10.0) == 0.0


def test_clamp_returns_value_at_exact_maximum() -> None:
    assert clamp(10.0, 0.0, 10.0) == 10.0


# ---------------------------------------------------------------------------
# normalize_heading
# ---------------------------------------------------------------------------

def test_normalize_heading_wraps_360() -> None:
    assert normalize_heading(360.0) == 0.0


def test_normalize_heading_wraps_negative() -> None:
    # Python modulo of negative numbers yields a positive result for positive divisor.
    result = normalize_heading(-10.0)
    assert result == 350.0


def test_normalize_heading_passthrough_for_valid_heading() -> None:
    assert normalize_heading(180.0) == 180.0


def test_normalize_heading_wraps_over_360() -> None:
    assert normalize_heading(450.0) == 90.0


# ---------------------------------------------------------------------------
# estimate_magnetic_variation
# ---------------------------------------------------------------------------

def test_magnetic_variation_positive_longitude() -> None:
    variation = estimate_magnetic_variation(37.0, 100.0)
    assert variation == 10.0  # 100 * 0.1 = 10


def test_magnetic_variation_negative_longitude() -> None:
    variation = estimate_magnetic_variation(37.0, -122.0)
    assert variation == -12.2  # -122 * 0.1


def test_magnetic_variation_clamps_positive() -> None:
    variation = estimate_magnetic_variation(0.0, 400.0)
    assert variation == 30.0


def test_magnetic_variation_clamps_negative() -> None:
    variation = estimate_magnetic_variation(0.0, -400.0)
    assert variation == -30.0


def test_magnetic_variation_zero_longitude() -> None:
    variation = estimate_magnetic_variation(51.5, 0.0)
    assert variation == 0.0


# ---------------------------------------------------------------------------
# compute_slip_skid
# ---------------------------------------------------------------------------

def test_slip_skid_zero_for_coordinated_turn() -> None:
    """A perfectly coordinated turn produces zero slip/skid."""
    roll_deg = 20.0
    airspeed_kt = 100.0
    speed_mps = airspeed_kt * 0.514444
    bank_rad = math.radians(roll_deg)
    coordinated_rate = math.degrees(9.80665 * math.tan(bank_rad) / speed_mps)
    result = compute_slip_skid(coordinated_rate, roll_deg, airspeed_kt)
    assert abs(result) < 0.001


def test_slip_skid_positive_for_excess_turn_rate() -> None:
    result = compute_slip_skid(5.0, 0.0, 100.0)
    assert result > 0.0


def test_slip_skid_negative_for_insufficient_turn_rate() -> None:
    result = compute_slip_skid(-5.0, 0.0, 100.0)
    assert result < 0.0


def test_slip_skid_clamped_to_max() -> None:
    result = compute_slip_skid(1000.0, 0.0, 100.0)
    assert result == 10.0


def test_slip_skid_clamped_to_min() -> None:
    result = compute_slip_skid(-1000.0, 0.0, 100.0)
    assert result == -10.0


def test_slip_skid_uses_minimum_speed_to_avoid_division_by_zero() -> None:
    # airspeed of 0 should not raise; speed is floored at 1.0 m/s
    result = compute_slip_skid(3.0, 0.0, 0.0)
    assert isinstance(result, float)


# ---------------------------------------------------------------------------
# compute_ahrs
# ---------------------------------------------------------------------------

def test_compute_ahrs_returns_ahrs_solution() -> None:
    solution = compute_ahrs(
        heading_deg=180.0,
        pitch_deg=2.0,
        roll_deg=0.0,
        turn_rate_dps=0.0,
        airspeed_kt=90.0,
        latitude_deg=37.6,
        longitude_deg=-122.4,
    )
    assert isinstance(solution, AhrsSolution)


def test_compute_ahrs_true_heading_normalised() -> None:
    solution = compute_ahrs(
        heading_deg=370.0,
        pitch_deg=0.0,
        roll_deg=0.0,
        turn_rate_dps=0.0,
        airspeed_kt=90.0,
        latitude_deg=0.0,
        longitude_deg=0.0,
    )
    assert solution.true_heading_deg == 10.0


def test_compute_ahrs_magnetic_heading_applies_variation() -> None:
    # At longitude 100, variation = 10 deg; mag heading = true - variation
    solution = compute_ahrs(
        heading_deg=180.0,
        pitch_deg=0.0,
        roll_deg=0.0,
        turn_rate_dps=0.0,
        airspeed_kt=100.0,
        latitude_deg=0.0,
        longitude_deg=100.0,
    )
    # variation = 10, magnetic = (180 - 10) % 360 = 170
    assert solution.magnetic_heading_deg == pytest_approx(170.0)


def test_compute_ahrs_pitch_and_roll_preserved() -> None:
    solution = compute_ahrs(
        heading_deg=90.0,
        pitch_deg=5.0,
        roll_deg=-15.0,
        turn_rate_dps=0.0,
        airspeed_kt=100.0,
        latitude_deg=0.0,
        longitude_deg=0.0,
    )
    assert solution.pitch_deg == 5.0
    assert solution.roll_deg == -15.0


def test_compute_ahrs_to_dict_contains_expected_keys() -> None:
    solution = compute_ahrs(
        heading_deg=90.0,
        pitch_deg=0.0,
        roll_deg=0.0,
        turn_rate_dps=0.0,
        airspeed_kt=90.0,
        latitude_deg=37.0,
        longitude_deg=-122.0,
    )
    d = solution.to_dict()
    for key in (
        "heading_deg",
        "true_heading_deg",
        "pitch_deg",
        "roll_deg",
        "yaw_deg",
        "slip_skid_deg",
        "magnetic_variation_deg",
    ):
        assert key in d, f"Missing key: {key}"


def test_compute_ahrs_yaw_equals_true_heading() -> None:
    solution = compute_ahrs(
        heading_deg=270.0,
        pitch_deg=0.0,
        roll_deg=0.0,
        turn_rate_dps=0.0,
        airspeed_kt=90.0,
        latitude_deg=0.0,
        longitude_deg=0.0,
    )
    assert solution.yaw_deg == solution.true_heading_deg


# Compatibility shim: pytest.approx is used via the module import style below.
try:
    from pytest import approx as pytest_approx
except ImportError:
    def pytest_approx(value, rel=None, abs=None):  # type: ignore
        return value
