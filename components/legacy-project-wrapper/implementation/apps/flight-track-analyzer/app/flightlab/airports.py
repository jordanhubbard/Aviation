"""Read Aviation's bundled airport elevations for nearby field references."""

from __future__ import annotations

from functools import lru_cache

import numpy as np
from aviation.navigation import distance_km
from scipy.spatial import cKDTree

from aviation import load_airport_cache

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
            if (
                abs(lat) > 90
                or abs(lon) > 180
                or not airport.get("icao")
                or airport.get("type") == "heliport"
            ):
                continue
            self.airports.append(
                {
                    "icao": str(airport["icao"]),
                    "name": str(airport.get("name") or ""),
                    "latitude": lat,
                    "longitude": lon,
                    "elevation_ft": elevation,
                }
            )
        coordinates = np.array(
            [(a["latitude"], a["longitude"]) for a in self.airports], float
        ).reshape(-1, 2)
        self.tree = (
            cKDTree(_unit_vectors(coordinates[:, 0], coordinates[:, 1]))
            if len(coordinates)
            else None
        )

    def nearest_many(self, lat, lon):
        lat, lon = np.broadcast_arrays(np.asarray(lat, float), np.asarray(lon, float))
        if self.tree is None:
            return np.full(lat.shape, -1, int), np.full(lat.shape, np.inf)
        _chord, index = self.tree.query(_unit_vectors(lat, lon))
        flat_index = np.asarray(index).reshape(-1)
        flat_lat = lat.reshape(-1)
        flat_lon = lon.reshape(-1)
        km = np.fromiter(
            (
                distance_km(
                    float(query_lat),
                    float(query_lon),
                    self.airports[int(candidate)]["latitude"],
                    self.airports[int(candidate)]["longitude"],
                )
                for query_lat, query_lon, candidate in zip(
                    flat_lat, flat_lon, flat_index
                )
            ),
            dtype=float,
            count=flat_index.size,
        ).reshape(lat.shape)
        index = np.where(km <= MAX_DISTANCE_KM, index, -1)
        return index, km

    def nearest(self, lat, lon):
        index, distance = self.nearest_many(lat, lon)
        i = int(index)
        return {**self.airports[i], "distance_km": float(distance)} if i >= 0 else None


@lru_cache(maxsize=1)
def default_airports():
    try:
        return AirportIndex(load_airport_cache())
    except (OSError, ValueError, TypeError):
        return None
