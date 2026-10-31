"""Units and local-tangent-plane geometry."""

from __future__ import annotations

import numpy as np

from aviation.navigation import (
    circular_mean_heading,
    from_local_tangent_plane,
    heading_difference,
    runway_designator as navigation_runway_designator,
    to_local_tangent_plane,
)

M_TO_FT = 3.280839895
MPS_TO_KT = 1.943844492
M_TO_NM = 1.0 / 1852.0
G = 9.80665


def to_enu(lat, lon, lat0, lon0):
    """Vectorized adapter for the SDK local tangent-plane projection."""
    lat_values, lon_values = np.broadcast_arrays(
        np.asarray(lat, float), np.asarray(lon, float)
    )
    to_local_tangent_plane(float(lat0), float(lon0), float(lat0), float(lon0))
    projected = [
        to_local_tangent_plane(float(a), float(b), float(lat0), float(lon0))
        for a, b in zip(lat_values.flat, lon_values.flat)
    ]
    east = np.asarray([value[0] for value in projected], float).reshape(
        lat_values.shape
    )
    north = np.asarray([value[1] for value in projected], float).reshape(
        lat_values.shape
    )
    return east, north


def from_enu(x, y, lat0, lon0):
    """Vectorized adapter for the SDK inverse local tangent-plane projection."""
    east_values, north_values = np.broadcast_arrays(
        np.asarray(x, float), np.asarray(y, float)
    )
    from_local_tangent_plane(0.0, 0.0, float(lat0), float(lon0))
    projected = [
        from_local_tangent_plane(float(a), float(b), float(lat0), float(lon0))
        for a, b in zip(east_values.flat, north_values.flat)
    ]
    lat = np.asarray([value[0] for value in projected], float).reshape(
        east_values.shape
    )
    lon = np.asarray([value[1] for value in projected], float).reshape(
        east_values.shape
    )
    return lat, lon


def wrap180(a):
    """Vectorized adapter for the SDK shortest signed heading difference."""
    values = np.asarray(a, float)
    return np.fromiter(
        (heading_difference(0.0, float(value)) for value in values.flat),
        dtype=float,
        count=values.size,
    ).reshape(values.shape)


def circ_mean_deg(a, w=None):
    values = np.asarray(a, float).reshape(-1).tolist()
    weights = None if w is None else np.asarray(w, float).reshape(-1).tolist()
    return circular_mean_heading(values, weights)


def runway_designator(heading_deg: float) -> str:
    return navigation_runway_designator(heading_deg)
