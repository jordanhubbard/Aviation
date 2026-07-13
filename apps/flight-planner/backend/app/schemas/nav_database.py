"""Navigation database schemas for API requests and responses."""
from __future__ import annotations

from enum import Enum
from typing import List, Optional

from pydantic import BaseModel, Field


class NavaidType(str, Enum):
    """Type of navigation aid."""
    VOR = "VOR"
    NDB = "NDB"
    DME = "DME"
    VORDME = "VORDME"
    VORTAC = "VORTAC"
    ILS = "ILS"
    FIX = "FIX"
    OTHER = "OTHER"


class AirspaceClass(str, Enum):
    """FAA/ICAO airspace classification."""
    A = "A"
    B = "B"
    C = "C"
    D = "D"
    E = "E"
    F = "F"
    G = "G"


class NavAirportSchema(BaseModel):
    """Schema for an airport in the navigation database."""
    icao: str = Field(..., description="ICAO airport identifier (e.g. KSFO)")
    iata: Optional[str] = Field(None, description="IATA airport code (e.g. SFO)")
    name: Optional[str] = Field(None, description="Full airport name")
    latitude: float = Field(..., description="Airport latitude in decimal degrees")
    longitude: float = Field(..., description="Airport longitude in decimal degrees")
    elevation_ft: Optional[int] = Field(None, description="Airport elevation in feet MSL")


class NavNavaidSchema(BaseModel):
    """Schema for a navigation aid (VOR, NDB, etc.)."""
    identifier: str = Field(..., description="Navaid identifier (e.g. SFO)")
    name: Optional[str] = Field(None, description="Full navaid name")
    type: NavaidType = Field(..., description="Type of navigation aid")
    latitude: float = Field(..., description="Navaid latitude in decimal degrees")
    longitude: float = Field(..., description="Navaid longitude in decimal degrees")
    frequency: Optional[str] = Field(None, description="Navaid frequency (MHz or kHz)")
    airport_icao: Optional[str] = Field(None, description="Associated airport ICAO if co-located")


class NavAirspaceSchema(BaseModel):
    """Schema for an airspace region."""
    identifier: str = Field(..., description="Airspace identifier")
    name: Optional[str] = Field(None, description="Airspace name")
    airspace_class: AirspaceClass = Field(..., description="Airspace classification")
    lower_limit_ft: int = Field(..., description="Lower altitude limit in feet MSL")
    upper_limit_ft: int = Field(..., description="Upper altitude limit in feet MSL")
    controlling_facility: Optional[str] = Field(None, description="ATC facility controlling the airspace")


class NavProcedureSchema(BaseModel):
    """Schema for a navigation procedure (SID, STAR, or approach)."""
    name: str = Field(..., description="Procedure name/identifier")
    type: str = Field(..., description="Procedure type: SID, STAR, or APPROACH")
    runway: Optional[str] = Field(None, description="Associated runway designator")
    initial_altitude_ft: Optional[int] = Field(None, description="Initial altitude in feet MSL")


class NavDataSearchResponse(BaseModel):
    """Response schema for navigation database search."""
    airports: List[NavAirportSchema] = Field(default_factory=list, description="Matching airports")
    navaids: List[NavNavaidSchema] = Field(default_factory=list, description="Matching navaids")


class NavDataProceduresResponse(BaseModel):
    """Response schema for airport procedures lookup."""
    airport: Optional[NavAirportSchema] = Field(None, description="Airport information")
    sids: List[NavProcedureSchema] = Field(default_factory=list, description="Standard Instrument Departures")
    stars: List[NavProcedureSchema] = Field(default_factory=list, description="Standard Terminal Arrival Routes")
    approaches: List[NavProcedureSchema] = Field(default_factory=list, description="Instrument approach procedures")
