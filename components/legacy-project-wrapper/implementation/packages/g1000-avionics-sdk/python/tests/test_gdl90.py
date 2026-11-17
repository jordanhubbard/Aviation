"""Published ICD vectors and hostile transport-boundary coverage."""

import json
from pathlib import Path

import pytest

from aviation_avionics.gdl90 import Gdl90Decoder, resolve_geometric_altitude
from aviation_avionics.gdl90_reports import (
    HeartbeatReport,
    TrafficReport,
    GeometricAltitudeReport,
    DeviceIdReport,
    UnsupportedReport,
)

AUTHORITY = (
    Path(__file__).parents[7] / "components/aviation-avionics/acceptance/gdl90.json"
)
PACKAGED = Path(__file__).parents[4] / "conformance/aviation-gdl90.json"
VECTORS = json.loads(PACKAGED.read_text())
HEARTBEAT = bytes.fromhex(VECTORS["reports"][0]["frame_hex"])


def test_packaged_vectors_match_authority():
    if AUTHORITY.exists():
        assert VECTORS == json.loads(AUTHORITY.read_text())


@pytest.mark.parametrize("vector", VECTORS["reports"], ids=lambda row: row["id"])
def test_published_protocol_fields_and_all_input_boundaries(vector):
    frame = bytes.fromhex(vector["frame_hex"])
    for split in range(len(frame) + 1):
        decoder = Gdl90Decoder()
        first, second = decoder.push(frame[:split]), decoder.push(frame[split:])
        assert first["errors"] + second["errors"] == []
        reports = first["messages"] + second["messages"]
        assert len(reports) == 1
        record_type = {
            "heartbeat": HeartbeatReport,
            "traffic": TrafficReport,
            "ownship": TrafficReport,
            "geometric_altitude": GeometricAltitudeReport,
            "device_id": DeviceIdReport,
            "unsupported": UnsupportedReport,
        }[reports[0]["kind"]]
        record_type(**reports[0])
        for field, expected in vector["expected"].items():
            if field in {"latitude_deg", "longitude_deg"} and expected is not None:
                assert reports[0][field] == pytest.approx(
                    expected, abs=vector["coordinate_tolerance_deg"]
                )
            else:
                assert reports[0][field] == expected


@pytest.mark.parametrize("vector", VECTORS["invalid_frames"], ids=lambda row: row["id"])
def test_invalid_protocol_frames_never_produce_a_report(vector):
    result = Gdl90Decoder().push(bytes.fromhex(vector["frame_hex"]))
    assert result == {"messages": [], "errors": [vector["error"]]}


def test_bad_fcs_is_rejected_and_next_frame_recovers():
    corrupt = bytearray(HEARTBEAT)
    corrupt[3] ^= 1
    result = Gdl90Decoder().push(corrupt + HEARTBEAT)
    assert result["errors"] == ["invalid-fcs"]
    assert len(result["messages"]) == 1


def test_pending_state_is_bounded_and_recovers_after_overflow():
    decoder = Gdl90Decoder()
    assert decoder.push(b"\x7e" + b"a" * 5000)["errors"] == ["frame-too-large"]
    assert len(decoder.push(HEARTBEAT)["messages"]) == 1
    assert decoder.push(b"\x7e\x00\x7d")["messages"] == []
    assert decoder.finish()["errors"] == ["incomplete-frame"]
    assert decoder.finish()["errors"] == []
    assert len(decoder.push(HEARTBEAT)["messages"]) == 1


def test_dangling_escape_and_short_frame_are_explicit():
    result = Gdl90Decoder().push(b"\x7e\x7d\x7e\x00\x7e" + HEARTBEAT)
    assert result["errors"] == ["incomplete-escape", "short-frame"]
    assert len(result["messages"]) == 1


def test_per_call_input_output_and_error_limits():
    decoder = Gdl90Decoder()
    result = decoder.push(HEARTBEAT * 300)
    assert len(result["messages"]) == 256
    assert result["errors"] == ["message-limit"]
    errors = decoder.push(b"\x7e\x00\x7e" * 100)["errors"]
    assert len(errors) == 32 and errors[-1] == "error-limit"
    with pytest.raises(ValueError, match="65535"):
        decoder.push(b"a" * 65536)
    assert len(decoder.push(HEARTBEAT)["messages"]) == 1


def test_geometric_datum_resolution_is_explicit_pure_and_pressure_safe():
    def decode(identifier):
        vector = next(row for row in VECTORS["reports"] if row["id"] == identifier)
        return Gdl90Decoder().push(bytes.fromhex(vector["frame_hex"]))["messages"][0]

    # Use the authority's geometric-altitude vector rather than an encoder under test.
    vector = next(
        row
        for row in VECTORS["reports"]
        if row["expected"].get("kind") == "geometric_altitude"
    )
    report = Gdl90Decoder().push(bytes.fromhex(vector["frame_hex"]))["messages"][0]
    original = dict(report)
    msl = resolve_geometric_altitude(report, decode("extension-id-msl-serial64"))
    assert msl == dict(original, datum="MSL", datum_source="foreflight_device_id")
    ellipsoid = resolve_geometric_altitude(
        report, decode("extension-id-ellipsoid-utf8")
    )
    assert ellipsoid == dict(original, datum_source="foreflight_device_id")
    assert resolve_geometric_altitude(report) == original
    assert resolve_geometric_altitude(report, profile_unknown=True) == dict(
        original, datum=None, datum_source="unknown_receiver_profile"
    )
    assert report == original
    with pytest.raises(ValueError, match="geometric-altitude"):
        resolve_geometric_altitude(decode("published-traffic-section-3.5.2"))
    with pytest.raises(ValueError, match="supported device-ID"):
        resolve_geometric_altitude(report, decode("extension-id-unknown-version"))
