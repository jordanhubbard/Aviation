from datetime import datetime
from typing import List

class TelemetrySnapshot:
    def __init__(self, timestamp: datetime, gps_state):
        self.timestamp = timestamp
        self.gps_state = gps_state

class TelemetryRecordingService:
    def __init__(self):
        self.snapshots: List[TelemetrySnapshot] = []
        self.recording = False

    def start_recording(self):
        self.recording = True

    def stop_recording(self):
        self.recording = False

    def capture_snapshot(self, gps_state):
        if self.recording:
            snapshot = TelemetrySnapshot(datetime.now(), gps_state)
            self.snapshots.append(snapshot)

    def get_snapshots(self) -> List[TelemetrySnapshot]:
        return self.snapshots
