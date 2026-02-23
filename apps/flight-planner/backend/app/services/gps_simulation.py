from __future__ import annotations

import math
import random
from dataclasses import dataclass


def simulate_position_fix(lat: float, lon: float, alt: float) -> tuple[float, float, float]:
    """Simulate GPS position fix with some random error."""
    lat_error = random.uniform(-0.0001, 0.0001)
    lon_error = random.uniform(-0.0001, 0.0001)
    alt_error = random.uniform(-5, 5)
    return lat + lat_error, lon + lon_error, alt + alt_error


def simulate_groundspeed_and_track(speed: float, track: float) -> tuple[float, float]:
    """Simulate groundspeed and track with some random error."""
    speed_error = random.uniform(-0.5, 0.5)
    track_error = random.uniform(-1, 1)
    return speed + speed_error, (track + track_error) % 360


def simulate_differential_correction(lat: float, lon: float) -> tuple[float, float]:
    """Simulate WAAS/SBAS differential correction."""
    lat_correction = random.uniform(-0.00005, 0.00005)
    lon_correction = random.uniform(-0.00005, 0.00005)
    return lat + lat_correction, lon + lon_correction


def simulate_raim_integrity(lat: float, lon: float) -> bool:
    """Simulate RAIM integrity monitoring."""
    return random.choice([True, False])


def simulate_epe() -> float:
    """Simulate Estimated Position Error (EPE)."""
    return random.uniform(5, 15)


@dataclass
class GPSState:
    lat: float
    lon: float
    alt: float
    speed: float
    track: float
    raim: bool
    epe: float


class GPSSimulationService:
    def __init__(self, gps_state: GPSState):
        self.gps_state = gps_state

    def update_state(self, lat: float, lon: float, alt: float, speed: float, track: float) -> None:
        self.gps_state.lat, self.gps_state.lon, self.gps_state.alt = simulate_position_fix(lat, lon, alt)
        self.gps_state.speed, self.gps_state.track = simulate_groundspeed_and_track(speed, track)
        self.gps_state.lat, self.gps_state.lon = simulate_differential_correction(self.gps_state.lat, self.gps_state.lon)
        self.gps_state.raim = simulate_raim_integrity(self.gps_state.lat, self.gps_state.lon)
        self.gps_state.epe = simulate_epe()

    def get_state(self) -> GPSState:
        return self.gps_state
