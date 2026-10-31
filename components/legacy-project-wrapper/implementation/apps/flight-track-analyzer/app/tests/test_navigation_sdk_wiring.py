"""Keep common navigation arithmetic outside the Flight Track Analyzer app."""

from pathlib import Path

FLIGHTLAB = Path(__file__).parents[1] / "flightlab"


def test_airport_index_delegates_final_distance_to_sdk() -> None:
    source = (FLIGHTLAB / "airports.py").read_text()
    assert "from aviation.navigation import distance_km" in source
    assert "EARTH_KM" not in source
    assert "np.arcsin" not in source


def test_track_wind_components_delegate_to_sdk() -> None:
    source = (FLIGHTLAB / "analyze.py").read_text()
    assert "from aviation.navigation import wind_components_from_vector" in source
    assert "def _wind_components" not in source


def test_reported_wind_components_delegate_to_sdk() -> None:
    source = (FLIGHTLAB / "poh.py").read_text()
    assert "wind_components" in source
    assert 'math.radians(meta["wind_from_deg"]' not in source


def test_track_geometry_delegates_to_sdk() -> None:
    source = (FLIGHTLAB / "geo.py").read_text()
    for operation in (
        "to_local_tangent_plane",
        "from_local_tangent_plane",
        "heading_difference",
        "circular_mean_heading",
        "navigation_runway_designator",
    ):
        assert operation in source
    assert "EARTH_R" not in source
    assert "np.radians" not in source
    assert "% 360.0" not in source


def test_turn_physics_delegates_to_flight_dynamics_sdk() -> None:
    source = (FLIGHTLAB / "track.py").read_text()
    assert "from aviation_flight_dynamics import coordinated_turn_bank_deg" in source
    assert "np.degrees(np.arctan(gs *" not in source
    assert "np.radians(np.abs(turn_dps))" not in source


def test_measured_performance_remains_analyzer_policy() -> None:
    source = (FLIGHTLAB / "performance.py").read_text()
    for policy in ("def seg_rows", "np.polyfit", "np.percentile", "best_rate_speed_kt"):
        assert policy in source
