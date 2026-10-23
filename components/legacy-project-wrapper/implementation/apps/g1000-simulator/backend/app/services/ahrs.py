from __future__ import annotations

from dataclasses import dataclass
import math
from typing import Dict


def clamp(value: float, minimum: float, maximum: float) -> float:
    return max(minimum, min(maximum, value))


def normalize_heading(heading: float) -> float:
    return heading % 360


def estimate_magnetic_variation(latitude_deg: float, longitude_deg: float) -> float:
    variation = longitude_deg * 0.1
    return clamp(variation, -30.0, 30.0)


def compute_slip_skid(turn_rate_dps: float, roll_deg: float, airspeed_kt: float) -> float:
    speed_mps = max(airspeed_kt * 0.514444, 1.0)
    bank_rad = math.radians(roll_deg)
    coordinated_turn_rate = math.degrees(9.80665 * math.tan(bank_rad) / speed_mps)
    slip = turn_rate_dps - coordinated_turn_rate
    return clamp(slip, -10.0, 10.0)


@dataclass
class AhrsSolution:
    pitch_deg: float
    roll_deg: float
    yaw_deg: float
    true_heading_deg: float
    magnetic_heading_deg: float
    magnetic_variation_deg: float
    slip_skid_deg: float

    def to_dict(self) -> Dict[str, float]:
        return {
            "heading_deg": self.magnetic_heading_deg,
            "true_heading_deg": self.true_heading_deg,
            "pitch_deg": self.pitch_deg,
            "roll_deg": self.roll_deg,
            "yaw_deg": self.yaw_deg,
            "slip_skid_deg": self.slip_skid_deg,
            "magnetic_variation_deg": self.magnetic_variation_deg,
        }


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
    variation = estimate_magnetic_variation(latitude_deg, longitude_deg)
    magnetic_heading = normalize_heading(true_heading - variation)
    slip_skid = compute_slip_skid(turn_rate_dps, roll_deg, airspeed_kt)
    return AhrsSolution(
        pitch_deg=pitch_deg,
        roll_deg=roll_deg,
        yaw_deg=true_heading,
        true_heading_deg=true_heading,
        magnetic_heading_deg=magnetic_heading,
        magnetic_variation_deg=variation,
        slip_skid_deg=slip_skid,
    )
