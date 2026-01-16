from __future__ import annotations

import math
from typing import Tuple


def bearing_deg(a: Tuple[float, float], b: Tuple[float, float]) -> float:
    lat1, lon1 = map(math.radians, a)
    lat2, lon2 = map(math.radians, b)
    dlon = lon2 - lon1

    x = math.sin(dlon) * math.cos(lat2)
    y = math.cos(lat1) * math.sin(lat2) - math.sin(lat1) * math.cos(lat2) * math.cos(dlon)
    brng = math.degrees(math.atan2(x, y))
    return (brng + 360.0) % 360.0


def wind_components_kt(
    *, track_deg: float, wind_from_deg: float, wind_speed_kt: float
) -> tuple[float, float]:
    rel = math.radians((wind_from_deg - track_deg + 360.0) % 360.0)
    headwind = wind_speed_kt * math.cos(rel)
    crosswind = wind_speed_kt * math.sin(rel)
    return headwind, crosswind
