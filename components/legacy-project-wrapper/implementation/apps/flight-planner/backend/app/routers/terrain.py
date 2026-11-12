from __future__ import annotations

from fastapi import APIRouter, HTTPException, Query

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
    description="Returns terrain elevation in feet MSL and actual provider provenance (Open-Meteo or configured OpenTopography with fallback).",
)
def terrain_point(lat: float = Query(ge=-90, le=90, allow_inf_nan=False), lon: float = Query(ge=-180, le=180, allow_inf_nan=False), demtype: str = Query("SRTMGL1", max_length=32, pattern=r"^[A-Za-z0-9_-]+$")) -> TerrainPointResponse:
    try:
        prof, source = terrain_service.profile_with_source([(lat, lon)], demtype=demtype)
        elev_ft = prof[0][2]
    except terrain_service.TerrainServiceError as e:
        raise HTTPException(status_code=503, detail=str(e))
    except Exception:
        raise HTTPException(status_code=503, detail="Terrain service error")

    return TerrainPointResponse(latitude=lat, longitude=lon, elevation_ft=elev_ft, source=source)


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
        prof, source = terrain_service.profile_with_source(req.points, demtype=req.demtype)
    except terrain_service.TerrainServiceError as e:
        raise HTTPException(status_code=503, detail=str(e))
    except Exception:
        raise HTTPException(status_code=503, detail="Terrain service error")

    return TerrainProfileResponse(
        demtype=req.demtype,
        source=source,
        points=[
            TerrainProfilePoint(latitude=lat, longitude=lon, elevation_ft=elev_ft)
            for lat, lon, elev_ft in prof
        ],
    )
