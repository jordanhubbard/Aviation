import pytest
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)


def test_search_nav_database():
    response = client.get("/api/nav/search?query=airport")
    assert response.status_code == 200
    data = response.json()
    assert isinstance(data, dict)


def test_get_procedures(monkeypatch):
    from app.routers.navigation import NavigationResult, NavigationService
    from .test_sourced_navigation import wire

    async def injected(self, airport, **kwargs):
        value = wire()
        value["limit"] = kwargs["limit"]
        return NavigationResult.model_validate(value)

    monkeypatch.setattr(NavigationService, "read", injected)
    response = client.get("/api/procedures/KJFK")
    assert response.status_code == 200
    data = response.json()
    assert isinstance(data, dict)
