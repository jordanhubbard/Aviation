from __future__ import annotations

import json
import math
from pathlib import Path

import pytest

from aviation_avionics import (
    AdfStation,
    AudioPanelState,
    DmeStation,
    MarkerBeaconSite,
    MarkerBeaconStatus,
    TransponderState,
    compute_adc,
    compute_adf,
    compute_ahrs,
    compute_dme,
    compute_gps,
    compute_marker_beacons,
    normalize_squawk,
)


PACKAGED_VECTORS = Path(__file__).parents[4] / "conformance" / "aviation-avionics.json"
AUTHORITY_VECTORS = Path(__file__).parents[7] / "components" / "aviation-avionics" / "acceptance" / "vectors.json"


def _load_vectors() -> dict:
    packaged = json.loads(PACKAGED_VECTORS.read_text())
    if AUTHORITY_VECTORS.exists():
        assert packaged == json.loads(AUTHORITY_VECTORS.read_text())
    return packaged


VECTORS = _load_vectors()


def _assert_record(actual: dict, expected: dict) -> None:
    for key, value in expected.items():
        if isinstance(value, bool):
            assert actual[key] is value
        elif isinstance(value, (int, float)):
            assert actual[key] == pytest.approx(value, abs=1e-9)
        else:
            assert actual[key] == value


def test_ahrs_vector() -> None:
    actual = compute_ahrs(**VECTORS["devices"]["ahrs"]["input"])
    _assert_record(actual.to_dict(), VECTORS["devices"]["ahrs"]["expected"])


def test_adc_vector() -> None:
    actual = compute_adc(**VECTORS["devices"]["adc"]["input"])
    _assert_record(actual.to_dict(), VECTORS["devices"]["adc"]["expected"])


def test_gps_vector() -> None:
    actual = compute_gps(**VECTORS["devices"]["gps"]["input"])
    _assert_record(actual.to_dict(), VECTORS["devices"]["gps"]["expected"])


def test_adf_vector() -> None:
    vector = VECTORS["radios"]["adf"]
    actual = compute_adf(
        **{
            **vector["input"],
            "stations": [AdfStation(**value) for value in vector["input"]["stations"]],
        }
    )
    _assert_record(actual.to_dict(), vector["expected"])


def test_dme_vector() -> None:
    vector = VECTORS["radios"]["dme"]
    actual = compute_dme(
        **{
            **vector["input"],
            "stations": [DmeStation(**value) for value in vector["input"]["stations"]],
        }
    )
    _assert_record(actual.to_dict(), vector["expected"])


def test_unavailable_radio_vector() -> None:
    vector = VECTORS["radios"]["unavailable_adf"]
    actual = compute_adf(
        **{
            **vector["input"],
            "stations": [AdfStation(**value) for value in vector["input"]["stations"]],
        }
    )
    _assert_record(actual.to_dict(), vector["expected"])
    vector = VECTORS["radios"]["unavailable_dme"]
    actual = compute_dme(
        **{
            **vector["input"],
            "stations": [DmeStation(**value) for value in vector["input"]["stations"]],
        }
    )
    _assert_record(actual.to_dict(), vector["expected"])


def test_marker_beacon_and_audio_panel_vectors() -> None:
    marker = VECTORS["controls"]["marker_beacons"]
    actual = compute_marker_beacons(
        **{
            **marker["input"],
            "sites": [MarkerBeaconSite(**value) for value in marker["input"]["sites"]],
        }
    )
    _assert_record(actual.to_dict(), marker["expected"])
    audio = VECTORS["controls"]["audio_panel"]
    state = AudioPanelState(**audio["state"])
    status = MarkerBeaconStatus(**audio["marker_status"])
    _assert_record(state.to_status(audio["adf_signal_strength"], status), audio["expected"])


def test_transponder_vector() -> None:
    vector = VECTORS["controls"]["transponder"]
    state = TransponderState(**vector["initial"])
    state.transition(**vector["trigger"])
    _assert_record(state.to_dict(), vector["triggered_expected"])
    state.update(vector["elapsed_sec"])
    _assert_record(state.to_dict(), vector["elapsed_expected"])
    assert normalize_squawk("77") == "0077"
    assert normalize_squawk("1280") is None


def test_device_models_reject_invalid_inputs() -> None:
    with pytest.raises(ValueError):
        compute_ahrs(**{**VECTORS["devices"]["ahrs"]["input"], "pitch_deg": math.nan})
    with pytest.raises(ValueError):
        compute_adc(**{**VECTORS["devices"]["adc"]["input"], "altimeter_setting_inhg": 0})
    with pytest.raises(ValueError):
        compute_gps(**{**VECTORS["devices"]["gps"]["input"], "latitude_deg": 91})
    with pytest.raises(ValueError):
        vector = VECTORS["radios"]["adf"]["input"]
        compute_adf(
            **{
                **vector,
                "latitude_deg": 91,
                "stations": [AdfStation(**value) for value in vector["stations"]],
            }
        )
    with pytest.raises(ValueError):
        vector = VECTORS["radios"]["adf"]["input"]
        compute_adf(
            **{
                **vector,
                "tuned_frequency_khz": 0,
                "stations": [AdfStation(**value) for value in vector["stations"]],
            }
        )
    with pytest.raises(ValueError):
        vector = VECTORS["radios"]["dme"]["input"]
        compute_dme(
            **{
                **vector,
                "stations": [
                    DmeStation(**{**value, "max_range_nm": 0})
                    for value in vector["stations"]
                ],
            }
        )
    marker = VECTORS["controls"]["marker_beacons"]["input"]
    with pytest.raises(ValueError):
        compute_marker_beacons(
            marker["latitude_deg"],
            marker["longitude_deg"],
            marker["altitude_ft"],
            [
                MarkerBeaconSite(**{**marker["sites"][0], "inner_radius_nm": 2})
            ],
        )
    audio = VECTORS["controls"]["audio_panel"]
    with pytest.raises(ValueError):
        AudioPanelState(**{**audio["state"], "marker_volume": 1.1}).to_status(
            0.5, MarkerBeaconStatus(**audio["marker_status"])
        )
    with pytest.raises(ValueError):
        TransponderState(**VECTORS["controls"]["transponder"]["initial"]).transition(
            squawk_code="1280"
        )
    with pytest.raises(ValueError):
        TransponderState(**VECTORS["controls"]["transponder"]["initial"]).transition(
            mode="ALT"
        )
    with pytest.raises(ValueError):
        vector = VECTORS["radios"]["dme"]["input"]
        compute_dme(
            **{
                **vector,
                "tuned_frequency_mhz": -1,
                "stations": [DmeStation(**value) for value in vector["stations"]],
            }
        )
