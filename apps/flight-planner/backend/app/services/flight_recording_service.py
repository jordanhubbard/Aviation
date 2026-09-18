from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import List
import json
import os

router = APIRouter()

class FlightRecording(BaseModel):
    metadata: dict
    telemetry: dict
    events: List[dict]

FLIGHT_RECORDINGS_FILE = 'flight_recordings.json'

if os.path.exists(FLIGHT_RECORDINGS_FILE):
    with open(FLIGHT_RECORDINGS_FILE, 'r') as file:
        try:
            flight_recordings = json.load(file)
        except json.JSONDecodeError:
            flight_recordings = []
else:
    flight_recordings = []

# Save flight recordings to file
def save_flight_recordings():
    with open(FLIGHT_RECORDINGS_FILE, 'w') as file:
        json.dump([fr if isinstance(fr, dict) else fr.model_dump() for fr in flight_recordings], file)


def _next_recording_id() -> int:
    """Smallest unused positive id."""
    used = {
        fr["metadata"].get("id")
        for fr in flight_recordings
        if isinstance(fr.get("metadata"), dict)
    }
    candidate = 1
    while candidate in used:
        candidate += 1
    return candidate


@router.post("/", response_model=FlightRecording)
def create_flight_recording(flight_recording: FlightRecording):
    # Without an assigned id the read/update/delete lookups below can never
    # match, so every created recording was unreachable.
    stored = flight_recording.model_dump()
    stored["metadata"] = {**stored.get("metadata", {})}
    stored["metadata"].setdefault("id", _next_recording_id())
    flight_recordings.append(stored)
    save_flight_recordings()
    return stored

@router.get("/{flight_recording_id}", response_model=FlightRecording)
def read_flight_recording(flight_recording_id: int):
    for flight_recording in flight_recordings:
        if flight_recording['metadata'].get('id') == flight_recording_id:
            return flight_recording
    raise HTTPException(status_code=404, detail="Flight recording not found")

@router.put("/{flight_recording_id}", response_model=FlightRecording)
def update_flight_recording(flight_recording_id: int, flight_recording: FlightRecording):
    for idx, fr in enumerate(flight_recordings):
        if fr['metadata'].get('id') == flight_recording_id:
            stored = flight_recording.model_dump()
            stored["metadata"] = {**stored.get("metadata", {}), "id": flight_recording_id}
            flight_recordings[idx] = stored
            save_flight_recordings()
            return stored
    raise HTTPException(status_code=404, detail="Flight recording not found")

@router.delete("/{flight_recording_id}")
def delete_flight_recording(flight_recording_id: int):
    for idx, fr in enumerate(flight_recordings):
        if fr['metadata'].get('id') == flight_recording_id:
            del flight_recordings[idx]
            save_flight_recordings()
            return {"message": "Flight recording deleted"}
    raise HTTPException(status_code=404, detail="Flight recording not found")
