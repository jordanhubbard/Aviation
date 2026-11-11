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


def test_real_uvicorn_websocket_transport() -> None:
    """ASGI TestClient alone cannot detect a missing production WS protocol."""
    import json
    import socket
    import threading
    import time

    import uvicorn
    from websockets.sync.client import connect

    listener = socket.socket()
    listener.bind(("127.0.0.1", 0))
    listener.listen()
    port = listener.getsockname()[1]
    server = uvicorn.Server(uvicorn.Config(
        create_app(settings), ws="auto", lifespan="off", log_level="error",
        timeout_graceful_shutdown=1,
    ))
    thread = threading.Thread(target=lambda: server.run(sockets=[listener]), daemon=True)
    thread.start()
    try:
        deadline = time.monotonic() + 5
        while not server.started:
            assert thread.is_alive(), "Uvicorn exited before listening"
            assert time.monotonic() < deadline, "Uvicorn did not become ready"
            time.sleep(0.01)
        with connect(f"ws://127.0.0.1:{port}/ws/telemetry", open_timeout=5, close_timeout=2) as websocket:
            assert json.loads(websocket.recv(timeout=5)) == {"type": "telemetry", "status": "connected"}
            websocket.send(json.dumps({"type": "ping"}))
            for _ in range(10):
                if json.loads(websocket.recv(timeout=5)).get("type") == "pong":
                    break
            else:
                raise AssertionError("No real WebSocket pong received")
    finally:
        server.should_exit = True
        thread.join(timeout=5)
        if thread.is_alive():
            server.force_exit = True
            thread.join(timeout=5)
        listener.close()
        assert not thread.is_alive(), "Uvicorn test server did not stop"
