
import pytest
from fastapi.testclient import TestClient
from src.main import app

client = TestClient(app)

# WebSocket Telemetry Flows

def test_real_time_telemetry_updates():
    with client.websocket_connect("/ws/telemetry") as websocket:
        websocket.send_json({"action": "subscribe", "flight_id": "123"})
        data = websocket.receive_json()
        assert data["flight_id"] == "123"
        assert "telemetry" in data


def test_connection_re_establishment():
    with client.websocket_connect("/ws/telemetry") as websocket:
        websocket.send_json({"action": "subscribe", "flight_id": "123"})
        websocket.close()
        with client.websocket_connect("/ws/telemetry") as websocket_reconnect:
            websocket_reconnect.send_json({"action": "subscribe", "flight_id": "123"})
            data = websocket_reconnect.receive_json()
            assert data["flight_id"] == "123"
            assert "telemetry" in data


def test_data_integrity():
    with client.websocket_connect("/ws/telemetry") as websocket:
        websocket.send_json({"action": "subscribe", "flight_id": "123"})
        data = websocket.receive_json()
        assert data["telemetry"] == {"altitude": 30000, "speed": 500}

# Flight Plan CRUD Operations

def test_create_flight_plan():
    response = client.post("/api/flight-plans/", json={"origin": "KOAK", "destination": "KSFO", "waypoints": []})
    assert response.status_code == 201
    assert response.json()["origin"] == "KOAK"


def test_read_flight_plan():
    response = client.get("/api/flight-plans/1")
    assert response.status_code == 200
    assert response.json()["id"] == 1


def test_update_flight_plan():
    response = client.put("/api/flight-plans/1", json={"waypoints": ["WAY1"]})
    assert response.status_code == 200
    assert "WAY1" in response.json()["waypoints"]


def test_delete_flight_plan():
    response = client.delete("/api/flight-plans/1")
    assert response.status_code == 204

# Navigation Queries

def test_query_nearby_airports():
    response = client.get("/api/nav/airports?radius=50&lat=37.7749&lon=-122.4194")
    assert response.status_code == 200
    assert len(response.json()) > 0


def test_query_weather_conditions():
    response = client.get("/api/nav/weather?location=KSFO")
    assert response.status_code == 200
    assert "temperature" in response.json()


def test_query_flight_restrictions():
    response = client.get("/api/nav/restrictions?route=KOAK-KSFO")
    assert response.status_code == 200
    assert "restrictions" in response.json()
