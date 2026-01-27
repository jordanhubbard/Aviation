from __future__ import annotations

from dataclasses import dataclass, field
import math
import time
from typing import Dict

from app.models.aircraft_state import default_c172_state


def clamp(value: float, minimum: float, maximum: float) -> float:
    return max(minimum, min(maximum, value))


def normalize_heading(heading: float) -> float:
    return heading % 360


def heading_difference(target: float, current: float) -> float:
    diff = (target - current + 180) % 360 - 180
    return diff


@dataclass
class AutopilotTargets:
    heading_deg: float
    altitude_ft: float
    airspeed_kt: float

    def to_dict(self) -> Dict[str, float]:
        return {
            "heading_deg": self.heading_deg,
            "altitude_ft": self.altitude_ft,
            "airspeed_kt": self.airspeed_kt,
        }


@dataclass
class FlightState:
    latitude_deg: float
    longitude_deg: float
    altitude_ft: float
    heading_deg: float
    airspeed_kt: float
    vertical_speed_fpm: float
    turn_rate_dps: float
    pitch_deg: float
    roll_deg: float
    timestamp: float


@dataclass
class FlightDynamicsConfig:
    max_climb_rate_fpm: float = 700.0
    max_turn_rate_dps: float = 3.0
    max_accel_kt_per_sec: float = 5.0
    altitude_gain: float = 0.5
    heading_gain: float = 0.8
    speed_gain: float = 0.5
    roll_gain: float = 7.0
    pitch_gain: float = 10.0


@dataclass
class FlightDynamicsSimulator:
    config: FlightDynamicsConfig = field(default_factory=FlightDynamicsConfig)
    state: FlightState = field(init=False)
    targets: AutopilotTargets = field(init=False)
    _last_update: float = field(init=False, default_factory=time.monotonic)

    def __post_init__(self) -> None:
        self.reset()

    def reset(self) -> None:
        initial_state = default_c172_state()
        self.state = FlightState(
            latitude_deg=initial_state.position.latitude_deg,
            longitude_deg=initial_state.position.longitude_deg,
            altitude_ft=initial_state.position.altitude_ft,
            heading_deg=initial_state.attitude.heading_deg,
            airspeed_kt=initial_state.speeds.airspeed_kt,
            vertical_speed_fpm=initial_state.speeds.vertical_speed_fpm,
            turn_rate_dps=0.0,
            pitch_deg=initial_state.attitude.pitch_deg,
            roll_deg=initial_state.attitude.roll_deg,
            timestamp=initial_state.timestamp,
        )
        self.targets = AutopilotTargets(
            heading_deg=self.state.heading_deg,
            altitude_ft=self.state.altitude_ft,
            airspeed_kt=self.state.airspeed_kt,
        )
        self._last_update = time.monotonic()

    def set_targets(
        self,
        heading_deg: float | None = None,
        altitude_ft: float | None = None,
        airspeed_kt: float | None = None,
    ) -> None:
        if heading_deg is not None:
            self.targets.heading_deg = normalize_heading(heading_deg)
        if altitude_ft is not None:
            self.targets.altitude_ft = altitude_ft
        if airspeed_kt is not None:
            self.targets.airspeed_kt = max(0.0, airspeed_kt)

    def step(self) -> Dict[str, Dict[str, float]]:
        now = time.monotonic()
        delta = max(0.0, now - self._last_update)
        if delta == 0:
            return self.snapshot()

        self._last_update = now
        self._update_heading(delta)
        self._update_altitude(delta)
        self._update_speed(delta)
        self._update_position(delta)
        self.state.timestamp = time.time()
        return self.snapshot()

    def snapshot(self) -> Dict[str, Dict[str, float]]:
        return {
            "position": {
                "latitude_deg": self.state.latitude_deg,
                "longitude_deg": self.state.longitude_deg,
                "altitude_ft": self.state.altitude_ft,
            },
            "attitude": {
                "heading_deg": self.state.heading_deg,
                "pitch_deg": self.state.pitch_deg,
                "roll_deg": self.state.roll_deg,
            },
            "velocity": {
                "airspeed_kt": self.state.airspeed_kt,
                "vertical_speed_fpm": self.state.vertical_speed_fpm,
                "turn_rate_dps": self.state.turn_rate_dps,
            },
            "targets": self.targets.to_dict(),
            "timestamp": self.state.timestamp,
        }

    def _update_heading(self, delta: float) -> None:
        heading_error = heading_difference(self.targets.heading_deg, self.state.heading_deg)
        desired_turn_rate = clamp(
            heading_error * self.config.heading_gain,
            -self.config.max_turn_rate_dps,
            self.config.max_turn_rate_dps,
        )
        self.state.turn_rate_dps = desired_turn_rate
        self.state.heading_deg = normalize_heading(
            self.state.heading_deg + desired_turn_rate * delta
        )
        self.state.roll_deg = clamp(
            desired_turn_rate * self.config.roll_gain,
            -25.0,
            25.0,
        )

    def _update_altitude(self, delta: float) -> None:
        altitude_error = self.targets.altitude_ft - self.state.altitude_ft
        desired_vs = clamp(
            altitude_error * self.config.altitude_gain,
            -self.config.max_climb_rate_fpm,
            self.config.max_climb_rate_fpm,
        )
        self.state.vertical_speed_fpm = desired_vs
        self.state.altitude_ft += desired_vs * delta / 60.0
        self.state.pitch_deg = clamp(
            (desired_vs / self.config.max_climb_rate_fpm) * self.config.pitch_gain,
            -10.0,
            10.0,
        )

    def _update_speed(self, delta: float) -> None:
        speed_error = self.targets.airspeed_kt - self.state.airspeed_kt
        accel = clamp(
            speed_error * self.config.speed_gain,
            -self.config.max_accel_kt_per_sec,
            self.config.max_accel_kt_per_sec,
        )
        self.state.airspeed_kt = max(0.0, self.state.airspeed_kt + accel * delta)

    def _update_position(self, delta: float) -> None:
        distance_nm = self.state.airspeed_kt * delta / 3600.0
        if distance_nm == 0:
            return
        heading_rad = math.radians(self.state.heading_deg)
        lat_rad = math.radians(self.state.latitude_deg)
        delta_lat = (distance_nm * math.cos(heading_rad)) / 60.0
        delta_lon = (distance_nm * math.sin(heading_rad)) / max(1e-6, 60.0 * math.cos(lat_rad))
        self.state.latitude_deg += delta_lat
        self.state.longitude_deg += delta_lon
