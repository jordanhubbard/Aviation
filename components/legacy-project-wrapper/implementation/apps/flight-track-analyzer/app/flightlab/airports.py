"""Read Aviation's bundled airport elevations for nearby field references."""
from __future__ import annotations

import json
import os
from functools import lru_cache
from pathlib import Path

import numpy as np
from scipy.spatial import cKDTree

EARTH_KM = 6371.0088
MAX_DISTANCE_KM = 5.0


def _unit_vectors(lat, lon):
    lat, lon = np.radians(lat), np.radians(lon)
    c = np.cos(lat)
    return np.stack((c * np.cos(lon), c * np.sin(lon), np.sin(lat)), axis=-1)


class AirportIndex:
    def __init__(self, airports):
        self.airports = []
        for airport in airports:
            try:
                lat = float(airport["latitude"])
                lon = float(airport["longitude"])
                elevation = float(airport["elevation"])
            except (KeyError, TypeError, ValueError):
                continue
            if not (np.isfinite(lat) and np.isfinite(lon) and np.isfinite(elevation)):
                continue
            if abs(lat) > 90 or abs(lon) > 180 or not airport.get("icao") or airport.get("type") == "heliport":
                continue
            self.airports.append({"icao": str(airport["icao"]), "name": str(airport.get("name") or ""),
                                  "latitude": lat, "longitude": lon, "elevation_ft": elevation})
        coordinates = np.array([(a["latitude"], a["longitude"]) for a in self.airports], float).reshape(-1, 2)
        self.tree = cKDTree(_unit_vectors(coordinates[:, 0], coordinates[:, 1])) if len(coordinates) else None

    def nearest_many(self, lat, lon):
        lat, lon = np.broadcast_arrays(np.asarray(lat, float), np.asarray(lon, float))
        if self.tree is None:
            return np.full(lat.shape, -1, int), np.full(lat.shape, np.inf)
        chord, index = self.tree.query(_unit_vectors(lat, lon))
        km = 2 * EARTH_KM * np.arcsin(np.minimum(chord / 2, 1))
        index = np.where(km <= MAX_DISTANCE_KM, index, -1)
        return index, km

    def nearest(self, lat, lon):
        index, distance = self.nearest_many(lat, lon)
        i = int(index)
        return ({**self.airports[i], "distance_km": float(distance)} if i >= 0 else None)


def _default_path():
    override = os.environ.get("AVIATION_AIRPORTS_DATA") or os.environ.get("AVIATION_AIRPORTS_DATA_PATH")
    if override:
        return Path(override)
    return Path(__file__).parents[3] / "flight-planner/backend/data/airports_cache.json"


@lru_cache(maxsize=2)
def _read_index(path, size, mtime_ns):
    del size, mtime_ns
    with Path(path).open(encoding="utf-8") as stream:
        data = json.load(stream)
    if not isinstance(data, list):
        raise ValueError("airport dataset must contain a list")
    return AirportIndex(data)


def default_airports():
    path = _default_path()
    try:
        state = path.stat()
        return _read_index(str(path), state.st_size, state.st_mtime_ns)
    except (OSError, ValueError, TypeError, json.JSONDecodeError):
        return None
