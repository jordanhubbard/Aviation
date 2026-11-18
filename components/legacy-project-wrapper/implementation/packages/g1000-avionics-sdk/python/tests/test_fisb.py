"""FAA five-TAF application field plus shared hostile and independent wire cases."""

import json
from pathlib import Path

import pytest

from aviation_avionics.gdl90 import Gdl90Decoder
from aviation_avionics.gdl90_reports import UplinkReport

PACKAGED = Path(__file__).parents[4] / "conformance/aviation-fisb.json"
AUTHORITY = Path(__file__).parents[7] / "components/aviation-avionics/acceptance/fisb.json"
VECTORS = json.loads(PACKAGED.read_text())


def test_published_five_tafs_at_every_framing_boundary():
    assert not AUTHORITY.exists() or json.loads(AUTHORITY.read_text()) == VECTORS
    frame = bytes.fromhex(VECTORS["frame_hex"])
    for split in range(len(frame) + 1):
        decoder = Gdl90Decoder()
        a, b = decoder.push(frame[:split]), decoder.push(frame[split:])
        assert a["errors"] + b["errors"] == []
        messages = a["messages"] + b["messages"]
        assert len(messages) == 1
        report = messages[0]
        UplinkReport(**report)
        assert report["kind"] == "uplink" and report["application_data_valid"]
        assert report["time_of_reception_ns"] is None
        assert report["errors"] == []
        assert [r["location_id"] for r in report["records"]] == VECTORS["expected_locations"]
        assert all(r["report_type"] == VECTORS["expected_report_type"] for r in report["records"])
        assert all(r["report_time"] == VECTORS["expected_report_time"] for r in report["records"])
        assert report["records"][0]["raw_text"] == VECTORS["expected_first_raw_text"]


@pytest.mark.parametrize("vector", VECTORS["cases"], ids=lambda v: v["id"])
def test_shared_wire_cases(vector):
    result = Gdl90Decoder().push(bytes.fromhex(vector["frame_hex"]))
    if "error" in vector:
        assert result == {"messages": [], "errors": [vector["error"]]}
        return
    assert result["errors"] == [] and len(result["messages"]) == 1
    report = result["messages"][0]
    UplinkReport(**report)
    for field, expected in vector["expected"].items():
        if field == "has_errors":
            assert bool(report["errors"]) == expected
        else:
            assert report[field] == expected
