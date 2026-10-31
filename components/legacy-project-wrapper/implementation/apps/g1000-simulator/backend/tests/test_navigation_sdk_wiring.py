"""Guard G1000 route geodesy at the common Aviation SDK boundary."""

from pathlib import Path

import pytest

from app.services.routing import RoutingService


def test_routing_uses_component_distance_and_bearing_semantics() -> None:
    routing = RoutingService()
    assert routing._calculate_distance((0, 0), (0, 1)) == pytest.approx(60.0404607326)
    assert routing._calculate_heading((0, 0), (0, 1)) == 90.0


def test_routing_rejects_invalid_sdk_coordinates() -> None:
    with pytest.raises(ValueError, match="Invalid WGS-84 coordinate"):
        RoutingService()._calculate_distance((91, 0), (0, 0))


def test_routing_does_not_reimplement_geodesy() -> None:
    source = (Path(__file__).resolve().parents[1] / "app/services/routing.py").read_text(
        encoding="utf-8"
    )
    assert "3440.065" not in source
    assert "math.sin" not in source
    assert "math.atan2" not in source
