"""Source isolation, freshness, authenticated control and real UDP lifecycle."""

import asyncio
import json
from pathlib import Path
import socket

from fastapi.testclient import TestClient
import pytest

from app.cockpit_bridge import create_bridge_app
from app.services.cockpit_bridge import ReceiverBridge, ReceiverSettings, ReceiverState

VECTORS = json.loads((Path(__file__).parents[3] / "conformance/aviation-gdl90.json").read_text())
HEARTBEAT = bytes.fromhex(VECTORS["reports"][0]["frame_hex"])
TRAFFIC = bytes.fromhex(VECTORS["reports"][1]["payload_hex"])
TOKEN = "fixture-operator-token-" + "x" * 32


def frame(payload):
    # Independent bit-serial recurrence, verified against the published heartbeat.
    crc = 0
    for byte in payload:
        for shift in range(7, -1, -1):
            top = crc & 0x8000
            crc = ((crc << 1) | ((byte >> shift) & 1)) & 0xFFFF
            if top:
                crc ^= 0x1021
    result = bytearray([126])
    for byte in payload + crc.to_bytes(2, "little"):
        result.extend((125, byte ^ 32) if byte in {125, 126} else (byte,))
    result.append(126)
    return bytes(result)


OWNSHIP = frame(bytes([10]) + TRAFFIC[1:])


class Clock:
    value = 100.0

    def __call__(self):
        return self.value


def receiver(*, clock=None):
    clock = clock or Clock()
    return ReceiverState(
        ReceiverSettings("127.0.0.1", 0, ("127.0.0.1",)),
        clock=clock,
        wall_clock=lambda: 1700000000 + clock(),
    )


def test_reference_fcs_matches_published_heartbeat():
    assert frame(bytes.fromhex("008141dbd00802")) == HEARTBEAT


def test_no_listener_or_telemetry_without_explicit_start_and_source_admission():
    state = receiver()
    state.ingest(HEARTBEAT, ("127.0.0.1", 4000))
    assert not state.snapshot()["listening"] and not state.snapshot()["receivers"]
    state.listening(4000)
    state.ingest(HEARTBEAT, ("192.0.2.1", 4000))
    assert state.snapshot()["counters"] == {"datagrams": 1, "rejected_sources": 1}
    assert not state.snapshot()["decode_errors"]
    state.ingest(bytes.fromhex(VECTORS["reports"][2]["frame_hex"]), ("127.0.0.1", 4000))
    assert not state.snapshot()["connected"] and not state.snapshot()["receivers"]


def test_sender_gps_validity_age_and_datum_are_not_fused():
    clock = Clock()
    state = receiver(clock=clock)
    state.listening(4000)
    a, b = ("127.0.0.1", 1000), ("127.0.0.1", 2000)
    state.ingest(HEARTBEAT, a)
    state.ingest(OWNSHIP, b)
    assert state.snapshot()["receivers"][1]["ownship"]["gps_fix_valid"] is None
    state.ingest(HEARTBEAT, b)
    ownship = state.snapshot()["receivers"][1]["ownship"]
    assert ownship["gps_fix_valid"] is True
    invalid_gps = bytearray.fromhex("008141dbd00802")
    invalid_gps[1] &= 0x7F
    state.ingest(frame(invalid_gps), b)
    assert state.snapshot()["receivers"][1]["ownship"]["gps_fix_valid"] is False
    state.ingest(frame(bytes.fromhex("0bff38ffff")), b)
    geo = state.snapshot()["receivers"][1]["geometric_altitude"]["report"]
    assert geo["geometric_altitude_ft"] == -1000 and geo["datum"] == "WGS84_ellipsoid"
    assert geo["vertical_figure_of_merit_m"] is None
    clock.value += 6
    snapshot = state.snapshot()
    assert not snapshot["connected"]
    assert snapshot["receivers"][1]["ownship"]["stale"] is True
    assert snapshot["receivers"][1]["ownship"]["gps_fix_valid"] is None


