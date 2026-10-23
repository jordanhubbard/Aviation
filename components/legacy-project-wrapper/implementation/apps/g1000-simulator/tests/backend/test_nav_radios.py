"""Unit tests for the NAV radios service (apps/g1000-simulator/backend/app/services/nav_radios.py)."""
from __future__ import annotations

import sys
import os

_BACKEND_DIR = os.path.join(os.path.dirname(__file__), "..", "..", "backend")
if _BACKEND_DIR not in sys.path:
    sys.path.insert(0, _BACKEND_DIR)

from app.services.nav_radios import (
    calculate_vor_radial,
    calculate_ils_localizer,
    calculate_adf_bearing,
    calculate_dme_range,
)


# ---------------------------------------------------------------------------
# calculate_vor_radial
# ---------------------------------------------------------------------------

def test_vor_radial_returns_input_bearing() -> None:
    assert calculate_vor_radial(90.0) == 90.0


def test_vor_radial_zero_bearing() -> None:
    assert calculate_vor_radial(0.0) == 0.0


def test_vor_radial_360_bearing() -> None:
    assert calculate_vor_radial(360.0) == 360.0


def test_vor_radial_negative_bearing() -> None:
    result = calculate_vor_radial(-45.0)
    assert result == -45.0


def test_vor_radial_full_circle() -> None:
    for bearing in range(0, 361, 45):
        assert calculate_vor_radial(float(bearing)) == float(bearing)


# ---------------------------------------------------------------------------
# calculate_ils_localizer
# ---------------------------------------------------------------------------

def test_ils_localizer_returns_input_deviation() -> None:
    assert calculate_ils_localizer(2.5) == 2.5


def test_ils_localizer_zero_deviation() -> None:
    assert calculate_ils_localizer(0.0) == 0.0


def test_ils_localizer_negative_deviation() -> None:
    assert calculate_ils_localizer(-1.5) == -1.5


def test_ils_localizer_full_scale_positive() -> None:
    assert calculate_ils_localizer(2.0) == 2.0


def test_ils_localizer_full_scale_negative() -> None:
    assert calculate_ils_localizer(-2.0) == -2.0


# ---------------------------------------------------------------------------
# calculate_adf_bearing
# ---------------------------------------------------------------------------

def test_adf_bearing_returns_input_bearing() -> None:
    assert calculate_adf_bearing(45.0) == 45.0


def test_adf_bearing_zero() -> None:
    assert calculate_adf_bearing(0.0) == 0.0


def test_adf_bearing_180() -> None:
    assert calculate_adf_bearing(180.0) == 180.0


def test_adf_bearing_270() -> None:
    assert calculate_adf_bearing(270.0) == 270.0


def test_adf_bearing_fractional() -> None:
    result = calculate_adf_bearing(123.456)
    assert abs(result - 123.456) < 1e-9


# ---------------------------------------------------------------------------
# calculate_dme_range
# ---------------------------------------------------------------------------

def test_dme_range_returns_input_distance() -> None:
    assert calculate_dme_range(10.0) == 10.0


def test_dme_range_zero() -> None:
    assert calculate_dme_range(0.0) == 0.0


def test_dme_range_large_distance() -> None:
    assert calculate_dme_range(200.0) == 200.0


def test_dme_range_fractional() -> None:
    result = calculate_dme_range(7.5)
    assert result == 7.5


def test_dme_range_negative_distance() -> None:
    # The current implementation is a passthrough; negative inputs are returned as-is.
    assert calculate_dme_range(-1.0) == -1.0
