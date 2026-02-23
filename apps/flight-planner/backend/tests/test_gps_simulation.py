import unittest
from app.services.gps_simulation import GPSSimulationService, GPSState

class TestGPSSimulationService(unittest.TestCase):
    def setUp(self):
        initial_gps_state = GPSState(lat=37.7749, lon=-122.4194, alt=30.0, speed=100.0, track=90.0, raim=True, epe=5.0)
        self.gps_simulation_service = GPSSimulationService(initial_gps_state)

    def test_update_state(self):
        self.gps_simulation_service.update_state(37.7749, -122.4194, 30.0, 100.0, 90.0)
        current_gps_state = self.gps_simulation_service.get_state()
        self.assertIsNotNone(current_gps_state)
        self.assertTrue(0 <= current_gps_state.epe <= 15)

if __name__ == '__main__':
    unittest.main()
