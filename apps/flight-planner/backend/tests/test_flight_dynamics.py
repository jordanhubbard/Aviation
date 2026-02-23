import unittest
from backend.app.services.flight_dynamics import FlightDynamicsService, AircraftState
from app.services.alerts import AlertService

class TestFlightDynamicsService(unittest.TestCase):
    def setUp(self):
        aircraft_state = AircraftState(position=(0, 0), velocity=100, altitude=10000, heading=90, fuel_level=100)
        alert_service = AlertService(fuel_threshold=50.0, oil_threshold=20.0, electrical_threshold=30.0)
        self.flight_dynamics_service = FlightDynamicsService(aircraft_state, alert_service)

    def test_update_state_with_alerts(self):
        self.flight_dynamics_service.update_state(
            lift_coefficient=1.0,
            drag_coefficient=0.3,
            power=2000,
            fuel_efficiency=0.8,
            target_pitch=5,
            target_roll=0,
            target_altitude=10000,
            target_heading=90,
            wind_speed=10,
            wind_angle=0,
            turbulence_intensity=0.1,
            air_density=1.225,
            wing_area=30.0,
            oil_pressure=15.0,
            electrical_status=25.0
        )
        # Check if alerts are triggered
        # This is a placeholder for actual alert handling logic

if __name__ == '__main__':
    unittest.main(verbosity=2)
