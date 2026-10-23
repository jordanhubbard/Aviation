from __future__ import annotations

from datetime import datetime
from enum import Enum
from typing import Annotated, List, Literal, Optional, Union

from pydantic import BaseModel, Field


class LatLon(BaseModel):
    lat: float
    lon: float


class GeoPolygon(BaseModel):
    type: Literal["Polygon"] = "Polygon"
    coordinates: List[LatLon]


class GeoPoint(BaseModel):
    type: Literal["Point"] = "Point"
    coordinate: LatLon


HazardGeometry = Annotated[
    Union[GeoPolygon, GeoPoint],
    Field(discriminator="type"),
]


class HazardKind(str, Enum):
    SIGMET = "SIGMET"
    AIRMET = "AIRMET"
    TFR = "TFR"


class HazardSeverity(str, Enum):
    advisory = "advisory"
    watch = "watch"
    warning = "warning"
    emergency = "emergency"


class AltitudeBand(BaseModel):
    floor: Optional[float] = None
    ceiling: Optional[float] = None


class AviationHazard(BaseModel):
    id: str
    kind: HazardKind
    sub_type: str = Field(alias="subType")
    summary: str
    geometry: HazardGeometry
    altitude_band_ft: AltitudeBand = Field(alias="altitudeBandFt")
    valid_from: datetime = Field(alias="validFrom")
    valid_to: datetime = Field(alias="validTo")
    severity: HazardSeverity
    raw_text: Optional[str] = Field(default=None, alias="rawText")
    source_url: Optional[str] = Field(default=None, alias="sourceUrl")

    model_config = {"populate_by_name": True}


class HazardListResponse(BaseModel):
    hazards: List[AviationHazard]
    count: int


class HazardQueryRequest(BaseModel):
    kinds: Optional[List[HazardKind]] = None
    severities: Optional[List[HazardSeverity]] = None
    min_lat: Optional[float] = None
    max_lat: Optional[float] = None
    min_lon: Optional[float] = None
    max_lon: Optional[float] = None
    valid_at: Optional[datetime] = None
