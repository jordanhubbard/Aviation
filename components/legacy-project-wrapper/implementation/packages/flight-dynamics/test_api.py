import pytest
from fastapi.testclient import TestClient
from api import app

client = TestClient(app)

def test_init_state():
    """Test initializing flight dynamics state"""
    payload = {"data": {"altitude": 5000, "airspeed": 120, "heading": 180}}
    response = client.post("/init", json=payload)
    assert response.status_code == 200
    assert response.json()["status"] == "initialized"
    assert response.json()["data"] == payload["data"]

def test_init_state_invalid():
    """Test initializing with invalid payload"""
    payload = {"data": {}}
    response = client.post("/init", json=payload)
    assert response.status_code == 400
    assert "Invalid payload" in response.json()["detail"]

def test_update_state():
    """Test updating flight dynamics state"""
    payload = {"data": {"altitude": 5500, "airspeed": 125, "heading": 185}}
    response = client.post("/update", json=payload)
    assert response.status_code == 200
    assert response.json()["status"] == "updated"
    assert response.json()["data"] == payload["data"]

def test_update_state_invalid():
    """Test updating with invalid payload"""
    payload = {"data": {}}
    response = client.post("/update", json=payload)
    assert response.status_code == 400
    assert "Invalid payload" in response.json()["detail"]

def test_reset_state():
    """Test resetting flight dynamics state"""
    response = client.post("/reset")
    assert response.status_code == 200
    assert response.json()["status"] == "reset"
