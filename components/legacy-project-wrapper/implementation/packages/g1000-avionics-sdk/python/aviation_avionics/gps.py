from __future__ import annotations

from dataclasses import asdict, dataclass
import math


def _finite(name: str, value: float) -> float:
    result = float(value)
    if not math.isfinite(result):
        raise ValueError(f"{name} must be finite")
    return result


def normalize_heading(heading: float) -> float:
    return _finite("track_deg", heading) % 360.0


def is_waas_available(latitude_deg: float, longitude_deg: float) -> bool:
    return 15.0 <= latitude_deg <= 55.0 and -130.0 <= longitude_deg <= -60.0


@dataclass(frozen=True)
class GpsSolution:
    latitude_deg: float
    longitude_deg: float
    altitude_ft: float
    ground_speed_kt: float
    track_deg: float
    waas_available: bool
    waas_enabled: bool
    raim_available: bool
    raim_ok: bool
    fix_valid: bool
    horizontal_accuracy_m: float
    vertical_accuracy_m: float

    def to_dict(self) -> dict[str, float | bool]:
        return asdict(self)


def compute_gps(
    latitude_deg: float,
    longitude_deg: float,
    altitude_ft: float,
    ground_speed_kt: float,
    track_deg: float,
    timestamp: float,
) -> GpsSolution:
    latitude = _finite("latitude_deg", latitude_deg)
    longitude = _finite("longitude_deg", longitude_deg)
    altitude = _finite("altitude_ft", altitude_ft)
    timestamp_value = _finite("timestamp", timestamp)
    if not -90.0 <= latitude <= 90.0:
        raise ValueError("latitude_deg out of range")
    if not -180.0 <= longitude <= 180.0:
        raise ValueError("longitude_deg out of range")
    waas_available = is_waas_available(latitude, longitude)
    waas_enabled = waas_available
    raim_ok = int(timestamp_value) % 300 >= 15
    multiplier = 1.0 if raim_ok else 4.0
    horizontal_accuracy = (3.0 if waas_enabled else 15.0) * multiplier
    vertical_accuracy = (5.0 if waas_enabled else 25.0) * multiplier
    horizontal_error_nm = horizontal_accuracy / 1852.0
    angle = (timestamp_value * 0.35) % (2.0 * math.pi)
    latitude_rad = math.radians(latitude)
    delta_latitude = horizontal_error_nm * math.cos(angle) / 60.0
    delta_longitude = horizontal_error_nm * math.sin(angle) / max(
        1e-6, 60.0 * math.cos(latitude_rad)
    )
    vertical_error_ft = vertical_accuracy / 0.3048 * math.sin(timestamp_value * 0.15)
    return GpsSolution(
        latitude_deg=latitude + delta_latitude,
        longitude_deg=longitude + delta_longitude,
        altitude_ft=altitude + vertical_error_ft,
        ground_speed_kt=max(0.0, _finite("ground_speed_kt", ground_speed_kt)),
        track_deg=normalize_heading(track_deg),
        waas_available=waas_available,
        waas_enabled=waas_enabled,
        raim_available=True,
        raim_ok=raim_ok,
        fix_valid=raim_ok,
        horizontal_accuracy_m=horizontal_accuracy,
        vertical_accuracy_m=vertical_accuracy,
    )
