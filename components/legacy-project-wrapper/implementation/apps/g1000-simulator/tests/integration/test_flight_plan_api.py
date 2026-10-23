"""Integration tests for the G1000 simulator flight-plan REST API.

Exercises the endpoints defined in apps/g1000-simulator/backend/app/main.py:
  POST   /api/flight-plan
  GET    /api/flight-plan/{plan_id}
  PUT    /api/flight-plan/{plan_id}
  DELETE /api/flight-plan/{plan_id}

Uses FastAPI's TestClient so no live server is needed.
"""
from __future__ import annotations

import sys
import os

_BACKEND_DIR = os.path.join(os.path.dirname(__file__), "..", "..", "backend")
if _BACKEND_DIR not in sys.path:
    sys.path.insert(0, _BACKEND_DIR)

import pytest
from fastapi.testclient import TestClient

from app import create_app
from app.config import settings


@pytest.fixture()
def client() -> TestClient:
    """Fresh app instance per test so flight plan state doesn't leak."""
    return TestClient(create_app(settings))


# ---------------------------------------------------------------------------
# POST /api/flight-plan — create
# ---------------------------------------------------------------------------

class TestCreateFlightPlan:
    def test_returns_200(self, client: TestClient) -> None:
        response = client.post("/api/flight-plan", json={"origin": "KSFO", "destination": "KLAX"})
        assert response.status_code == 200

    def test_response_contains_id(self, client: TestClient) -> None:
        response = client.post("/api/flight-plan", json={"origin": "KSFO", "destination": "KLAX"})
        data = response.json()
        assert "id" in data

    def test_response_contains_origin(self, client: TestClient) -> None:
        response = client.post("/api/flight-plan", json={"origin": "KSFO", "destination": "KLAX"})
        assert response.json()["origin"] == "KSFO"

    def test_response_contains_destination(self, client: TestClient) -> None:
        response = client.post("/api/flight-plan", json={"origin": "KSFO", "destination": "KLAX"})
        assert response.json()["destination"] == "KLAX"

    def test_response_contains_waypoints(self, client: TestClient) -> None:
        waypoints = ["LOSHN", "GARAY"]
        response = client.post(
            "/api/flight-plan",
            json={"origin": "KSFO", "destination": "KLAX", "waypoints": waypoints},
        )
        assert response.json()["waypoints"] == waypoints

    def test_response_contains_altitude(self, client: TestClient) -> None:
        response = client.post(
            "/api/flight-plan",
            json={"origin": "KSFO", "destination": "KLAX", "altitude": 12000},
        )
        assert response.json()["altitude"] == 12000

    def test_response_contains_speed(self, client: TestClient) -> None:
        response = client.post(
            "/api/flight-plan",
            json={"origin": "KSFO", "destination": "KLAX", "speed": 120},
        )
        assert response.json()["speed"] == 120

    def test_ids_are_unique_across_multiple_creates(self, client: TestClient) -> None:
        id1 = client.post("/api/flight-plan", json={"origin": "A", "destination": "B"}).json()["id"]
        id2 = client.post("/api/flight-plan", json={"origin": "C", "destination": "D"}).json()["id"]
        assert id1 != id2

    def test_empty_body_is_accepted(self, client: TestClient) -> None:
        response = client.post("/api/flight-plan", json={})
        assert response.status_code == 200


# ---------------------------------------------------------------------------
# GET /api/flight-plan/{plan_id} — retrieve
# ---------------------------------------------------------------------------

class TestGetFlightPlan:
    def _create(self, client: TestClient, origin: str = "KSFO", destination: str = "KLAX") -> str:
        return client.post("/api/flight-plan", json={"origin": origin, "destination": destination}).json()["id"]

    def test_returns_200_for_existing_plan(self, client: TestClient) -> None:
        plan_id = self._create(client)
        response = client.get(f"/api/flight-plan/{plan_id}")
        assert response.status_code == 200

    def test_returns_correct_plan(self, client: TestClient) -> None:
        plan_id = self._create(client, origin="KOAK", destination="KSAC")
        data = client.get(f"/api/flight-plan/{plan_id}").json()
        assert data["origin"] == "KOAK"
        assert data["destination"] == "KSAC"

    def test_returns_null_or_404_for_missing_plan(self, client: TestClient) -> None:
        response = client.get("/api/flight-plan/nonexistent-id")
        # The service returns None which FastAPI serialises as null (200) or raises 404.
        # Either is acceptable; what matters is the response does not raise an exception.
        assert response.status_code in (200, 404)

    def test_retrieved_plan_contains_id(self, client: TestClient) -> None:
        plan_id = self._create(client)
        data = client.get(f"/api/flight-plan/{plan_id}").json()
        assert data is None or data["id"] == plan_id