def test_traffic_identity_retention_and_stop_never_claim_live():
    clock = Clock()
    state = receiver(clock=clock)
    state.listening(4000)
    source = ("127.0.0.1", 1000)
    state.ingest(frame(TRAFFIC), source)
    other_type = bytearray(TRAFFIC)
    other_type[1] = 1
    state.ingest(frame(other_type), source)
    assert len(state.snapshot()["traffic"]) == 2
    clock.value += 16
    assert all(row["stale"] for row in state.snapshot()["traffic"])
    clock.value += 45
    assert not state.snapshot()["traffic"]
    state.ingest(HEARTBEAT + OWNSHIP, source)
    state.stopped()
    state.ingest(HEARTBEAT, source)
    assert not state.snapshot()["connected"]
    assert state.snapshot()["receivers"][0]["ownship"]["live"] is False
    state.listening(4001)
    assert not state.snapshot()["recent_reports"] and not state.snapshot()["receivers"]


def test_bounds_and_datagram_boundaries_are_explicit():
    clock = Clock()
    state = receiver(clock=clock)
    state.listening(4000)
    source = ("127.0.0.1", 1000)
    state.ingest(HEARTBEAT[:5], source)
    state.ingest(HEARTBEAT[5:], source)
    assert not state.snapshot()["connected"]
    assert state.snapshot()["decode_errors"]["incomplete-frame"] == 1
    for _ in range(150):
        state.ingest(HEARTBEAT, source)
    assert state.snapshot()["counters"]["rate_limited_datagrams"] == 52
    for index in range(550):
        clock.value += 0.01
        packet = bytearray(TRAFFIC)
        packet[2:5] = index.to_bytes(3, "big")
        state.ingest(frame(packet), source)
    snapshot = state.snapshot()
    assert len(snapshot["traffic"]) == 500
    assert len(snapshot["recent_reports"]) == 128
    assert snapshot["counters"]["evicted_tracks"] == 50
    for index in range(1, 12):
        clock.value += 0.01
        state.ingest(HEARTBEAT, ("127.0.0.1", 1000 + index))
    assert len(state.snapshot()["receivers"]) == 8
    assert state.snapshot()["counters"]["sender_limit_datagrams"] == 4


def test_http_auth_origin_schema_and_body_ordering():
    bridge = ReceiverBridge(receiver())
    app = create_bridge_app(bridge, token=TOKEN, origins=("https://planner.example",))
    headers = {"Authorization": "Bearer " + TOKEN, "Origin": "https://planner.example"}
    with TestClient(app) as client:
        assert not bridge.state.running
        assert client.post("/api/cockpit/start", content=b"invalid").status_code == 401
        assert not bridge.state.running
        assert (
            client.get(
                "/api/cockpit/state",
                headers={**headers, "Origin": "https://bad.example"},
            ).status_code
            == 403
        )
        response = client.options(
            "/api/cockpit/state",
            headers={
                "Origin": "https://planner.example",
                "Access-Control-Request-Method": "GET",
                "Access-Control-Request-Headers": "authorization",
            },
        )
        assert response.status_code == 200
        assert response.headers["access-control-allow-origin"] == "https://planner.example"
        response = client.get("/api/cockpit/state", headers=headers)
        assert response.status_code == 200 and response.json()["receivers"] == []
        assert response.headers["cache-control"] == "private, no-store"
        schema = client.get("/api/openapi.json").json()
        assert TOKEN not in json.dumps(schema)
        assert (
            schema["components"]["schemas"]["ReportEnvelope"]["properties"]["received_at"]["format"]
            == "date-time"
        )
        assert (
            schema["components"]["schemas"]["BridgeSnapshot"]["properties"]["traffic"]["maxItems"]
            == 500
        )
        assert "503" in schema["paths"]["/api/cockpit/start"]["post"]["responses"]
        assert "401" in schema["paths"]["/api/cockpit/state"]["get"]["responses"]
        assert schema["paths"]["/api/cockpit/start"]["post"]["security"]
        assert (
            schema["components"]["schemas"]["ReportEnvelope"]["properties"]["report"][
                "discriminator"
            ]["propertyName"]
            == "kind"
        )
        assert client.post("/api/cockpit/start", headers=headers).json()["listening"]
        port = bridge.state.bound_port
        with socket.socket(socket.AF_INET, socket.SOCK_DGRAM) as sender:
            sender.sendto(
                HEARTBEAT + OWNSHIP + frame(TRAFFIC) + frame(bytes.fromhex("0bff38ffff")),
                ("127.0.0.1", port),
            )
        for _ in range(100):
            snapshot = client.get("/api/cockpit/state", headers=headers).json()
            if snapshot["traffic"]:
                break
        assert snapshot["traffic"][0]["report"]["pressure_altitude_ft"] == 5000
        assert snapshot["receivers"][0]["ownship"]["gps_fix_valid"] is True
        assert (
            snapshot["receivers"][0]["geometric_altitude"]["report"]["datum"] == "WGS84_ellipsoid"
        )
        assert client.post("/api/cockpit/stop", headers=headers).json()["listening"] is False
    assert bridge.transport is None


