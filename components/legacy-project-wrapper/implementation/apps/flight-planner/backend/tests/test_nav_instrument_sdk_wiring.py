"""Guard Flight Planner's simulated nav instruments at the common SDK boundary."""

from pathlib import Path
from unittest.mock import patch

import pytest

from app.services.gps_simulation import simulate_groundspeed_and_track
from app.services.hsi_integration import (
    CDIMode,
    calculate_bearing_pointer,
    calculate_cdi_deviation,
    calculate_to_from_flag,
)
from app.services.nav_radio_simulation import (
    calculate_adf_bearing,
    calculate_dme_range,
    calculate_vor_radial,
)

BACKEND = Path(__file__).resolve().parents[1]
INSTRUMENT_MODULES = (
    "app/services/nav_radio_simulation.py",
    "app/services/hsi_integration.py",
    "app/services/gps_simulation.py",
)


def test_radio_geometry_uses_wgs84_sdk_semantics() -> None:
    aircraft = (0.0, 0.0)
    station = (1.0, 0.0)

    assert calculate_adf_bearing(station, aircraft) == pytest.approx(0.0)
    assert calculate_dme_range(station, aircraft) == pytest.approx(60.0404607326)
    assert calculate_vor_radial(1.0, 359.0) == pytest.approx(2.0)

    with pytest.raises(ValueError, match="latitude_deg out of range"):
        calculate_adf_bearing(station, (91.0, 0.0))


def test_hsi_preserves_display_policy_over_sdk_angles() -> None:
    aircraft = (0.0, 0.0)
    station = (1.0, 0.0)

    assert calculate_bearing_pointer(station, aircraft, 90.0) == pytest.approx(270.0)
    assert calculate_cdi_deviation(1.0, 359.0, CDIMode.GPS) == pytest.approx(2.0)
    assert calculate_cdi_deviation(20.0, 0.0, CDIMode.LOC) == pytest.approx(2.5)
    assert calculate_cdi_deviation(-20.0, 0.0, CDIMode.VOR) == pytest.approx(-10.0)
    assert calculate_to_from_flag(90.0, 0.0) == "TO"
    assert calculate_to_from_flag(91.0, 0.0) == "FROM"


def test_gps_error_injection_retains_sdk_track_normalization() -> None:
    with patch("app.services.gps_simulation.random.uniform", side_effect=[0.25, 0.5]):
        speed, track = simulate_groundspeed_and_track(100.0, 359.75)

    assert speed == pytest.approx(100.25)
    assert track == pytest.approx(0.25)


def test_instrument_adapters_do_not_reimplement_common_geometry() -> None:
    for relative_path in INSTRUMENT_MODULES:
        source = (BACKEND / relative_path).read_text(encoding="utf-8")
        assert "import math" not in source, relative_path
        assert "math.atan2" not in source, relative_path
        assert "math.sqrt" not in source, relative_path
        assert "% 360" not in source, relative_path

    radio_source = (BACKEND / INSTRUMENT_MODULES[0]).read_text(encoding="utf-8")
    assert "initial_bearing_deg" in radio_source
    assert "great_circle_distance_nm" in radio_source

    hsi_source = (BACKEND / INSTRUMENT_MODULES[1]).read_text(encoding="utf-8")
    assert "normalize_signed_angle" in hsi_source
    assert "initial_bearing_deg" in hsi_source

    gps_source = (BACKEND / INSTRUMENT_MODULES[2]).read_text(encoding="utf-8")
    assert "normalize_heading" in gps_source
