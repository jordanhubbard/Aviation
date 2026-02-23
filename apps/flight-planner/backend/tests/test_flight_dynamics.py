import unittest
from services.flight_dynamics import (
    calculate_lift, calculate_drag, calculate_thrust, calculate_fuel_consumption,
    apply_wind_effect, apply_turbulence_effect, AircraftState, FlightDynamicsService
)


class TestFlightDynamics(unittest.TestCase):

    def setUp(self):
        self.aircraft_state = AircraftState(position=(0, 0), velocity=250, altitude=10000, heading=90, fuel_level=1000)
        self.service = FlightDynamicsService(self.aircraft_state)

    def test_calculate_lift(self):
        lift = calculate_lift(speed=250, wing_area=30, lift_coefficient=1.2, air_density=1.225)
        self.assertAlmostEqual(lift, 137812.5, places=1)

    def test_calculate_drag(self):
        drag = calculate_drag(speed=250, wing_area=30, drag_coefficient=0.3, air_density=1.225)
        self.assertAlmostEqual(drag, 34453.125, places=1)

    def test_calculate_thrust(self):
        thrust = calculate_thrust(power=1000, efficiency=0.85)
        self.assertEqual(thrust, 850)

    def test_calculate_fuel_consumption(self):
        fuel_consumption = calculate_fuel_consumption(thrust=850, fuel_efficiency=0.5)
        self.assertEqual(fuel_consumption, 1700)

    def test_apply_wind_effect(self):
        adjusted_velocity = apply_wind_effect(velocity=250, wind_speed=50, wind_angle=0)
        self.assertEqual(adjusted_velocity, 300)

    def test_apply_turbulence_effect(self):
        adjusted_velocity = apply_turbulence_effect(velocity=250, turbulence_intensity=0.1)
        self.assertEqual(adjusted_velocity, 225)

    def test_update_state(self):
        self.service.update_state(
            lift_coefficient=1.2, drag_coefficient=0.3, power=1000,
            fuel_efficiency=0.5, wind_speed=50, wind_angle=0,
            turbulence_intensity=0.1, air_density=1.225, wing_area=30
        )
        self.assertAlmostEqual(self.aircraft_state.velocity, 270, places=1)
        self.assertAlmostEqual(self.aircraft_state.fuel_level, 998.3, places=1)


if __name__ == '__main__':
    unittest.main()
