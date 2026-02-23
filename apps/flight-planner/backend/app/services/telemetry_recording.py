from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime
from typing import List

@dataclass
class TelemetrySnapshot:
    timestamp: datetime
    gps_state: GPSState

class TelemetryRecordingService:
    def __init__(self):
        self.snapshots: List[TelemetrySnapshot] = []
        self.recording: bool = False

    def start_recording(self):
        self.recording = True

    def stop_recording(self):
        self.recording = False

    def capture_snapshot(self, gps_state: GPSState):
        if self.recording:
            snapshot = TelemetrySnapshot(timestamp=datetime.now(), gps_state=gps_state)
            self.snapshots.append(snapshot)

    def get_snapshots(self) -> List[TelemetrySnapshot]:
        return self.snapshots

    def clear_snapshots(self):
        self.snapshots.clear()
