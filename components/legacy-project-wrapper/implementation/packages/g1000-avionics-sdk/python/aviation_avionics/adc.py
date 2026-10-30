from __future__ import annotations

from dataclasses import asdict, dataclass
import math


def _finite(name: str, value: float) -> float:
    result = float(value)
    if not math.isfinite(result):
        raise ValueError(f"{name} must be finite")
    return result


def _clamp(value: float, minimum: float, maximum: float) -> float:
    return max(minimum, min(maximum, value))


def standard_temperature_c(altitude_ft: float) -> float:
    return 15.0 - 0.0019812 * _finite("altitude_ft", altitude_ft)


@dataclass(frozen=True)
class AdcSolution:
    ias_kt: float
    cas_kt: float
    tas_kt: float
    pressure_altitude_ft: float
    density_altitude_ft: float
    vertical_speed_fpm: float
    oat_c: float

    def to_dict(self) -> dict[str, float]:
        return asdict(self)


def compute_adc(
    altitude_ft: float,
    airspeed_kt: float,
    vertical_speed_fpm: float,
    altimeter_setting_inhg: float = 29.92,
    temperature_offset_c: float = 0.0,
) -> AdcSolution:
    altitude = _finite("altitude_ft", altitude_ft)
    airspeed = max(0.0, _finite("airspeed_kt", airspeed_kt))
    vertical_speed = _finite("vertical_speed_fpm", vertical_speed_fpm)
    altimeter = _finite("altimeter_setting_inhg", altimeter_setting_inhg)
    temperature_offset = _finite("temperature_offset_c", temperature_offset_c)
    if altimeter <= 0.0:
        raise ValueError("altimeter_setting_inhg must be positive")
    pressure_altitude = altitude + (29.92 - altimeter) * 1000.0
    standard_temperature = standard_temperature_c(pressure_altitude)
    oat = standard_temperature + temperature_offset
    density_base = _clamp(1.0 - 0.0000068756 * pressure_altitude, 0.1, 1.0)
    density_ratio = density_base**4.2561
    return AdcSolution(
        ias_kt=airspeed,
        cas_kt=airspeed,
        tas_kt=airspeed / math.sqrt(max(density_ratio, 0.1)),
        pressure_altitude_ft=pressure_altitude,
        density_altitude_ft=pressure_altitude + 120.0 * temperature_offset,
        vertical_speed_fpm=vertical_speed,
        oat_c=oat,
    )
