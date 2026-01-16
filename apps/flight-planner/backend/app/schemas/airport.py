from __future__ import annotations

from typing import Optional

from pydantic import BaseModel


class AirportInfo(BaseModel):
    icao: str
    iata: str
    name: Optional[str] = None
    city: str = ""
    country: str = ""
    latitude: float
    longitude: float
    elevation: Optional[float] = None
    type: str = ""
