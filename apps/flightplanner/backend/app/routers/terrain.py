from __future__ import annotations

from fastapi import APIRouter, HTTPException

from app.schemas.terrain import (
    TerrainPointResponse,
    TerrainProfilePoint,
    TerrainProfileRequest,
    TerrainProfileResponse,
)
from app.services import terrain_service

router = APIRouter()


@router.get("/terrain")
def terrain_status() -> dict:
    """Terrain service status endpoint."""
    return {"status": "ok"}


@router.get(
    "/terrain/point",
    response_model=TerrainPointResponse,
    summary="Get terrain elevation at a point",
    description="Returns elevation in feet for a (lat, lon) using OpenTopography.",
)
def terrain_point(lat: float, lon: float, demtype: str = "SRTMGL1") -> TerrainPointResponse:
    try:
        elev_ft = terrain_service.get_elevation_ft(lat, lon, demtype=demtype)
    except terrain_service.TerrainServiceError as e:
        raise HTTPException(status_code=503, detail=str(e))
    except Exception:
        raise HTTPException(status_code=503, detail="Terrain service error")

    return TerrainPointResponse(latitude=lat, longitude=lon, elevation_ft=elev_ft)


@router.post(
    "/terrain/profile",
    response_model=TerrainProfileResponse,
    summary="Get terrain elevation profile",
    description="Returns elevation in feet for a series of (lat, lon) points.",
    openapi_extra={
        "requestBody": {
            "content": {
                "application/json": {
                    "example": {
                        "demtype": "SRTMGL1",
                        "points": [[37.6213, -122.3790], [34.0522, -118.2437]],
                    }
                }
            }
        }
    },
)
def terrain_profile(req: TerrainProfileRequest) -> TerrainProfileResponse:
    try:
        prof = terrain_service.elevation_profile(req.points, demtype=req.demtype)
    except terrain_service.TerrainServiceError as e:
        raise HTTPException(status_code=503, detail=str(e))
    except Exception:
        raise HTTPException(status_code=503, detail="Terrain service error")

    return TerrainProfileResponse(
        demtype=req.demtype,
        points=[
            TerrainProfilePoint(latitude=lat, longitude=lon, elevation_ft=elev_ft)
            for lat, lon, elev_ft in prof
        ],
    )
