"""Guard G1000 route geodesy at the common Aviation SDK boundary."""

from pathlib import Path

import pytest

from aviation.navigation import destination
from app.services.flight_dynamics import FlightDynamicsSimulator
from app.services.routing import RoutingService


def test_routing_uses_component_distance_and_bearing_semantics() -> None:
    routing = RoutingService()
    assert routing._calculate_distance((0, 0), (0, 1)) == pytest.approx(60.0404607326)
    assert routing._calculate_heading((0, 0), (0, 1)) == 90.0


def test_routing_rejects_invalid_sdk_coordinates() -> None:
    with pytest.raises(ValueError, match="Invalid WGS-84 coordinate"):
        RoutingService()._calculate_distance((91, 0), (0, 0))


def test_routing_does_not_reimplement_geodesy() -> None:
    source = (
        Path(__file__).resolve().parents[1] / "app/services/routing.py"
    ).read_text(encoding="utf-8")
    assert "3440.065" not in source
    assert "math.sin" not in source
    assert "math.atan2" not in source


def test_flight_dynamics_delegates_heading_and_position_stepping() -> None:
    simulator = FlightDynamicsSimulator()
    simulator.state.latitude_deg = 37.618805
    simulator.state.longitude_deg = -122.375416
    simulator.state.heading_deg = 90.0
    simulator.state.airspeed_kt = 120.0

    expected = destination(37.618805, -122.375416, 2.0, 90.0)
    simulator._update_position(60.0)
    assert simulator.state.latitude_deg == pytest.approx(expected[0])
    assert simulator.state.longitude_deg == pytest.approx(expected[1])

    source = (
        Path(__file__).resolve().parents[1] / "app/services/flight_dynamics.py"
    ).read_text(encoding="utf-8")
    for operation in ("destination", "heading_difference", "normalize_bearing"):
        assert operation in source
    assert "def normalize_heading" not in source
    assert "def heading_difference" not in source
    assert "math.radians" not in source
    assert "delta_lat" not in source
    assert "delta_lon" not in source


def test_unrealized_private_geodesy_service_stays_removed() -> None:
    backend = Path(__file__).resolve().parents[1]
    assert not (backend / "app/services/geo_calculations.py").exists()

    main_source = (backend / "app/main.py").read_text(encoding="utf-8")
    assert "GeoCalculationsService" not in main_source
    assert "geo_calculations_service" not in main_source
