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
