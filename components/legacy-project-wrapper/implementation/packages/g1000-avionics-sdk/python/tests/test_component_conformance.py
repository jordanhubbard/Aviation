from __future__ import annotations

import json
import math
from pathlib import Path

import pytest

from aviation_avionics import compute_adc, compute_ahrs, compute_gps


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


def test_device_models_reject_invalid_inputs() -> None:
    with pytest.raises(ValueError):
        compute_ahrs(**{**VECTORS["devices"]["ahrs"]["input"], "pitch_deg": math.nan})
    with pytest.raises(ValueError):
        compute_adc(**{**VECTORS["devices"]["adc"]["input"], "altimeter_setting_inhg": 0})
    with pytest.raises(ValueError):
        compute_gps(**{**VECTORS["devices"]["gps"]["input"], "latitude_deg": 91})
