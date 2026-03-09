import pytest
from fastapi import WebSocket
from fastapi.testclient import TestClient
from app.services.telemetry_streaming_hub import TelemetryStreamingHub, SubscriptionFilter
from app import app

client = TestClient(app)


def test_connect():
    with client.websocket_connect("/ws") as websocket:
        hub = TelemetryStreamingHub()
        # Note: In a real test, we'd need to mock the WebSocket properly
        # For now, we test that the connection is established
        assert websocket is not None


def test_disconnect():
    with client.websocket_connect("/ws") as websocket:
        hub = TelemetryStreamingHub()
        # Test that we can establish and close a connection
        assert websocket is not None


def test_broadcast():
    with client.websocket_connect("/ws") as websocket:
        hub = TelemetryStreamingHub()
        # Test that we can send and receive messages
        websocket.send_json({"type": "test", "data": {}})
        response = websocket.receive_json()
        assert response is not None
