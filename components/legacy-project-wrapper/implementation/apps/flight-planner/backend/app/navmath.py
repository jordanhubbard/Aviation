"""Flight Planner compatibility names backed by the common navigation SDK.

Application callers retain their established imports while common distance and wind
semantics remain owned and independently tested by ``aviation.navigation``.
"""

from __future__ import annotations

from aviation.navigation import (
    distance_nm as haversine_nm,
    wind_components,
)


def normalize_heading(deg: float) -> float:
    """Wrap a compass heading into the half-open range [0, 360) degrees."""
    return float(deg) % 360.0


def heading_difference(a: float, b: float) -> float:
    """Signed smallest angular difference from heading ``a`` to heading ``b``.

    Returns the difference in degrees within the half-open range (-180, 180]:
    positive values mean a clockwise (rightward) turn from ``a`` to ``b``,
    negative values a counter-clockwise (leftward) turn. Diametrically opposite
    headings yield +180.0 (the upper bound is inclusive, the lower exclusive).
    """
    d = (float(b) - float(a) + 180.0) % 360.0 - 180.0
    # Map the diametrically-opposite case onto the inclusive +180.0 bound so the
    # result stays in (-180, 180] rather than [-180, 180).
    if d == -180.0:
        d = 180.0
    return d


def crosswind_component(
    runway_heading: float, wind_dir: float, wind_speed: float
) -> float:
    """Signed crosswind component of the wind relative to a runway heading.

    The crosswind is the part of the wind blowing perpendicular to the runway,
    computed as ``wind_speed * sin(wind_dir - runway_heading)`` (angles in
    degrees, converted to radians for ``math.sin``).

    Sign convention: a positive return value means the wind is coming from the
    right of the runway heading; a negative value means it comes from the left.
    A pure headwind or tailwind yields 0.
    """
    return wind_components(float(wind_dir), float(wind_speed), float(runway_heading))[1]


def headwind_component(
    runway_heading: float, wind_dir: float, wind_speed: float
) -> float:
    """Signed headwind component of the wind along a runway heading.

    The headwind is the part of the wind blowing parallel to the runway,
    computed as ``wind_speed * cos(wind_dir - runway_heading)`` (angles in
    degrees, converted to radians for ``math.cos``), using the same angle
    convention as :func:`crosswind_component`.

    Sign convention: a positive return value means a headwind (wind from
    ahead, opposing the takeoff direction); a negative value means a tailwind
    (wind from behind). A pure crosswind yields 0.
    """
    return wind_components(float(wind_dir), float(wind_speed), float(runway_heading))[0]
