from __future__ import annotations

from dataclasses import dataclass

from aviation_flight_dynamics.compat import (
    apply_turbulence_effect,
    apply_wind_effect,
    calculate_drag,
    calculate_fuel_consumption,
    calculate_lift,
    calculate_thrust,
)
from aviation_flight_dynamics.autopilot import (
    AltitudeHoldController,
    HeadingHoldController,
    PIDGains,
    PitchController,
    RollController,
)
from app.navmath import heading_difference, normalize_heading


@dataclass
class AircraftState:
    position: tuple[float, float]
    velocity: float
    altitude: float
    heading: float
    fuel_level: float


from .alerts import AlertService, Alert

PITCH_GAINS = PIDGains(kp=1.2, ki=0.15, kd=0.07)
ROLL_GAINS = PIDGains(kp=1.0, ki=0.1, kd=0.05)
ALTITUDE_GAINS = PIDGains(kp=1.0, ki=0.1, kd=0.05)
HEADING_GAINS = PIDGains(kp=1.0, ki=0.1, kd=0.05)
AUTOPILOT_STEP_S = 1.0


class FlightDynamicsService:
    def __init__(self, aircraft_state: AircraftState, alert_service: AlertService):
        self.aircraft_state = aircraft_state
        self.alert_service = alert_service
        self.pitch_controller = PitchController(PITCH_GAINS)
        self.roll_controller = RollController(ROLL_GAINS)
        self.altitude_controller = AltitudeHoldController(ALTITUDE_GAINS)
        self.heading_controller = HeadingHoldController(HEADING_GAINS)

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
        # Calculate forces
        lift = calculate_lift(
            self.aircraft_state.velocity, wing_area, lift_coefficient, air_density
        )
        drag = calculate_drag(
            self.aircraft_state.velocity, wing_area, drag_coefficient, air_density
        )
        thrust = calculate_thrust(power, efficiency=0.9, engine_factor=engine_factor)
        fuel_consumption = calculate_fuel_consumption(thrust, fuel_efficiency)

        # Apply environmental effects
        adjusted_velocity = apply_wind_effect(
            self.aircraft_state.velocity, wind_speed, wind_angle
        )
        adjusted_velocity = apply_turbulence_effect(
            adjusted_velocity, turbulence_intensity
        )

        # Autopilot control
        pitch_output = self.pitch_controller.update(
            target_pitch - self.aircraft_state.altitude, AUTOPILOT_STEP_S
        )
        roll_output = self.roll_controller.update(
            target_roll - self.aircraft_state.heading, AUTOPILOT_STEP_S
        )
        altitude_output = self.altitude_controller.update(
            target_altitude - self.aircraft_state.altitude, AUTOPILOT_STEP_S
        )
        heading_output = self.heading_controller.update(
            heading_difference(self.aircraft_state.heading, target_heading),
            AUTOPILOT_STEP_S,
        )

        # Apply autopilot outputs to aircraft state
        self.aircraft_state.velocity = adjusted_velocity
        self.aircraft_state.altitude += altitude_output
        self.aircraft_state.heading = normalize_heading(
            self.aircraft_state.heading + heading_output
        )
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
        """Return the current aircraft state."""
        return self.aircraft_state
