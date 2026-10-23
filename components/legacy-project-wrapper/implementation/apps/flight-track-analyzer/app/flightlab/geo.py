"""Units and local-tangent-plane geometry."""
from __future__ import annotations

import numpy as np

EARTH_R = 6378137.0
M_TO_FT = 3.280839895
MPS_TO_KT = 1.943844492
M_TO_NM = 1.0 / 1852.0
G = 9.80665


def to_enu(lat, lon, lat0, lon0):
    """Equirectangular projection about (lat0, lon0); metres east, north."""
    lat = np.asarray(lat, float)
    lon = np.asarray(lon, float)
    x = np.radians(lon - lon0) * EARTH_R * np.cos(np.radians(lat0))
    y = np.radians(lat - lat0) * EARTH_R
    return x, y


def from_enu(x, y, lat0, lon0):
    lat = lat0 + np.degrees(np.asarray(y, float) / EARTH_R)
    lon = lon0 + np.degrees(np.asarray(x, float) / (EARTH_R * np.cos(np.radians(lat0))))
    return lat, lon


def wrap180(a):
    """Wrap degrees into [-180, 180)."""
    return (np.asarray(a, float) + 180.0) % 360.0 - 180.0


def circ_mean_deg(a, w=None):
    a = np.radians(np.asarray(a, float))
    w = np.ones_like(a) if w is None else np.asarray(w, float)
    return float(np.degrees(np.arctan2((w * np.sin(a)).sum(), (w * np.cos(a)).sum())) % 360.0)


def runway_designator(heading_deg: float) -> str:
    n = int(round(heading_deg / 10.0)) % 36
    return f"{36 if n == 0 else n:02d}"
