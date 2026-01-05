from __future__ import annotations

from typing import List, Optional, Tuple

from pydantic import BaseModel, Field


class TerrainPointResponse(BaseModel):
    latitude: float
    longitude: float
    elevation_ft: Optional[float]


class TerrainProfileRequest(BaseModel):
    points: List[Tuple[float, float]] = Field(..., description="List of (lat, lon) points")
    demtype: str = "SRTMGL1"


class TerrainProfilePoint(BaseModel):
    latitude: float
    longitude: float
    elevation_ft: Optional[float]


class TerrainProfileResponse(BaseModel):
    demtype: str
    points: List[TerrainProfilePoint]