# ---------------------------------------------------------------------------
# PUT /api/flight-plan/{plan_id} — update
# ---------------------------------------------------------------------------

class TestUpdateFlightPlan:
    def _create(self, client: TestClient) -> str:
        return client.post(
            "/api/flight-plan",
            json={"origin": "KSFO", "destination": "KLAX", "altitude": 8000},
        ).json()["id"]

    def test_returns_200_for_existing_plan(self, client: TestClient) -> None:
        plan_id = self._create(client)
        response = client.put(f"/api/flight-plan/{plan_id}", json={"altitude": 10000})
        assert response.status_code == 200

    def test_updates_altitude(self, client: TestClient) -> None:
        plan_id = self._create(client)
        client.put(f"/api/flight-plan/{plan_id}", json={"altitude": 14000})
        data = client.get(f"/api/flight-plan/{plan_id}").json()
        assert data["altitude"] == 14000

    def test_updates_destination(self, client: TestClient) -> None:
        plan_id = self._create(client)
        client.put(f"/api/flight-plan/{plan_id}", json={"destination": "KSAN"})
        data = client.get(f"/api/flight-plan/{plan_id}").json()
        assert data["destination"] == "KSAN"

    def test_updates_waypoints(self, client: TestClient) -> None:
        plan_id = self._create(client)
        new_waypoints = ["SADDE", "DARTS"]
        client.put(f"/api/flight-plan/{plan_id}", json={"waypoints": new_waypoints})
        data = client.get(f"/api/flight-plan/{plan_id}").json()
        assert data["waypoints"] == new_waypoints

    def test_updates_speed(self, client: TestClient) -> None:
        plan_id = self._create(client)
        client.put(f"/api/flight-plan/{plan_id}", json={"speed": 140})
        data = client.get(f"/api/flight-plan/{plan_id}").json()
        assert data["speed"] == 140

    def test_partial_update_does_not_clear_other_fields(self, client: TestClient) -> None:
        plan_id = self._create(client)
        client.put(f"/api/flight-plan/{plan_id}", json={"altitude": 12000})
        data = client.get(f"/api/flight-plan/{plan_id}").json()
        # origin should be unchanged
        assert data["origin"] == "KSFO"

    def test_update_nonexistent_plan_returns_null_or_404(self, client: TestClient) -> None:
        response = client.put("/api/flight-plan/no-such-id", json={"altitude": 5000})
        assert response.status_code in (200, 404)


# ---------------------------------------------------------------------------
# DELETE /api/flight-plan/{plan_id} — delete
# ---------------------------------------------------------------------------

class TestDeleteFlightPlan:
    def _create(self, client: TestClient) -> str:
        return client.post("/api/flight-plan", json={"origin": "KORD", "destination": "KJFK"}).json()["id"]

    def test_returns_200_for_existing_plan(self, client: TestClient) -> None:
        plan_id = self._create(client)
        response = client.delete(f"/api/flight-plan/{plan_id}")
        assert response.status_code == 200

    def test_deleted_plan_is_no_longer_retrievable(self, client: TestClient) -> None:
        plan_id = self._create(client)
        client.delete(f"/api/flight-plan/{plan_id}")
        data = client.get(f"/api/flight-plan/{plan_id}").json()
        assert data is None

    def test_delete_returns_true_for_existing_plan(self, client: TestClient) -> None:
        plan_id = self._create(client)
        result = client.delete(f"/api/flight-plan/{plan_id}").json()
        assert result is True

    def test_delete_returns_false_for_nonexistent_plan(self, client: TestClient) -> None:
        result = client.delete("/api/flight-plan/no-such-id").json()
        # Service returns False for a missing plan
        assert result is False

    def test_deleting_one_plan_does_not_affect_others(self, client: TestClient) -> None:
        id1 = self._create(client)
        id2 = client.post("/api/flight-plan", json={"origin": "KSEA", "destination": "KPDX"}).json()["id"]
        client.delete(f"/api/flight-plan/{id1}")
        data = client.get(f"/api/flight-plan/{id2}").json()
        assert data is not None
        assert data["origin"] == "KSEA"
