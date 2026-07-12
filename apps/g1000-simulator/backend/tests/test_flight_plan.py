import pytest
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)


def test_create_flight_plan():
    response = client.post("/api/flight-plan", json={"name": "Test Plan"})
    assert response.status_code == 200
    data = response.json()
    assert "id" in data


def test_get_flight_plan():
    create_response = client.post("/api/flight-plan", json={"name": "Test Plan"})
    plan_id = create_response.json()["id"]
    response = client.get(f"/api/flight-plan/{plan_id}")
    assert response.status_code == 200
    assert response.json()["id"] == plan_id


def test_update_flight_plan():
    create_response = client.post("/api/flight-plan", json={"name": "Test Plan"})
    plan_id = create_response.json()["id"]
    response = client.put(f"/api/flight-plan/{plan_id}", json={"name": "Updated Plan"})
    assert response.status_code == 200
    assert response.json()["id"] == plan_id


def test_delete_flight_plan():
    create_response = client.post("/api/flight-plan", json={"name": "Test Plan"})
    plan_id = create_response.json()["id"]
    response = client.delete(f"/api/flight-plan/{plan_id}")
    assert response.status_code == 200
