from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import List
import json
import os

router = APIRouter()

class FlightRecording(BaseModel):
    id: int
    name: str
    data: List[dict]

FLIGHT_RECORDINGS_FILE = 'flight_recordings.json'

if os.path.exists(FLIGHT_RECORDINGS_FILE):
    with open(FLIGHT_RECORDINGS_FILE, 'r') as file:
        try:
            flight_recordings = json.load(file)
        except json.JSONDecodeError:
            flight_recordings = []
else:
        flight_recordings = []
else:
    flight_recordings = []
else:
    flight_recordings = []

# Save flight recordings to file
def save_flight_recordings():
    with open(FLIGHT_RECORDINGS_FILE, 'w') as file:
        json.dump(flight_recordings, file)


@router.post("/", response_model=FlightRecording)
def create_flight_recording(flight_recording: FlightRecording):
    flight_recordings.append(flight_recording)
    save_flight_recordings()
    return flight_recording

@router.get("/{flight_recording_id}", response_model=FlightRecording)
def read_flight_recording(flight_recording_id: int):
    for flight_recording in flight_recordings:
        if flight_recording.id == flight_recording_id:
            return flight_recording
    raise HTTPException(status_code=404, detail="Flight recording not found")

@router.put("/{flight_recording_id}", response_model=FlightRecording)
def update_flight_recording(flight_recording_id: int, flight_recording: FlightRecording):
    for idx, fr in enumerate(flight_recordings):
        if fr.id == flight_recording_id:
            flight_recordings[idx] = flight_recording
            save_flight_recordings()
            return flight_recording
    raise HTTPException(status_code=404, detail="Flight recording not found")

@router.delete("/{flight_recording_id}")
def delete_flight_recording(flight_recording_id: int):
    for idx, fr in enumerate(flight_recordings):
        if fr.id == flight_recording_id:
            del flight_recordings[idx]
            save_flight_recordings()
            return {"message": "Flight recording deleted"}
    raise HTTPException(status_code=404, detail="Flight recording not found")
