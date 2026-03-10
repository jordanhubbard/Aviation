"""Integration tests for the G1000 simulator WebSocket API.

These tests use the FastAPI TestClient (which wraps Starlette's
WebSocket test support) to exercise the /ws/telemetry and /ws/commands
endpoints without requiring a running server.

The app is created via `create_app(settings)` following the pattern used
in apps/g1000-simulator/backend/tests/test_health.py and test_websocket.py.
"""
from __future__ import annotations

import sys
import os

_BACKEND_DIR = os.path.join(os.path.dirname(__file__), "..", "..", "backend")
if _BACKEND_DIR not in sys.path:
    sys.path.insert(0, _BACKEND_DIR)

from fastapi.testclient import TestClient

from app import create_app
from app.config import settings


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _make_client() -> TestClient:
    return TestClient(create_app(settings))


# ---------------------------------------------------------------------------
# /ws/telemetry — connection greeting
# ---------------------------------------------------------------------------

class TestTelemetryWebSocket:
    def test_connection_sends_greeting(self) -> None:
        client = _make_client()
        with client.websocket_connect("/ws/telemetry") as ws:
            greeting = ws.receive_json()
            assert greeting["type"] == "telemetry"
            assert greeting["status"] == "connected"

    def test_first_telemetry_message_has_required_sections(self) -> None:
        client = _make_client()
        with client.websocket_connect("/ws/telemetry") as ws:
            ws.receive_json()  # consume greeting
            telemetry = ws.receive_json()
            assert telemetry["type"] == "telemetry"
            payload = telemetry["payload"]
            for section in ("position", "attitude", "velocity"):
                assert section in payload, f"Missing section: {section}"

    def test_position_contains_altitude(self) -> None:
        client = _make_client()
        with client.websocket_connect("/ws/telemetry") as ws:
            ws.receive_json()  # greeting
            telemetry = ws.receive_json()
            assert "altitude_ft" in telemetry["payload"]["position"]

    def test_attitude_contains_heading(self) -> None:
        client = _make_client()
        with client.websocket_connect("/ws/telemetry") as ws:
            ws.receive_json()  # greeting
            telemetry = ws.receive_json()
            assert "heading_deg" in telemetry["payload"]["attitude"]

    def test_velocity_contains_airspeed(self) -> None:
        client = _make_client()
        with client.websocket_connect("/ws/telemetry") as ws:
            ws.receive_json()  # greeting
            telemetry = ws.receive_json()
            assert "airspeed_kt" in telemetry["payload"]["velocity"]

    def test_ping_receives_pong(self) -> None:
        client = _make_client()
        with client.websocket_connect("/ws/telemetry") as ws:
            ws.receive_json()  # greeting
            ws.send_json({"type": "ping"})
            # Drain queued telemetry messages until we find the pong.
            pong = None
            for _ in range(10):
                msg = ws.receive_json()
                if msg.get("type") == "pong":
                    pong = msg
                    break
            assert pong == {"type": "pong"}

    def test_request_message_returns_snapshot(self) -> None:
        client = _make_client()
        with client.websocket_connect("/ws/telemetry") as ws:
            ws.receive_json()  # greeting
            ws.send_json({"type": "request"})
            # Find the snapshot response.
            snapshot = None
            for _ in range(10):
                msg = ws.receive_json()
                if msg.get("type") == "telemetry" and "payload" in msg:
                    snapshot = msg
                    break
            assert snapshot is not None


# ---------------------------------------------------------------------------
# /ws/commands — connection and target updates
# ---------------------------------------------------------------------------

class TestCommandWebSocket:
    def test_connection_sends_greeting(self) -> None:
        client = _make_client()
        with client.websocket_connect("/ws/commands") as ws:
            greeting = ws.receive_json()
            assert greeting["type"] == "commands"
            assert greeting["status"] == "connected"

    def test_set_targets_returns_ack(self) -> None:
        client = _make_client()
        with client.websocket_connect("/ws/commands") as ws:
            ws.receive_json()  # greeting
            ws.send_json({
                "type": "set_targets",
                "targets": {"heading_deg": 270, "altitude_ft": 8000, "airspeed_kt": 120},
            })
            response = ws.receive_json()
            assert response["type"] == "ack"
            assert response["status"] == "updated"

    def test_set_targets_reflects_heading(self) -> None:
        client = _make_client()
        with client.websocket_connect("/ws/commands") as ws:
            ws.receive_json()
            ws.send_json({
                "type": "set_targets",
                "targets": {"heading_deg": 135, "altitude_ft": 5000, "airspeed_kt": 100},
            })
            response = ws.receive_json()
            assert response["targets"]["heading_deg"] == 135

    def test_set_targets_reflects_altitude(self) -> None:
        client = _make_client()
        with client.websocket_connect("/ws/commands") as ws:
            ws.receive_json()
            ws.send_json({
                "type": "set_targets",
                "targets": {"heading_deg": 90, "altitude_ft": 10000, "airspeed_kt": 140},
            })
            response = ws.receive_json()
            assert response["targets"]["altitude_ft"] == 10000

    def test_set_targets_reflects_airspeed(self) -> None:
        client = _make_client()
        with client.websocket_connect("/ws/commands") as ws:
            ws.receive_json()
            ws.send_json({
                "type": "set_targets",
                "targets": {"heading_deg": 90, "altitude_ft": 5000, "airspeed_kt": 115},
            })
            response = ws.receive_json()
            assert response["targets"]["airspeed_kt"] == 115

    def test_ack_contains_autopilot_section(self) -> None:
        client = _make_client()
        with client.websocket_connect("/ws/commands") as ws:
            ws.receive_json()
            ws.send_json({"type": "set_targets", "targets": {}})
            response = ws.receive_json()
            assert "autopilot" in response

    def test_ack_contains_audio_panel_section(self) -> None:
        client = _make_client()
        with client.websocket_connect("/ws/commands") as ws:
            ws.receive_json()
            ws.send_json({"type": "set_targets", "targets": {}})
            response = ws.receive_json()
            assert "audio_panel" in response

    def test_ack_contains_transponder_section(self) -> None:
        client = _make_client()
        with client.websocket_connect("/ws/commands") as ws:
            ws.receive_json()
            ws.send_json({"type": "set_targets", "targets": {}})
            response = ws.receive_json()
            assert "transponder" in response

    def test_reset_command_is_accepted(self) -> None:
        """The reset command should not raise; an ack is returned."""
        client = _make_client()
        with client.websocket_connect("/ws/commands") as ws:
            ws.receive_json()
            ws.send_json({"type": "reset"})
            # reset triggers the simulator reset then falls through to the
            # final send_json ack block.
            response = ws.receive_json()
            assert response["type"] == "ack"

    def test_partial_targets_are_accepted(self) -> None:
        """Sending only some target fields should not raise."""
        client = _make_client()
        with client.websocket_connect("/ws/commands") as ws:
            ws.receive_json()
            ws.send_json({"type": "set_targets", "targets": {"heading_deg": 45}})
            response = ws.receive_json()
            assert response["type"] == "ack"

    def test_non_numeric_targets_are_ignored(self) -> None:
        """String values for numeric targets are silently ignored (coerce returns None)."""
        client = _make_client()
        with client.websocket_connect("/ws/commands") as ws:
            ws.receive_json()
            ws.send_json({
                "type": "set_targets",
                "targets": {"heading_deg": "north", "altitude_ft": "high"},
            })
            response = ws.receive_json()
            assert response["type"] == "ack"
