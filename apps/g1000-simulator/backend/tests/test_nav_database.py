import pytest
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)


def test_search_nav_database():
    response = client.get("/api/nav/search?query=airport")
    assert response.status_code == 200
    assert response.json() == {}


def test_get_procedures():
    response = client.get("/api/procedures/KJFK")
    assert response.status_code == 200
    assert response.json() == {}
