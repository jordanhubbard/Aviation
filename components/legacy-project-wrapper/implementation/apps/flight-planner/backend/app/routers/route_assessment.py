"""Typed route assessment over the planning HTTP/MCP boundary."""

from __future__ import annotations

from threading import BoundedSemaphore
from typing import Annotated, Any, Literal

from fastapi import APIRouter, HTTPException
from pydantic import AwareDatetime, BaseModel, ConfigDict, Field

from app.services.route_assessment import AssessmentError, assess
from app.services.ga_data import cached
from app.routers.ga import Source

router = APIRouter(tags=["route assessment"])
_capacity = BoundedSemaphore(2)
FiniteLatitude = Annotated[float, Field(ge=-90, le=90, allow_inf_nan=False, strict=True)]
FiniteLongitude = Annotated[float, Field(ge=-180, le=180, allow_inf_nan=False, strict=True)]


class Waypoint(BaseModel):
    model_config = ConfigDict(extra="forbid", allow_inf_nan=False)
    lat: FiniteLatitude
    lon: FiniteLongitude
    at: AwareDatetime = Field(description="Planned arrival time, including UTC offset")
    altitude_ft_msl: float = Field(
        ge=-2000,
        le=60000,
        strict=True,
        description="Planned feet MSL; pressure altitude/AGL are not interchangeable",
    )


class AssessmentRequest(BaseModel):
    model_config = ConfigDict(extra="forbid", allow_inf_nan=False)
    waypoints: list[Waypoint] = Field(min_length=2, max_length=50)
    corridor_nm: float = Field(default=5, ge=0, le=25)
    clearance_margin_ft: float = Field(default=1000, ge=0, le=5000)


class EncounterPosition(Waypoint):
    along_route_nm: float
    leg: int


class Finding(BaseModel):
    id: str
    kind: str
    name: str
    geometry_id: str
    window: tuple[float, float] | None
    floor: float | None
    ceiling: float | None
    notes: list[str]
    source: Source
    raw: dict[str, Any]
    entry: EncounterPosition
    exit: EncounterPosition
    mode: Literal["centerline", "proximity"]
    applicability: Literal["intersects", "possible"]
    uncertainties: list[str]


class Unassessed(BaseModel):
    id: str
    kind: str
    name: str
    reason: str
    source: Source


class Coverage(BaseModel):
    name: str
    status: str
    sources: list[Source]
    truncated: bool
    error: str | None
    missing_geometry_ids: list[str]
    limitations: str | None


class TerrainSample(EncounterPosition):
    elevation_ft_msl: float | None
    clearance_ft: float | None
    below_margin: bool | None


class GeometryMethod(BaseModel):
    route_max_spacing_nm: float
    terrain_max_spacing_nm: float
    corridor: str


class AssessmentResponse(BaseModel):
    assessed_at_utc: AwareDatetime
    route: list[Waypoint]
    route_geometry: dict[str, Any]
    distance_nm: float
    corridor_nm: float
    clearance_margin_ft: float
    findings: list[Finding]
    geometries: dict[str, dict[str, Any]]
    total_findings: int
    findings_truncated: bool
    unassessed: list[Unassessed]
    unassessed_count: int
    terrain: list[TerrainSample]
    terrain_source: Source | None
    sources: list[Coverage]
    coverage_gaps: list[str]
    geometry_method: GeometryMethod
    limitations: str


@router.post(
    "/route-assessment",
    response_model=AssessmentResponse,
    summary="Assess a timed altitude profile against sourced hazards and sampled terrain",
)
def route_assessment(request: AssessmentRequest):
    if not _capacity.acquire(blocking=False):
        raise HTTPException(
            429, "Route assessment capacity is busy; retry later", headers={"Retry-After": "30"}
        )
    try:
        points = [p.model_dump(mode="json") for p in request.waypoints]
        key = (
            "route-assessment",
            tuple((p["lat"], p["lon"], p["at"], p["altitude_ft_msl"]) for p in points),
            request.corridor_nm,
            request.clearance_margin_ft,
        )
        return cached(
            key,
            60,
            lambda: assess(
                points,
                corridor_nm=request.corridor_nm,
                clearance_margin_ft=request.clearance_margin_ft,
            ),
        )
    except AssessmentError as error:
        raise HTTPException(422, detail=str(error)) from error
    finally:
        _capacity.release()
