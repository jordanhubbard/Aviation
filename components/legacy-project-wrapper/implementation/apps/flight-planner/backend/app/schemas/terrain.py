from __future__ import annotations

from typing import Annotated, List, Optional, Tuple

from pydantic import BaseModel, Field


Latitude = Annotated[float, Field(ge=-90, le=90, allow_inf_nan=False)]
Longitude = Annotated[float, Field(ge=-180, le=180, allow_inf_nan=False)]


class TerrainPointResponse(BaseModel):
    latitude: float
    longitude: float
    elevation_ft: Optional[float]
    source: dict = Field(default_factory=dict)


class TerrainProfileRequest(BaseModel):
    points: List[Tuple[Latitude, Longitude]] = Field(..., min_length=1, max_length=500, description="List of (lat, lon) points; 1 to 500 samples")
    demtype: str = Field(default="SRTMGL1", max_length=32, pattern=r"^[A-Za-z0-9_-]+$", description="Requested OpenTopography DEM; Open-Meteo uses its provider DEM")


class TerrainProfilePoint(BaseModel):
    latitude: float
    longitude: float
    elevation_ft: Optional[float]


class TerrainProfileResponse(BaseModel):
    demtype: str
    points: List[TerrainProfilePoint]
    source: dict = Field(default_factory=dict)
