from __future__ import annotations

import json
import math
import os
from dataclasses import dataclass
from functools import lru_cache
from pathlib import Path
from typing import List, Tuple


def haversine_nm(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    r_nm = 3440.065
    phi1 = math.radians(lat1)
    phi2 = math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlambda = math.radians(lon2 - lon1)
    a = math.sin(dphi / 2) ** 2 + math.cos(phi1) * math.cos(phi2) * math.sin(dlambda / 2) ** 2
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
    return r_nm * c


def get_leg_sample_points(
    lat1: float, lon1: float, lat2: float, lon2: float, interval_nm: float = 10
) -> List[Tuple[float, float]]:
    dist_nm = haversine_nm(lat1, lon1, lat2, lon2)
    n_samples = max(2, int(dist_nm // interval_nm) + 1)

    return [
        (
            lat1 + (i / (n_samples - 1)) * (lat2 - lat1),
            lon1 + (i / (n_samples - 1)) * (lon2 - lon1),
        )
        for i in range(n_samples)
    ]


@dataclass(frozen=True)
class RouteSegment:
    start: Tuple[float, float]
    end: Tuple[float, float]
    segment_type: str
    vfr_altitude_ft: int


def _default_airspaces_path() -> Path:
    repo_root = Path(__file__).resolve().parents[3]
    return repo_root / "backend" / "data" / "airspaces_us.json"


@lru_cache
def load_airspaces_gdf():
    path = Path(os.environ.get("AIRSPACES_FILE", str(_default_airspaces_path())))
    if not path.exists():
        raise FileNotFoundError(str(path))

    import geopandas as gpd
    from shapely.geometry import shape

    raw = json.loads(path.read_text(encoding="utf-8"))
    features = []
    for asp in raw:
        geom = asp.get("geometry")
        if not geom:
            continue
        try:
            features.append(
                {
                    "geometry": shape(geom),
                    "name": asp.get("name"),
                    "class": asp.get("category"),
                    "type": asp.get("type"),
                    "id": asp.get("id"),
                }
            )
        except Exception:
            continue

    return gpd.GeoDataFrame(features, crs="EPSG:4326")


def avoid_airspaces(
    route_points: List[Tuple[float, float]], buffer_nm: float = 5.0
) -> List[Tuple[float, float]]:
    from shapely.geometry import LineString

    airspaces_gdf = load_airspaces_gdf()
    if airspaces_gdf.empty:
        return route_points

    changed = True
    max_iter = 10
    iter_count = 0

    while changed and iter_count < max_iter:
        changed = False
        new_points = [route_points[0]]

        for i in range(len(route_points) - 1):
            seg = LineString(
                [
                    (route_points[i][1], route_points[i][0]),
                    (route_points[i + 1][1], route_points[i + 1][0]),
                ]
            )
            intersecting = airspaces_gdf[airspaces_gdf.intersects(seg)]
            if not intersecting.empty:
                asp = intersecting.iloc[0]
                boundary = asp.geometry.boundary
                mid = seg.interpolate(0.5, normalized=True)
                closest = boundary.interpolate(boundary.project(mid))
                offset_lat = closest.y + buffer_nm * 0.0167
                offset_lon = closest.x + buffer_nm * 0.0167
                new_points.append((offset_lat, offset_lon))

                # Preserve the remaining route points (including the destination).
                # Without this, repeated iterations can truncate the route and drop the destination.
                new_points.extend(route_points[i + 1 :])
                changed = True
                break

            new_points.append(route_points[i + 1])

        if changed:
            route_points = new_points
        iter_count += 1

    # Drop consecutive duplicate points to avoid zero-length legs.
    deduped: List[Tuple[float, float]] = []
    for pt in route_points:
        if not deduped or pt != deduped[-1]:
            deduped.append(pt)

    return deduped


def _build_segments(
    points: List[Tuple[float, float]], cruising_altitude_ft: int
) -> List[RouteSegment]:
    segments: List[RouteSegment] = []
    for i in range(len(points) - 1):
        segments.append(
            RouteSegment(
                start=points[i],
                end=points[i + 1],
                segment_type="cruise",
                vfr_altitude_ft=cruising_altitude_ft,
            )
        )
    return segments


def plan_direct_route(
    origin: Tuple[float, float],
    destination: Tuple[float, float],
    cruising_altitude_ft: int,
) -> Tuple[List[Tuple[float, float]], List[RouteSegment]]:
    points = [origin, destination]
    return points, _build_segments(points, cruising_altitude_ft)


def plan_route(
    origin: Tuple[float, float],
    destination: Tuple[float, float],
    cruising_altitude_ft: int,
    *,
    avoid_airspaces_enabled: bool = False,
    airspace_buffer_nm: float = 5.0,
) -> Tuple[List[Tuple[float, float]], List[RouteSegment]]:
    points, _ = plan_direct_route(
        origin=origin, destination=destination, cruising_altitude_ft=cruising_altitude_ft
    )

    if avoid_airspaces_enabled:
        points = avoid_airspaces(points, buffer_nm=airspace_buffer_nm)

    return points, _build_segments(points, cruising_altitude_ft)
