import pytest
from app.services import flight_recording_service
from app.services.flight_recording_service import router as flight_recording_router
from fastapi.testclient import TestClient
from app import create_app
from app.config import settings

# `app` exposes create_app(settings); there is no module-level instance.
app = create_app(settings)
from app.services.flight_plan_service import router as flight_plan_router

app.include_router(flight_plan_router, prefix="/flight-plans", tags=["flight-plans"])

client = TestClient(app)


@pytest.fixture(autouse=True)
def isolated_recording_store(tmp_path, monkeypatch):
    """Keep each recording test out of the application's normal JSON store."""
    original = list(flight_recording_service.flight_recordings)
    monkeypatch.setattr(flight_recording_service, 'FLIGHT_RECORDINGS_FILE',
                        str(tmp_path / 'flight_recordings.json'))
    flight_recording_service.flight_recordings.clear()
    try:
        yield
    finally:
        flight_recording_service.flight_recordings[:] = original

SAMPLE_RECORDING = {
    "metadata": {
        "aircraft": "Test Aircraft",
        "startTime": "2023-01-01T00:00:00Z",
        "duration": 3600,
        "departure": "JFK",
        "destination": "LAX",
    },
    "telemetry": {
        "timestamp": [], "latitude": [], "longitude": [],
        "altitude": [], "heading": [], "pitch": [], "roll": [], "speed": [],
    },
    "events": [],
}


@pytest.mark.parametrize('flight_recording', [SAMPLE_RECORDING])
def test_create_flight_recording(flight_recording):
    response = client.post("/flight-recordings/", json=flight_recording)
    assert response.status_code == 200
    assert response.json()["metadata"]["aircraft"] == "Test Aircraft"


@pytest.mark.parametrize('flight_recording', [SAMPLE_RECORDING])
def test_read_flight_recording(flight_recording):
    client.post("/flight-recordings/", json=flight_recording)
    response = client.get("/flight-recordings/1")
    assert response.status_code == 200
    assert response.json()["metadata"]["aircraft"] == "Test Aircraft"


@pytest.mark.parametrize('flight_recording', [SAMPLE_RECORDING])
def test_update_flight_recording(flight_recording):
    client.post("/flight-recordings/", json=flight_recording)
    updated = dict(flight_recording)
    updated["metadata"] = dict(flight_recording["metadata"], aircraft="Updated Aircraft")
    response = client.put("/flight-recordings/1", json=updated)
    assert response.status_code == 200
    assert response.json()["metadata"]["aircraft"] == "Updated Aircraft"


@pytest.mark.parametrize('flight_recording', [SAMPLE_RECORDING])
def test_delete_flight_recording(flight_recording):
    client.post("/flight-recordings/", json=flight_recording)
    response = client.delete("/flight-recordings/1")
    assert response.status_code == 200
    assert response.json()["message"] == "Flight recording deleted"
