"""Guard Flight Planner's geodesy boundary at the common Aviation SDK."""

from pathlib import Path

import pytest

from app import navmath
from app.services import a_star, approaches, xctry_route_planner

BACKEND = Path(__file__).resolve().parents[1]
GEODESY_MODULES = (
    "app/navmath.py",
    "app/services/xctry_route_planner.py",
    "app/services/a_star.py",
    "app/routers/local.py",
    "app/services/approaches.py",
)

WIND_MODULES = (
    "app/navmath.py",
    "app/services/wind.py",
)


def test_geodesy_modules_do_not_reimplement_haversine() -> None:
    for relative_path in GEODESY_MODULES:
        source = (BACKEND / relative_path).read_text(encoding="utf-8")
        assert "3440.065" not in source, relative_path
        assert "math.sin(dphi" not in source, relative_path
        assert "math.sin(dlat" not in source, relative_path


def test_all_compatibility_surfaces_use_sdk_distance_semantics() -> None:
    expected = navmath.haversine_nm(0, 0, 0, 1)
    assert expected == pytest.approx(60.0404607326)
    assert xctry_route_planner.haversine_nm(0, 0, 0, 1) == pytest.approx(expected)
    assert a_star.haversine_nm((0, 0), (0, 1)) == pytest.approx(expected)
    assert approaches.Waypoint("A", 0, 0).distance_to(
        approaches.Waypoint("B", 0, 1)
    ) == pytest.approx(expected)


def test_app_geodesy_rejects_invalid_sdk_coordinates() -> None:
    with pytest.raises(ValueError, match="Invalid WGS-84 coordinate"):
        navmath.haversine_nm(91, 0, 0, 0)


def test_unrealized_private_geodesy_service_stays_removed() -> None:
    assert not (BACKEND / "app/services/geo_calculations.py").exists()

    flight_plan_source = (BACKEND / "app/services/flight_plan_service.py").read_text(
        encoding="utf-8"
    )
    assert "GeoCalculations" not in flight_plan_source
    assert "geo_calculations" not in flight_plan_source


def test_wind_compatibility_surfaces_delegate_to_sdk() -> None:
    for relative_path in WIND_MODULES:
        source = (BACKEND / relative_path).read_text(encoding="utf-8")
        assert "import math" not in source, relative_path
    service_source = (BACKEND / "app/services/wind.py").read_text(encoding="utf-8")
    assert "initial_bearing" in service_source
    assert "wind_components" in service_source
    assert "ground_speed" in service_source


def test_heading_compatibility_preserves_policy_over_sdk_semantics() -> None:
    assert navmath.normalize_heading(-10) == 350.0
    assert navmath.heading_difference(350, 10) == 20.0
    assert navmath.heading_difference(0, 180) == 180.0

    navmath_source = (BACKEND / "app/navmath.py").read_text(encoding="utf-8")
    assert "heading_difference as sdk_heading_difference" in navmath_source
    assert "normalize_bearing" in navmath_source
    assert "(float(b) - float(a) + 180.0)" not in navmath_source
    assert "return float(deg) % 360.0" not in navmath_source

    dynamics_source = (BACKEND / "app/services/flight_dynamics.py").read_text(
        encoding="utf-8"
    )
    assert (
        "heading_difference(self.aircraft_state.heading, target_heading)"
        in dynamics_source
    )
    assert "target_heading - self.aircraft_state.heading" not in dynamics_source
    assert "normalize_heading(" in dynamics_source
