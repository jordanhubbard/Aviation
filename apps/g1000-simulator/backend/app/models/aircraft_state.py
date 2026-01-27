from __future__ import annotations

from dataclasses import dataclass
import time
from typing import Dict


@dataclass(frozen=True)
class AircraftPerformance:
    cruise_speed_kt: float
    stall_speed_clean_kt: float
    stall_speed_landing_kt: float
    max_speed_kt: float
    climb_rate_fpm: float
    service_ceiling_ft: float


@dataclass(frozen=True)
class FuelConfig:
    capacity_gal: float
    unusable_gal: float
    burn_rate_gph: float


@dataclass(frozen=True)
class WeightConfig:
    empty_lbs: float
    max_gross_lbs: float
    useful_load_lbs: float


@dataclass(frozen=True)
class Dimensions:
    wingspan_ft: float
    length_ft: float
    height_ft: float


@dataclass(frozen=True)
class AircraftConfig:
    id: str
    name: str
    performance: AircraftPerformance
    fuel: FuelConfig
    weights: WeightConfig
    dimensions: Dimensions


C172_CONFIG = AircraftConfig(
    id="cessna-172",
    name="Cessna 172 Skyhawk",
    performance=AircraftPerformance(
        cruise_speed_kt=122.0,
        stall_speed_clean_kt=48.0,
        stall_speed_landing_kt=40.0,
        max_speed_kt=163.0,
        climb_rate_fpm=720.0,
        service_ceiling_ft=14000.0,
    ),
    fuel=FuelConfig(
        capacity_gal=53.0,
        unusable_gal=3.0,
        burn_rate_gph=9.0,
    ),
    weights=WeightConfig(
        empty_lbs=1691.0,
        max_gross_lbs=2550.0,
        useful_load_lbs=859.0,
    ),
    dimensions=Dimensions(
        wingspan_ft=36.0,
        length_ft=27.0,
        height_ft=9.0,
    ),
)


@dataclass
class PositionState:
    latitude_deg: float
    longitude_deg: float
    altitude_ft: float

    def to_dict(self) -> Dict[str, float]:
        return {
            "latitude_deg": self.latitude_deg,
            "longitude_deg": self.longitude_deg,
            "altitude_ft": self.altitude_ft,
        }


@dataclass
class AttitudeState:
    heading_deg: float
    pitch_deg: float
    roll_deg: float

    def to_dict(self) -> Dict[str, float]:
        return {
            "heading_deg": self.heading_deg,
            "pitch_deg": self.pitch_deg,
            "roll_deg": self.roll_deg,
        }


@dataclass
class SpeedState:
    airspeed_kt: float
    ground_speed_kt: float
    vertical_speed_fpm: float

    def to_dict(self) -> Dict[str, float]:
        return {
            "airspeed_kt": self.airspeed_kt,
            "ground_speed_kt": self.ground_speed_kt,
            "vertical_speed_fpm": self.vertical_speed_fpm,
        }


@dataclass
class EngineState:
    running: bool
    rpm: float
    fuel_flow_gph: float
    oil_temp_c: float
    oil_pressure_psi: float

    def to_dict(self) -> Dict[str, float | bool]:
        return {
            "running": self.running,
            "rpm": self.rpm,
            "fuel_flow_gph": self.fuel_flow_gph,
            "oil_temp_c": self.oil_temp_c,
            "oil_pressure_psi": self.oil_pressure_psi,
        }


@dataclass
class AircraftState:
    aircraft_id: str
    position: PositionState
    attitude: AttitudeState
    speeds: SpeedState
    engine: EngineState
    fuel_remaining_gal: float
    timestamp: float

    def to_dict(self) -> Dict[str, object]:
        return {
            "aircraft_id": self.aircraft_id,
            "position": self.position.to_dict(),
            "attitude": self.attitude.to_dict(),
            "speeds": self.speeds.to_dict(),
            "engine": self.engine.to_dict(),
            "fuel_remaining_gal": self.fuel_remaining_gal,
            "timestamp": self.timestamp,
        }


def default_c172_state() -> AircraftState:
    usable_fuel = C172_CONFIG.fuel.capacity_gal - C172_CONFIG.fuel.unusable_gal
    return AircraftState(
        aircraft_id=C172_CONFIG.id,
        position=PositionState(
            latitude_deg=37.6188,
            longitude_deg=-122.3754,
            altitude_ft=4500.0,
        ),
        attitude=AttitudeState(
            heading_deg=90.0,
            pitch_deg=0.0,
            roll_deg=0.0,
        ),
        speeds=SpeedState(
            airspeed_kt=C172_CONFIG.performance.cruise_speed_kt,
            ground_speed_kt=C172_CONFIG.performance.cruise_speed_kt,
            vertical_speed_fpm=0.0,
        ),
        engine=EngineState(
            running=True,
            rpm=2300.0,
            fuel_flow_gph=C172_CONFIG.fuel.burn_rate_gph,
            oil_temp_c=180.0,
            oil_pressure_psi=55.0,
        ),
        fuel_remaining_gal=usable_fuel,
        timestamp=time.time(),
    )
