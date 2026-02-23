import pytest
from app.services.flight_recording_service import router as flight_recording_router
from fastapi.testclient import TestClient
from app import app
from app.services.flight_plan_service import router as flight_plan_router

app.include_router(flight_plan_router, prefix="/flight-plans", tags=["flight-plans"])

client = TestClient(app)

import unittest

class TestFlightRecordingService(unittest.TestCase):
    def test_create_flight_recording(self):
        response = client.post("/flight-recordings/", json={"id": 1, "name": "Test Flight", "data": []})
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["name"], "Test Flight")

    def test_read_flight_recording(self):
        client.post("/flight-recordings/", json={"id": 1, "name": "Test Flight", "data": []})
        response = client.get("/flight-recordings/1")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["name"], "Test Flight")

    def test_update_flight_recording(self):
        client.post("/flight-recordings/", json={"id": 1, "name": "Test Flight", "data": []})
        response = client.put("/flight-recordings/1", json={"id": 1, "name": "Updated Flight", "data": []})
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["name"], "Updated Flight")

    def test_delete_flight_recording(self):
        client.post("/flight-recordings/", json={"id": 1, "name": "Test Flight", "data": []})
        response = client.delete("/flight-recordings/1")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["message"], "Flight recording deleted")

if __name__ == '__main__':
    import unittest
    unittest.main(verbosity=2)
