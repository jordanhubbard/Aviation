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


def normalize_heading(heading: float) -> float:
    return _finite("heading_deg", heading) % 360.0


def normalize_signed_angle(angle: float) -> float:
    wrapped = (_finite("angle", angle) + 180.0) % 360.0 - 180.0
    return 180.0 if wrapped == -180.0 else wrapped


def estimate_magnetic_variation(latitude_deg: float, longitude_deg: float) -> float:
    latitude = _finite("latitude_deg", latitude_deg)
    longitude = _finite("longitude_deg", longitude_deg)
    if not -90.0 <= latitude <= 90.0:
        raise ValueError("latitude_deg out of range")
    if not -180.0 <= longitude <= 180.0:
        raise ValueError("longitude_deg out of range")
    return _clamp(longitude * 0.1, -30.0, 30.0)


@dataclass(frozen=True)
class AhrsSolution:
    heading_deg: float
    pitch_deg: float
    roll_deg: float
    yaw_deg: float
    true_heading_deg: float
    magnetic_heading_deg: float
    magnetic_variation_deg: float
    slip_skid_deg: float

    def to_dict(self) -> dict[str, float]:
        return asdict(self)


def compute_ahrs(
    heading_deg: float,
    pitch_deg: float,
    roll_deg: float,
    turn_rate_dps: float,
    airspeed_kt: float,
    latitude_deg: float,
    longitude_deg: float,
) -> AhrsSolution:
    true_heading = normalize_heading(heading_deg)
    pitch = normalize_signed_angle(pitch_deg)
    roll = normalize_signed_angle(roll_deg)
    variation = estimate_magnetic_variation(latitude_deg, longitude_deg)
    speed_mps = max(_finite("airspeed_kt", airspeed_kt) * 0.514444, 1.0)
    coordinated_turn_rate = math.degrees(
        9.80665 * math.tan(math.radians(roll)) / speed_mps
    )
    slip_skid = _clamp(
        _finite("turn_rate_dps", turn_rate_dps) - coordinated_turn_rate,
        -10.0,
        10.0,
    )
    return AhrsSolution(
        heading_deg=normalize_heading(true_heading - variation),
        pitch_deg=pitch,
        roll_deg=roll,
        yaw_deg=true_heading,
        true_heading_deg=true_heading,
        magnetic_heading_deg=normalize_heading(true_heading - variation),
        magnetic_variation_deg=variation,
        slip_skid_deg=slip_skid,
    )
