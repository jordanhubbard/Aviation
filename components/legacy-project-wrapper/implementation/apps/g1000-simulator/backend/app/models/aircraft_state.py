from __future__ import annotations

from dataclasses import dataclass
import time
from typing import Dict

from aviation.aircraft import C172S_OPERATING_PROFILE
from aviation_flight_dynamics.aircraft import C172_CONFIG as SDK_C172_CONFIG
from aviation_flight_dynamics.performance import compute_cruise_performance


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
    profile_id: str
    name: str
    performance: AircraftPerformance
    fuel: FuelConfig
    weights: WeightConfig
    dimensions: Dimensions


C172_CONFIG = AircraftConfig(
    id=SDK_C172_CONFIG.aircraft_id,
    profile_id=C172S_OPERATING_PROFILE.profile_id,
    name=C172S_OPERATING_PROFILE.display_name,
    performance=AircraftPerformance(
        cruise_speed_kt=(
            C172S_OPERATING_PROFILE.reference_performance.maximum_cruise_speed_ktas
        ),
        stall_speed_clean_kt=C172S_OPERATING_PROFILE.airspeed_limits.vs_kias,
        stall_speed_landing_kt=C172S_OPERATING_PROFILE.airspeed_limits.vso_kias,
        max_speed_kt=C172S_OPERATING_PROFILE.airspeed_limits.vne_kias,
        climb_rate_fpm=(
            C172S_OPERATING_PROFILE.reference_performance.maximum_climb_rate_fpm
        ),
        service_ceiling_ft=(
            C172S_OPERATING_PROFILE.reference_performance.service_ceiling_ft
        ),
    ),
    fuel=FuelConfig(
        capacity_gal=C172S_OPERATING_PROFILE.fuel_limits.total_capacity_gal,
        unusable_gal=(
            C172S_OPERATING_PROFILE.fuel_limits.total_capacity_gal
            - C172S_OPERATING_PROFILE.fuel_limits.usable_capacity_gal
        ),
        burn_rate_gph=compute_cruise_performance(
            SDK_C172_CONFIG, power_setting=0.9
        ).fuel_flow_gph,
    ),
    weights=WeightConfig(
        empty_lbs=SDK_C172_CONFIG.mass_properties.empty_weight_lbs,
        max_gross_lbs=C172S_OPERATING_PROFILE.weight_limits.maximum_takeoff_weight_lb,
        useful_load_lbs=(
            C172S_OPERATING_PROFILE.weight_limits.maximum_takeoff_weight_lb
            - SDK_C172_CONFIG.mass_properties.empty_weight_lbs
        ),
    ),
    dimensions=Dimensions(
        wingspan_ft=C172S_OPERATING_PROFILE.dimensions.wingspan_ft,
        length_ft=C172S_OPERATING_PROFILE.dimensions.length_ft,
        height_ft=C172S_OPERATING_PROFILE.dimensions.height_ft,
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
