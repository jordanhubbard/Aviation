"""Tests for the navmath helpers.

Self-contained: it loads app/navmath.py directly by file path (importlib), so it
does NOT import the `app` package (and thus needs none of the flight-planner web
dependencies) — it runs on a plain Python with only the stdlib. New helpers add a
test block below, converging on this file the same way they converge on
app/navmath.py.

Run: python3 -m pytest backend/tests/test_navmath.py --noconftest -p no:cacheprovider -q
"""

import importlib.util
import math
from pathlib import Path

import pytest

_MOD_PATH = Path(__file__).resolve().parents[1] / "app" / "navmath.py"
_spec = importlib.util.spec_from_file_location("navmath", _MOD_PATH)
navmath = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(navmath)


def test_normalize_heading():
    assert navmath.normalize_heading(0) == 0.0
    assert navmath.normalize_heading(360) == 0.0
    assert navmath.normalize_heading(370) == 10.0
    assert navmath.normalize_heading(-10) == 350.0
    assert navmath.normalize_heading(720.0) == 0.0


def test_heading_difference():
    assert navmath.heading_difference(10, 40) == 30
    assert navmath.heading_difference(350, 10) == 20
    assert navmath.heading_difference(10, 350) == -20
    assert navmath.heading_difference(0, 180) == 180
    # Opposite headings clamp to the inclusive upper bound (+180, never -180).
    assert navmath.heading_difference(180, 0) == 180
    # No-op turn.
    assert navmath.heading_difference(90, 90) == 0


def test_crosswind_component():
    # Direct 90-deg crosswind from the right: full wind speed, positive.
    assert navmath.crosswind_component(0, 90, 10) == pytest.approx(10.0, abs=1e-6)
    # Pure headwind: no crosswind.
    assert navmath.crosswind_component(0, 0, 10) == pytest.approx(0.0, abs=1e-6)
    # 45-deg wind: wind_speed * sin(45 deg) ~= 7.071.
    assert navmath.crosswind_component(0, 45, 10) == pytest.approx(
        10 * math.sin(math.radians(45)), abs=1e-6
    )
    # Wind from the left (270) is negative.
    assert navmath.crosswind_component(0, 270, 10) == pytest.approx(-10.0, abs=1e-6)


def test_haversine_nm():
    # Identical points -> zero distance.
    assert navmath.haversine_nm(0.0, 0.0, 0.0, 0.0) == pytest.approx(0.0)
    assert navmath.haversine_nm(40.0, -75.0, 40.0, -75.0) == pytest.approx(0.0)

    # One degree of latitude is ~60 NM (a nautical mile is ~1 arcminute).
    assert navmath.haversine_nm(0.0, 0.0, 1.0, 0.0) == pytest.approx(60.0, abs=0.5)

    # One degree of longitude at the equator is also ~60 NM.
    assert navmath.haversine_nm(0.0, 0.0, 0.0, 1.0) == pytest.approx(60.0, abs=0.5)

    # Distance is symmetric.
    assert navmath.haversine_nm(0.0, 0.0, 0.0, 1.0) == pytest.approx(
        navmath.haversine_nm(0.0, 1.0, 0.0, 0.0)
    )
