"""Navigation database Pydantic v2 schemas for the flight-planner backend."""
from __future__ import annotations

from datetime import datetime
from typing import List, Optional

from pydantic import BaseModel, Field


class NavRunwaySchema(BaseModel):
    """Runway record for an airport."""

    identifier: str = Field(..., description="Runway identifier, e.g. '18L'")
    length_ft: Optional[float] = Field(None, description="Runway length in feet")
    width_ft: Optional[float] = Field(None, description="Runway width in feet")
    surface: Optional[str] = Field(None, description="Surface type, e.g. 'ASPHALT'")
    heading_deg: Optional[float] = Field(None, description="Magnetic heading in degrees")


class NavFrequencySchema(BaseModel):
    """Radio frequency record for an airport."""

    type: str = Field(..., description="Frequency type, e.g. 'ATIS', 'GROUND', 'TOWER'")
    description: Optional[str] = Field(None, description="Human-readable description")
    frequency_mhz: float = Field(..., description="Frequency in MHz")


class NavAirportSchema(BaseModel):
    """Airport record from the navigation database."""

    icao: str = Field(..., description="ICAO airport identifier")
    iata: Optional[str] = Field(None, description="IATA airport code")
    name: str = Field(..., description="Full airport name")
    city: Optional[str] = Field(None, description="City or municipality")
    country: Optional[str] = Field(None, description="Country code or name")
    latitude: float = Field(..., description="Airport reference latitude in decimal degrees")
    longitude: float = Field(..., description="Airport reference longitude in decimal degrees")
    elevation_ft: Optional[float] = Field(None, description="Airport elevation in feet MSL")
    runways: List[NavRunwaySchema] = Field(default_factory=list, description="Runway records")
    frequencies: List[NavFrequencySchema] = Field(default_factory=list, description="Radio frequency records")


class NavNavaidSchema(BaseModel):
    """Navigation aid (VOR, NDB, DME, fix, etc.) record."""

    identifier: str = Field(..., description="Navaid identifier")
    name: Optional[str] = Field(None, description="Full navaid name")
    type: str = Field(..., description="Navaid type, e.g. 'VOR', 'NDB', 'DME', 'FIX'")
    latitude: float = Field(..., description="Navaid latitude in decimal degrees")
    longitude: float = Field(..., description="Navaid longitude in decimal degrees")
    frequency: Optional[float] = Field(None, description="Frequency in MHz or kHz")
    magnetic_variation: Optional[float] = Field(None, description="Magnetic variation in degrees (+ east, - west)")


class NavAirspaceSchema(BaseModel):
    """Airspace region record."""

    identifier: str = Field(..., description="Airspace identifier")
    name: Optional[str] = Field(None, description="Airspace name")
    airspace_class: str = Field(..., description="Airspace class, e.g. 'A', 'B', 'C', 'D', 'E', 'G'")
    lower_limit_ft: Optional[float] = Field(None, description="Lower altitude limit in feet MSL")
    upper_limit_ft: Optional[float] = Field(None, description="Upper altitude limit in feet MSL")
    coordinates: List[tuple] = Field(default_factory=list, description="Boundary polygon as list of (lat, lon) tuples")


class ProcedureLegSchema(BaseModel):
    """A single leg within a navigation procedure."""

    fix: str = Field(..., description="Fix identifier for this leg")
    path_type: Optional[str] = Field(None, description="ARINC 424 path/terminator code")
    altitude_constraint: Optional[str] = Field(None, description="Altitude constraint descriptor")
    speed_constraint: Optional[str] = Field(None, description="Speed constraint descriptor")


class NavProcedureSchema(BaseModel):
    """Instrument procedure (SID, STAR, or approach) record."""

    identifier: str = Field(..., description="Procedure identifier")
    airport_icao: str = Field(..., description="Associated airport ICAO code")
    procedure_type: str = Field(..., description="Procedure type: 'SID', 'STAR', or 'APPROACH'")
    transitions: List[str] = Field(default_factory=list, description="Available transition names")
    legs: List[ProcedureLegSchema] = Field(default_factory=list, description="Ordered procedure legs")


class NavDataStatus(BaseModel):
    """Status summary for the navigation database."""

    airport_count: int = Field(..., description="Total number of airports loaded")
    navaid_count: int = Field(..., description="Total number of navaids loaded")
    airspace_count: int = Field(..., description="Total number of airspace regions loaded")
    last_updated: Optional[datetime] = Field(None, description="Timestamp of the most recent data update")
    source: Optional[str] = Field(None, description="Name or URL of the data source")
