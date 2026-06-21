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


def crosswind_component(runway_heading: float, wind_dir: float, wind_speed: float) -> float:
    """Signed crosswind component of the wind relative to a runway heading.

    The crosswind is the part of the wind blowing perpendicular to the runway,
    computed as ``wind_speed * sin(wind_dir - runway_heading)`` (angles in
    degrees, converted to radians for ``math.sin``).

    Sign convention: a positive return value means the wind is coming from the
    right of the runway heading; a negative value means it comes from the left.
    A pure headwind or tailwind yields 0.
    """
    angle = float(wind_dir) - float(runway_heading)
    return float(wind_speed) * math.sin(math.radians(angle))
