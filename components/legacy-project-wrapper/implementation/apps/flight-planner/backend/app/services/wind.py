from __future__ import annotations

from typing import Tuple

from aviation.navigation import ground_speed, initial_bearing, wind_components


def bearing_deg(a: Tuple[float, float], b: Tuple[float, float]) -> float:
    return initial_bearing(a[0], a[1], b[0], b[1])


def wind_components_kt(
    *, track_deg: float, wind_from_deg: float, wind_speed_kt: float
) -> tuple[float, float]:
    return wind_components(wind_from_deg, wind_speed_kt, track_deg)


def ground_speed_kt(
    *,
    true_airspeed_kt: float,
    track_deg: float,
    wind_from_deg: float,
    wind_speed_kt: float,
) -> float:
    return ground_speed(true_airspeed_kt, track_deg, wind_from_deg, wind_speed_kt)
