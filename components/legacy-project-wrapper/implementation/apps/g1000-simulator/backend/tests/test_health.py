from __future__ import annotations

from fastapi.testclient import TestClient

from app import create_app
from app.config import settings


def test_health_endpoint() -> None:
    app = create_app(settings)
    client = TestClient(app)
    response = client.get("/api/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}
