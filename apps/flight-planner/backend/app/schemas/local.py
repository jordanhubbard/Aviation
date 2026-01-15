from __future__ import annotations

from datetime import datetime
from typing import List, Optional

from pydantic import BaseModel, Field


class LocalPlanRequest(BaseModel):
    airport: str = Field(..., description="ICAO/IATA airport code")
    radius_nm: Optional[float] = Field(None, description="Optional radius (NM) for local planning")


class AirportSummary(BaseModel):
    icao: str = ""
    iata: str = ""
    name: Optional[str] = None
    city: str = ""
    country: str = ""
    latitude: float
    longitude: float
    elevation: Optional[float] = None
    type: str = ""


class NearbyAirport(AirportSummary):
    distance_nm: float


class LocalPlanResponse(BaseModel):
    planned_at_utc: datetime
    airport: str
    radius_nm: float
    center: AirportSummary
    nearby_airports: List[NearbyAirport]
