from __future__ import annotations

from typing import List, Literal, Optional, Tuple

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from app.models.airport import get_airport_coordinates
from app.services.xctry_route_planner import haversine_nm, plan_route


router = APIRouter()


class RouteRequest(BaseModel):
    origin: str
    destination: str
    speed: float
    speed_unit: Literal["knots", "mph"] = "knots"
    altitude: int = Field(..., description="Requested cruising altitude (ft)")
    avoid_airspaces: bool = False
    avoid_terrain: bool = False
    max_leg_distance: float = 150.0
    plan_fuel_stops: bool = False
    aircraft_range_nm: Optional[float] = None


class Segment(BaseModel):
    start: Tuple[float, float]
    end: Tuple[float, float]
    type: Literal["climb", "cruise", "descent"]
    vfr_altitude: int


class RouteResponse(BaseModel):
    route: List[str]
    distance_nm: float
    time_hr: float
    origin_coords: Tuple[float, float]
    destination_coords: Tuple[float, float]
    segments: List[Segment]


@router.get("/airport/{code}")
def airport_lookup(code: str) -> dict:
    airport = get_airport_coordinates(code)
    if not airport:
        raise HTTPException(status_code=404, detail=f"Airport {code} not found")
    return airport


@router.post("/route", response_model=RouteResponse)
def calculate_route(req: RouteRequest) -> RouteResponse:
    origin = get_airport_coordinates(req.origin)
    dest = get_airport_coordinates(req.destination)
    if not origin or not dest:
        raise HTTPException(status_code=400, detail="Invalid origin or destination code")

    o_lat = origin["latitude"]
    o_lon = origin["longitude"]
    d_lat = dest["latitude"]
    d_lon = dest["longitude"]

    if req.avoid_terrain:
        raise HTTPException(
            status_code=501,
            detail="Terrain avoidance not yet wired in this unified backend (elevation service pending)",
        )

    try:
        points, planned_segments = plan_route(
            origin=(o_lat, o_lon),
            destination=(d_lat, d_lon),
            cruising_altitude_ft=req.altitude,
            avoid_airspaces_enabled=req.avoid_airspaces,
        )
    except FileNotFoundError as e:
        raise HTTPException(
            status_code=503,
            detail=f"Airspace data file not found ({e}). Populate backend/data/airspaces_us.json or set AIRSPACES_FILE.",
        )

    total_dist = 0.0
    for i in range(len(points) - 1):
        total_dist += haversine_nm(points[i][0], points[i][1], points[i + 1][0], points[i + 1][1])

    speed_kt = req.speed if req.speed_unit == "knots" else req.speed * 0.868976
    total_time = total_dist / speed_kt if speed_kt else 0.0

    segments: List[Segment] = []
    for idx, seg in enumerate(planned_segments):
        seg_type: Literal["climb", "cruise", "descent"] = "cruise"
        if idx == 0:
            seg_type = "climb"
        if idx == len(planned_segments) - 1:
            seg_type = "descent" if len(planned_segments) > 1 else seg_type

        segments.append(
            Segment(
                start=seg.start,
                end=seg.end,
                type=seg_type,
                vfr_altitude=seg.vfr_altitude_ft,
            )
        )

    return RouteResponse(
        route=[req.origin.upper(), req.destination.upper()],
        distance_nm=round(total_dist, 1),
        time_hr=round(total_time, 2),
        origin_coords=(o_lat, o_lon),
        destination_coords=(d_lat, d_lon),
        segments=segments,
    )
