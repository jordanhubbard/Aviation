import pytest
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)


def test_create_flight_plan():
    response = client.post("/api/flight-plan", json={"name": "Test Plan"})
    assert response.status_code == 200
    assert response.json() == {}


def test_get_flight_plan():
    response = client.get("/api/flight-plan/1")
    assert response.status_code == 200
    assert response.json() == {}


def test_update_flight_plan():
    response = client.put("/api/flight-plan/1", json={"name": "Updated Plan"})
    assert response.status_code == 200
    assert response.json() == {}


def test_delete_flight_plan():
    response = client.delete("/api/flight-plan/1")
    assert response.status_code == 200
    assert response.json() == {}
