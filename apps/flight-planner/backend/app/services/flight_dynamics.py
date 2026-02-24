from __future__ import annotations

import math
from dataclasses import dataclass


def calculate_lift(speed: float, wing_area: float, lift_coefficient: float, air_density: float) -> float:
    """Calculate lift force."""
    return 0.5 * lift_coefficient * air_density * wing_area * speed ** 2


def calculate_drag(speed: float, wing_area: float, drag_coefficient: float, air_density: float) -> float:
    """Calculate drag force."""
    return 0.5 * drag_coefficient * air_density * wing_area * speed ** 2


def calculate_thrust(power: float, efficiency: float, engine_factor: float = 1.0) -> float:
    """Calculate thrust force."""
    return power * efficiency * engine_factor


def calculate_fuel_consumption(thrust: float, fuel_efficiency: float) -> float:
    """Calculate fuel consumption rate."""
    return thrust / fuel_efficiency


def apply_wind_effect(velocity: float, wind_speed: float, wind_angle: float) -> float:
    """Apply wind effect on velocity."""
    return velocity + wind_speed * math.cos(wind_angle)


def apply_turbulence_effect(velocity: float, turbulence_intensity: float) -> float:
    """Apply turbulence effect on velocity."""
    return velocity * (1 - turbulence_intensity)


@dataclass
class AircraftState:
    position: tuple[float, float]
    velocity: float
    altitude: float
    heading: float
    fuel_level: float


from .alerts import AlertService, Alert
from .autopilot_controller import PitchController, RollController, AltitudeHoldController, HeadingHoldController


class FlightDynamicsService:
    def __init__(self, aircraft_state: AircraftState, alert_service: AlertService):
        self.aircraft_state = aircraft_state
        self.alert_service = alert_service
        self.pitch_controller = PitchController()
        self.roll_controller = RollController()
        self.altitude_controller = AltitudeHoldController()
        self.heading_controller = HeadingHoldController()

    def update_state(
        self,
        lift_coefficient: float,
        drag_coefficient: float,
        power: float,
        fuel_efficiency: float,
        target_pitch: float,
        target_roll: float,
        target_altitude: float,
        target_heading: float,
        wind_speed: float,
        wind_angle: float,
        turbulence_intensity: float,
        air_density: float,
        wing_area: float,
        oil_pressure: float,
        electrical_status: float,
        engine_factor: float = 1.0,
    ) -> None:
        """Update aircraft state based on flight dynamics calculations."""
        lift = calculate_lift(self.aircraft_state.velocity, wing_area, lift_coefficient, air_density)
        drag = calculate_drag(self.aircraft_state.velocity, wing_area, drag_coefficient, air_density)
        thrust = calculate_thrust(power, efficiency=0.9, engine_factor=engine_factor)
        fuel_consumption = calculate_fuel_consumption(thrust, fuel_efficiency)

        adjusted_velocity = apply_wind_effect(self.aircraft_state.velocity, wind_speed, wind_angle)
        adjusted_velocity = apply_turbulence_effect(adjusted_velocity, turbulence_intensity)

        # Autopilot control
        pitch_output = self.pitch_controller.compute(target_pitch, self.aircraft_state.altitude)
        roll_output = self.roll_controller.compute(target_roll, self.aircraft_state.heading)
        altitude_output = self.altitude_controller.compute(target_altitude, self.aircraft_state.altitude)
        heading_output = self.heading_controller.compute(target_heading, self.aircraft_state.heading)

        # Apply autopilot outputs to aircraft state
        self.aircraft_state.velocity = adjusted_velocity
        self.aircraft_state.altitude += altitude_output
        self.aircraft_state.heading = (self.aircraft_state.heading + heading_output) % 360
        self.aircraft_state.fuel_level -= fuel_consumption

        # Check alerts
        fuel_alert = self.alert_service.check_fuel_level(self.aircraft_state.fuel_level)
        oil_alert = self.alert_service.check_oil_pressure(oil_pressure)
        electrical_alert = self.alert_service.check_electrical_system(electrical_status)

        # Handle alerts
        for alert in [fuel_alert, oil_alert, electrical_alert]:
            if alert:
                print(f"Alert: {alert.message} (Severity: {alert.severity})")

    def get_state(self) -> AircraftState:
        return self.aircraft_state