@pytest.mark.parametrize(
    "origin",
    [
        "*",
        "https://*.example",
        "https://u:p@example",
        "https://example/path",
        "https://example:0",
    ],
)
def test_invalid_origin_configuration_fails_closed(origin):
    with pytest.raises(ValueError, match="origin"):
        create_bridge_app(ReceiverBridge(receiver()), token=TOKEN, origins=(origin,))


def test_byte_rate_limit_and_immutable_snapshot_view():
    state = receiver()
    state.listening(4000)
    for _ in range(10):
        state.ingest(b"x" * 65000, ("127.0.0.1", 1000))
    assert state.snapshot()["counters"]["byte_rate_limited_datagrams"] == 6
    state.ingest(HEARTBEAT, ("127.0.0.1", 1000))
    snapshot = state.snapshot()
    snapshot["receivers"][0]["heartbeat"]["report"]["gps_position_valid"] = False
    assert state.snapshot()["receivers"][0]["heartbeat"]["report"]["gps_position_valid"] is True


def test_suspend_and_clock_corrections_cannot_rejuvenate_reports():
    monotonic, wall = [100.0], [1700000000.0]
    state = ReceiverState(
        ReceiverSettings("127.0.0.1", 0, ("127.0.0.1",)),
        clock=lambda: monotonic[0],
        wall_clock=lambda: wall[0],
    )
    state.listening(4000)
    source = ("127.0.0.1", 4000)
    state.ingest(HEARTBEAT + OWNSHIP + frame(TRAFFIC), source)
    assert state.snapshot()["connected"]
    wall[0] += 3600
    suspended = state.snapshot()
    assert not suspended["connected"] and not suspended["traffic"]
    assert suspended["receivers"][0]["ownship"]["gps_fix_valid"] is None
    assert suspended["receivers"][0]["heartbeat"]["age_seconds"] == 3600
    wall[0] -= 3600
    corrected = state.snapshot()
    assert not corrected["connected"]
    assert corrected["receivers"][0]["heartbeat"]["age_seconds"] == 3600
    state.ingest(OWNSHIP, source)
    assert state.snapshot()["receivers"][0]["ownship"]["gps_fix_valid"] is None
    state.ingest(HEARTBEAT, source)
    assert state.snapshot()["receivers"][0]["ownship"]["gps_fix_valid"] is True
    wall[0] -= 3600
    monotonic[0] += 16
    backward = state.snapshot()
    assert not backward["connected"]
    assert backward["receivers"][0]["ownship"]["age_seconds"] == 16


