from __future__ import annotations

from dataclasses import dataclass
import math
from typing import Dict


def clamp(value: float, minimum: float, maximum: float) -> float:
    return max(minimum, min(maximum, value))


def standard_temperature_c(altitude_ft: float) -> float:
    return 15.0 - 0.0019812 * altitude_ft


def density_ratio(pressure_altitude_ft: float) -> float:
    base = 1.0 - 0.0000068756 * pressure_altitude_ft
    return clamp(base, 0.1, 1.0) ** 4.2561


@dataclass
class AdcSolution:
    ias_kt: float
    cas_kt: float
    tas_kt: float
    pressure_altitude_ft: float
    density_altitude_ft: float
    vertical_speed_fpm: float
    oat_c: float

    def to_dict(self) -> Dict[str, float]:
        return {
            "ias_kt": self.ias_kt,
            "cas_kt": self.cas_kt,
            "tas_kt": self.tas_kt,
            "pressure_altitude_ft": self.pressure_altitude_ft,
            "density_altitude_ft": self.density_altitude_ft,
            "vertical_speed_fpm": self.vertical_speed_fpm,
            "oat_c": self.oat_c,
        }


def compute_adc(
    altitude_ft: float,
    airspeed_kt: float,
    vertical_speed_fpm: float,
    altimeter_setting_inhg: float = 29.92,
    temperature_offset_c: float = 0.0,
) -> AdcSolution:
    ias = max(0.0, airspeed_kt)
    cas = ias
    pressure_altitude = altitude_ft + (29.92 - altimeter_setting_inhg) * 1000.0
    temp_c = standard_temperature_c(pressure_altitude) + temperature_offset_c
    sigma = density_ratio(pressure_altitude)
    tas = ias / math.sqrt(max(sigma, 0.1))
    density_altitude = pressure_altitude + 120.0 * (temp_c - standard_temperature_c(pressure_altitude))
    return AdcSolution(
        ias_kt=ias,
        cas_kt=cas,
        tas_kt=tas,
        pressure_altitude_ft=pressure_altitude,
        density_altitude_ft=density_altitude,
        vertical_speed_fpm=vertical_speed_fpm,
        oat_c=temp_c,
    )
