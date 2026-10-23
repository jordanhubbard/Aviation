import unittest
from datetime import datetime, timedelta
from app.services.telemetry_recording import TelemetryRecordingService, TelemetrySnapshot
from app.services.gps_simulation import GPSState

class TestTelemetryRecordingService(unittest.TestCase):
    def setUp(self):
        self.service = TelemetryRecordingService()
        self.gps_state = GPSState(lat=37.7749, lon=-122.4194, alt=30.0, speed=100.0, track=90.0, raim=True, epe=5.0)

    def test_start_stop_recording(self):
        self.service.start_recording()
        self.assertTrue(self.service.recording)
        self.service.stop_recording()
        self.assertFalse(self.service.recording)

    def test_capture_snapshot(self):
        self.service.start_recording()
        self.service.capture_snapshot(self.gps_state)
        self.assertEqual(len(self.service.get_snapshots()), 1)
        self.service.stop_recording()
        self.service.capture_snapshot(self.gps_state)
        self.assertEqual(len(self.service.get_snapshots()), 1)

    def test_clear_snapshots(self):
        self.service.start_recording()
        self.service.capture_snapshot(self.gps_state)
        self.service.clear_snapshots()
        self.assertEqual(len(self.service.get_snapshots()), 0)

if __name__ == '__main__':
    unittest.main()
