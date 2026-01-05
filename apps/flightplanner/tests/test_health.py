from fastapi.testclient import TestClient

from main import app


def test_health_ok() -> None:
    client = TestClient(app)
    resp = client.get("/api/health")
    assert resp.status_code == 200
    payload = resp.json()
    assert payload["status"] == "ok"
    assert "startup_issues" in payload
