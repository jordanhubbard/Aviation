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
