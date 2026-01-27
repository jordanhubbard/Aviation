from __future__ import annotations

from dataclasses import dataclass
import math
from typing import Dict

WAAS_HORIZONTAL_ACCURACY_M = 3.0
WAAS_VERTICAL_ACCURACY_M = 5.0
GPS_HORIZONTAL_ACCURACY_M = 15.0
GPS_VERTICAL_ACCURACY_M = 25.0


@dataclass
class GpsSolution:
    latitude_deg: float
    longitude_deg: float
    altitude_ft: float
    ground_speed_kt: float
    track_deg: float
    waas_available: bool
    waas_enabled: bool
    horizontal_accuracy_m: float
    vertical_accuracy_m: float

    def to_dict(self) -> Dict[str, float | bool]:
        return {
            "latitude_deg": self.latitude_deg,
            "longitude_deg": self.longitude_deg,
            "altitude_ft": self.altitude_ft,
            "ground_speed_kt": self.ground_speed_kt,
            "track_deg": self.track_deg,
            "waas_available": self.waas_available,
            "waas_enabled": self.waas_enabled,
            "horizontal_accuracy_m": self.horizontal_accuracy_m,
            "vertical_accuracy_m": self.vertical_accuracy_m,
        }


def is_waas_available(latitude_deg: float, longitude_deg: float) -> bool:
    return 15.0 <= latitude_deg <= 55.0 and -130.0 <= longitude_deg <= -60.0


def _accuracy_for_waas(waas_enabled: bool) -> tuple[float, float]:
    if waas_enabled:
        return WAAS_HORIZONTAL_ACCURACY_M, WAAS_VERTICAL_ACCURACY_M
    return GPS_HORIZONTAL_ACCURACY_M, GPS_VERTICAL_ACCURACY_M


def _apply_position_error(
    latitude_deg: float,
    longitude_deg: float,
    altitude_ft: float,
    horizontal_accuracy_m: float,
    vertical_accuracy_m: float,
    timestamp: float,
) -> tuple[float, float, float]:
    horizontal_error_nm = horizontal_accuracy_m / 1852.0
    angle = (timestamp * 0.35) % (2 * math.pi)
    lat_rad = math.radians(latitude_deg)
    delta_lat = (horizontal_error_nm * math.cos(angle)) / 60.0
    delta_lon = (horizontal_error_nm * math.sin(angle)) / max(1e-6, 60.0 * math.cos(lat_rad))
    vertical_error_ft = (vertical_accuracy_m / 0.3048) * math.sin(timestamp * 0.15)
    return latitude_deg + delta_lat, longitude_deg + delta_lon, altitude_ft + vertical_error_ft


def compute_gps(
    latitude_deg: float,
    longitude_deg: float,
    altitude_ft: float,
    ground_speed_kt: float,
    track_deg: float,
    timestamp: float,
) -> GpsSolution:
    waas_available = is_waas_available(latitude_deg, longitude_deg)
    waas_enabled = waas_available
    horizontal_accuracy_m, vertical_accuracy_m = _accuracy_for_waas(waas_enabled)
    gps_lat, gps_lon, gps_alt = _apply_position_error(
        latitude_deg,
        longitude_deg,
        altitude_ft,
        horizontal_accuracy_m,
        vertical_accuracy_m,
        timestamp,
    )
    return GpsSolution(
        latitude_deg=gps_lat,
        longitude_deg=gps_lon,
        altitude_ft=gps_alt,
        ground_speed_kt=ground_speed_kt,
        track_deg=track_deg,
        waas_available=waas_available,
        waas_enabled=waas_enabled,
        horizontal_accuracy_m=horizontal_accuracy_m,
        vertical_accuracy_m=vertical_accuracy_m,
    )
