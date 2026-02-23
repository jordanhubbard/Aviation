import pytest
from fastapi import WebSocket
from fastapi.testclient import TestClient
from app.services.telemetry_streaming_hub import TelemetryStreamingHub, SubscriptionFilter
from app import app

client = TestClient(app)

@pytest.fixture
async def websocket_client():
    async with client.websocket_connect("/ws") as websocket:
        yield websocket

@pytest.mark.asyncio
async def test_connect(websocket_client):
    hub = TelemetryStreamingHub()
    await hub.connect(websocket_client)
    assert websocket_client in hub.clients

@pytest.mark.asyncio
async def test_disconnect(websocket_client):
    hub = TelemetryStreamingHub()
    await hub.connect(websocket_client)
    await hub.disconnect(websocket_client)
    assert websocket_client not in hub.clients

@pytest.mark.asyncio
async def test_broadcast(websocket_client):
    hub = TelemetryStreamingHub()
    await hub.connect(websocket_client)
    message_type = "flight_state_update"
    data = {"altitude": 30000}
    await hub.broadcast(message_type, data)
    response = await websocket_client.receive_json()
    assert response["type"] == message_type
    assert response["data"] == data
