from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime
from typing import List, Optional
from app.services.gps_simulation import GPSState


@dataclass
class TelemetrySnapshot:
    """Represents a single telemetry snapshot with timestamp and GPS state."""
    timestamp: datetime
    gps_state: GPSState


class TelemetryRecordingService:
    """Service for recording and managing telemetry snapshots during flight."""

    def __init__(self):
        """Initialize the telemetry recording service."""
        self.recording: bool = False
        self.snapshots: List[TelemetrySnapshot] = []
        self.start_time: Optional[datetime] = None

    def start_recording(self) -> None:
        """Start recording telemetry snapshots."""
        self.recording = True
        self.start_time = datetime.now()
        self.snapshots = []

    def stop_recording(self) -> None:
        """Stop recording telemetry snapshots."""
        self.recording = False

    def capture_snapshot(self, gps_state: GPSState) -> None:
        """Capture a telemetry snapshot if recording is active.
        
        Args:
            gps_state: The current GPS state to capture
        """
        if self.recording:
            snapshot = TelemetrySnapshot(
                timestamp=datetime.now(),
                gps_state=gps_state
            )
            self.snapshots.append(snapshot)

    def get_snapshots(self) -> List[TelemetrySnapshot]:
        """Get all recorded telemetry snapshots.
        
        Returns:
            List of TelemetrySnapshot objects
        """
        return self.snapshots

    def clear_snapshots(self) -> None:
        """Clear all recorded telemetry snapshots."""
        self.snapshots = []

    def get_recording_duration(self) -> Optional[float]:
        """Get the duration of the recording in seconds.
        
        Returns:
            Duration in seconds, or None if recording hasn't started
        """
        if self.start_time is None:
            return None
        return (datetime.now() - self.start_time).total_seconds()

    def get_snapshot_count(self) -> int:
        """Get the number of recorded snapshots.
        
        Returns:
            Number of snapshots
        """
        return len(self.snapshots)
