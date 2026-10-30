from __future__ import annotations

from app.services.flight_dynamics import FlightDynamicsSimulator
from app.services.nav_radios import (
    DEFAULT_ADF_FREQUENCY_KHZ,
    DEFAULT_DME_FREQUENCY_MHZ,
    DEFAULT_DME_STATIONS,
    compute_adf,
    compute_dme,
)


def test_default_dme_station_comes_from_common_nav_data_catalog() -> None:
    assert DEFAULT_DME_STATIONS
    assert DEFAULT_DME_STATIONS[0].station_ident == "SFO"
    assert DEFAULT_DME_FREQUENCY_MHZ == 115.8


def test_g1000_radio_adapter_returns_real_station_geometry() -> None:
    adf = compute_adf(37.5, -122.2, 90.0, DEFAULT_ADF_FREQUENCY_KHZ)
    dme = compute_dme(
        37.5,
        -122.2,
        5000.0,
        90.0,
        110.0,
        DEFAULT_DME_FREQUENCY_MHZ,
    )

    assert adf.receiving is True
    assert adf.station_ident == "SDK"
    assert adf.distance_nm > 0.0
    assert adf.bearing_deg != 0.0
    assert dme.receiving is True
    assert dme.station_ident == "SFO"
    assert dme.slant_range_nm > 0.0
    assert 0.0 < dme.signal_strength <= 1.0


def test_snapshot_radio_shape_matches_common_protocol() -> None:
    snapshot = FlightDynamicsSimulator().snapshot()

    assert set(snapshot["adf"]) == {
        "tuned_frequency_khz",
        "station_ident",
        "station_name",
        "bearing_deg",
        "relative_bearing_deg",
        "distance_nm",
        "signal_strength",
        "receiving",
    }
    assert set(snapshot["dme"]) == {
        "tuned_frequency_mhz",
        "station_ident",
        "station_name",
        "slant_range_nm",
        "ground_speed_kt",
        "signal_strength",
        "receiving",
    }


def test_out_of_tune_receiver_does_not_invent_station_data() -> None:
    solution = compute_adf(37.5, -122.2, 90.0, 1000.0)
    assert solution.receiving is False
    assert solution.station_ident == ""
    assert solution.distance_nm == 0.0
