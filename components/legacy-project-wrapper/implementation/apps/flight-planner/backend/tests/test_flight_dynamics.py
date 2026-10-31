import unittest
from unittest.mock import patch
from aviation_flight_dynamics.autopilot import (
    AltitudeHoldController,
    HeadingHoldController,
    PitchController,
    RollController,
)
from app.services.flight_dynamics import (
    AUTOPILOT_STEP_S,
    AircraftState,
    FlightDynamicsService,
)
from app.services.alerts import AlertService


class TestFlightDynamicsService(unittest.TestCase):
    def setUp(self):
        aircraft_state = AircraftState(
            position=(0, 0), velocity=100, altitude=10000, heading=90, fuel_level=100
        )
        alert_service = AlertService(
            fuel_threshold=50.0, oil_threshold=20.0, electrical_threshold=30.0
        )
        self.flight_dynamics_service = FlightDynamicsService(
            aircraft_state, alert_service
        )

    def test_uses_common_sdk_axis_controllers(self):
        service = self.flight_dynamics_service
        self.assertIsInstance(service.pitch_controller, PitchController)
        self.assertIsInstance(service.roll_controller, RollController)
        self.assertIsInstance(service.altitude_controller, AltitudeHoldController)
        self.assertIsInstance(service.heading_controller, HeadingHoldController)

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
            electrical_status=25.0,
        )
        self.assertEqual(self.flight_dynamics_service.aircraft_state.altitude, 10000)
        self.assertEqual(self.flight_dynamics_service.aircraft_state.heading, 90)

    def test_heading_control_uses_shortest_wraparound_error(self):
        service = self.flight_dynamics_service
        service.aircraft_state.heading = 359
        with patch.object(
            service.heading_controller, "update", return_value=2.0
        ) as update:
            service.update_state(
                lift_coefficient=1.0,
                drag_coefficient=0.3,
                power=2000,
                fuel_efficiency=0.8,
                target_pitch=5,
                target_roll=0,
                target_altitude=10000,
                target_heading=1,
                wind_speed=0,
                wind_angle=0,
                turbulence_intensity=0,
                air_density=1.225,
                wing_area=30.0,
                oil_pressure=25.0,
                electrical_status=35.0,
            )
        update.assert_called_once_with(2.0, AUTOPILOT_STEP_S)
        self.assertEqual(service.aircraft_state.heading, 1.0)


if __name__ == "__main__":
    unittest.main(verbosity=2)
