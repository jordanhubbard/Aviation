from __future__ import annotations

from fastapi.testclient import TestClient

from app import create_app
from app.config import settings


def test_telemetry_websocket() -> None:
    app = create_app(settings)
    client = TestClient(app)
    with client.websocket_connect("/ws/telemetry") as websocket:
        greeting = websocket.receive_json()
        assert greeting == {"type": "telemetry", "status": "connected"}
        telemetry = websocket.receive_json()
        assert telemetry["type"] == "telemetry"
        payload = telemetry["payload"]
        assert "position" in payload
        assert "attitude" in payload
        assert "velocity" in payload
        websocket.send_json({"type": "ping"})
        pong = None
        for _ in range(5):
            message = websocket.receive_json()
            if message.get("type") == "pong":
                pong = message
                break
        assert pong == {"type": "pong"}


def test_command_websocket() -> None:
    app = create_app(settings)
    client = TestClient(app)
    with client.websocket_connect("/ws/commands") as websocket:
        greeting = websocket.receive_json()
        assert greeting == {"type": "commands", "status": "connected"}
        websocket.send_json(
            {
                "type": "set_targets",
                "targets": {"heading_deg": 120, "altitude_ft": 5500, "airspeed_kt": 115},
            }
        )
        response = websocket.receive_json()
        assert response["type"] == "ack"
        assert response["status"] == "updated"
        targets = response["targets"]
        assert targets["heading_deg"] == 120
        assert targets["altitude_ft"] == 5500
        assert targets["airspeed_kt"] == 115
