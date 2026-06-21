"""Pure-Python navigation / aviation math helpers for the flight planner.

Stdlib-only (no app dependencies), so each helper is unit-testable in isolation.
New helpers register here; this module plus tests/test_navmath.py are the
integration points that independently authored helpers converge on.
"""

from __future__ import annotations

import math  # noqa: F401  (used by helpers appended below)


def normalize_heading(deg: float) -> float:
    """Wrap a compass heading into the half-open range [0, 360) degrees."""
    return float(deg) % 360.0


def haversine_nm(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Great-circle distance between two lat/lon points in nautical miles.

    Inputs are in decimal degrees. Uses the haversine formula with Earth's
    mean radius of 3440.065 NM, so the result is the shortest distance over
    the surface of a spherical Earth between the two points.
    """
    earth_radius_nm = 3440.065

    phi1 = math.radians(lat1)
    phi2 = math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlambda = math.radians(lon2 - lon1)

    a = (
        math.sin(dphi / 2.0) ** 2
        + math.cos(phi1) * math.cos(phi2) * math.sin(dlambda / 2.0) ** 2
    )
    c = 2.0 * math.asin(math.sqrt(a))

    return earth_radius_nm * c
