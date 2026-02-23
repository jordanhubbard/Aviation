import pytest
from app.services.flight_recording_service import router as flight_recording_router
from fastapi.testclient import TestClient
from app import app
from app.services.flight_plan_service import router as flight_plan_router

app.include_router(flight_plan_router, prefix="/flight-plans", tags=["flight-plans"])

client = TestClient(app)

import pytest



@pytest.mark.parametrize('flight_recording', [{"metadata": {"aircraft": "Test Aircraft", "startTime": "2023-01-01T00:00:00Z", "duration": 3600, "departure": "JFK", "destination": "LAX"}, "telemetry": {"timestamp": [], "latitude": [], "longitude": [], "altitude": [], "heading": [], "pitch": [], "roll": [], "speed": []}, "events": []}])
def test_flight_recording_service(flight_recording):
    def test_create_flight_recording(flight_recording):
        response = client.post("/flight-recordings/", json=flight_recording)
        assert response.status_code == 200
        assert response.json()["metadata"]["aircraft"] == "Test Aircraft"

    def test_read_flight_recording(self):
        client.post("/flight-recordings/", json={"metadata": {"aircraft": "Test Aircraft", "startTime": "2023-01-01T00:00:00Z", "duration": 3600, "departure": "JFK", "destination": "LAX"}, "telemetry": {"timestamp": [], "latitude": [], "longitude": [], "altitude": [], "heading": [], "pitch": [], "roll": [], "speed": []}, "events": []})
        response = client.get("/flight-recordings/1")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["name"], "Test Flight")

    def test_update_flight_recording(self):
        client.post("/flight-recordings/", json={"id": 1, "name": "Test Flight", "data": []})
        response = client.put("/flight-recordings/1", json={"metadata": {"aircraft": "Test Aircraft", "startTime": "2023-01-01T00:00:00Z", "duration": 3600, "departure": "JFK", "destination": "LAX"}, "telemetry": {"timestamp": [], "latitude": [], "longitude": [], "altitude": [], "heading": [], "pitch": [], "roll": [], "speed": []}, "events": []})
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["name"], "Updated Flight")

    def test_delete_flight_recording(self):
        client.post("/flight-recordings/", json={"id": 1, "name": "Test Flight", "data": []})
        response = client.delete("/flight-recordings/1")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["message"], "Flight recording deleted")