def test_clock_gap_seen_by_another_sender_ages_all_receivers():
    monotonic, wall = [100.0], [1700000000.0]
    state = ReceiverState(
        ReceiverSettings("127.0.0.1", 0, ("127.0.0.1",)),
        clock=lambda: monotonic[0],
        wall_clock=lambda: wall[0],
    )
    state.listening(4000)
    state.ingest(HEARTBEAT, ("127.0.0.1", 1000))
    wall[0] += 3600
    state.ingest(HEARTBEAT, ("127.0.0.1", 2000))
    wall[0] -= 3600
    snapshot = state.snapshot()
    assert snapshot["receivers"][0]["connected"] is False
    assert snapshot["receivers"][1]["connected"] is True
    assert snapshot["receivers"][0]["heartbeat"]["age_seconds"] == 3600
    assert snapshot["counters"]["clock_discontinuities"] == 2
    monotonic[0] += 6
    assert not state.snapshot()["connected"]


def test_actual_udp_concurrent_start_stop_rebind_and_late_callback():
    async def run():
        state = ReceiverState(ReceiverSettings("127.0.0.1", 0, ("127.0.0.1",)))
        bridge = ReceiverBridge(state)
        sender = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        try:
            starts = await asyncio.gather(*(bridge.start() for _ in range(4)))
            port = starts[0]["udp_port"]
            assert {r["udp_port"] for r in starts} == {port}
            assert state.session == 1
            sender.sendto(HEARTBEAT + OWNSHIP + frame(TRAFFIC), ("127.0.0.1", port))
            for _ in range(100):
                if state.snapshot()["traffic"]:
                    break
                await asyncio.sleep(0.01)
            assert state.snapshot()["connected"]
            assert state.snapshot()["receivers"][0]["ownship"]["gps_fix_valid"] is True
            protocol = bridge.protocol
            await bridge.stop()
            protocol.datagram_received(HEARTBEAT, ("127.0.0.1", 1234))
            with socket.socket(socket.AF_INET, socket.SOCK_DGRAM) as probe:
                probe.bind(("127.0.0.1", port))
                blocked = ReceiverBridge(
                    ReceiverState(ReceiverSettings("127.0.0.1", port, ("127.0.0.1",)))
                )
                with pytest.raises(OSError):
                    await blocked.start()
                assert not blocked.state.running and blocked.transport is None
            await bridge.start()
            protocol.datagram_received(HEARTBEAT, ("127.0.0.1", 1234))
            protocol.connection_lost(None)
            assert state.session == 2 and state.running
            assert not state.snapshot()["recent_reports"]
            bridge.transport.close()
            await bridge.protocol.closed
            assert not state.running
            await bridge.start()
            assert state.session == 3 and state.running
            stopped_port = state.bound_port
            stops = await asyncio.gather(*(bridge.stop() for _ in range(4)))
            assert all(not item["listening"] for item in stops)
            with socket.socket(socket.AF_INET, socket.SOCK_DGRAM) as probe:
                probe.bind(("127.0.0.1", stopped_port))
            for _ in range(3):
                await asyncio.gather(bridge.start(), bridge.stop(), bridge.start())
                assert state.running and not bridge.transport.is_closing()
                await bridge.stop()
        finally:
            sender.close()
            await bridge.stop()
        assert bridge.transport is None

    asyncio.run(run())


@pytest.mark.parametrize(
    "action,exception,detail",
    [
        (
            "start",
            TimeoutError("private-provider-value"),
            "Previous receiver shutdown has not completed",
        ),
        (
            "start",
            OSError("private-provider-value"),
            "Cannot bind the configured receiver UDP listener",
        ),
        ("stop", TimeoutError("private-provider-value"), "Receiver UDP shutdown has not completed"),
    ],
)
def test_control_failure_is_actionable_without_exposing_socket_details(
    monkeypatch, action, exception, detail
):
    bridge = ReceiverBridge(receiver())
    app = create_bridge_app(bridge, token=TOKEN)

    async def fail():
        raise exception

    with TestClient(app) as client:
        with monkeypatch.context() as scoped:
            scoped.setattr(bridge, action, fail)
            response = client.post(
                "/api/cockpit/" + action, headers={"Authorization": "Bearer " + TOKEN}
            )
            assert response.status_code == 503
            assert response.json() == {"detail": detail}
            assert "private-provider-value" not in response.text
