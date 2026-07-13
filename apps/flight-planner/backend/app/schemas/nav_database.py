"""Navigation database Pydantic v2 schemas mirroring TypeScript types from packages/nav-data."""
from __future__ import annotations

from enum import Enum
from typing import Dict, List, Optional

from pydantic import BaseModel, Field


class AirspaceClass(str, Enum):
    """FAA/ICAO airspace classification."""

    A = "A"
    B = "B"
    C = "C"
    D = "D"
    E = "E"
    F = "F"
    G = "G"
    SPECIAL = "SPECIAL"
    OTHER = "OTHER"


class NavaidType(str, Enum):
    """Type of navigation aid."""

    VOR = "VOR"
    NDB = "NDB"
    DME = "DME"
    FIX = "FIX"
    TACAN = "TACAN"
    OTHER = "OTHER"


class ProcedureType(str, Enum):
    """Type of instrument procedure."""

    SID = "SID"
    STAR = "STAR"
    APPROACH = "APPROACH"
    OTHER = "OTHER"


class ProcedureAltitudeConstraintType(str, Enum):
    """Altitude constraint type for procedure legs."""

    AT = "AT"
    AT_OR_ABOVE = "AT_OR_ABOVE"
    AT_OR_BELOW = "AT_OR_BELOW"


class ProcedureSpeedConstraintType(str, Enum):
    """Speed constraint type for procedure legs."""

    AT = "AT"
    AT_OR_BELOW = "AT_OR_BELOW"


class GeoPointSchema(BaseModel):
    """Geographic coordinate point."""

    latitude: float = Field(..., description="Latitude in decimal degrees")
    longitude: float = Field(..., description="Longitude in decimal degrees")


class ProcedureAltitudeConstraintSchema(BaseModel):
    """Altitude constraint on a procedure leg."""

    type: ProcedureAltitudeConstraintType = Field(..., description="Constraint type")
    altitude_ft: float = Field(..., alias="altitudeFt", description="Altitude in feet MSL")

    model_config = {"populate_by_name": True}


class ProcedureSpeedConstraintSchema(BaseModel):
    """Speed constraint on a procedure leg."""

    type: ProcedureSpeedConstraintType = Field(..., description="Constraint type")
    speed_kts: float = Field(..., alias="speedKts", description="Speed in knots")

    model_config = {"populate_by_name": True}


class ProcedureLegSchema(BaseModel):
    """A single leg within a navigation procedure."""

    fix: str = Field(..., description="Fix identifier for this leg")
    path_type: Optional[str] = Field(None, alias="pathType", description="ARINC 424 path/terminator code")
    altitude_constraint: Optional[ProcedureAltitudeConstraintSchema] = Field(
        None, alias="altitudeConstraint", description="Altitude constraint for this leg"
    )
    speed_constraint: Optional[ProcedureSpeedConstraintSchema] = Field(
        None, alias="speedConstraint", description="Speed constraint for this leg"
    )

    model_config = {"populate_by_name": True}


class NavAirportSchema(BaseModel):
    """Airport record from the navigation database."""

    icao: str = Field(..., description="ICAO airport identifier")
    iata: Optional[str] = Field(None, description="IATA airport code")
    name: str = Field(..., description="Full airport name")
    location: GeoPointSchema = Field(..., description="Geographic coordinates")
    elevation_ft: Optional[float] = Field(None, alias="elevationFt", description="Airport elevation in feet MSL")
    type: Optional[str] = Field(None, description="Airport type")
    country: Optional[str] = Field(None, description="Country code")
    sources: List[str] = Field(default_factory=list, description="Data source identifiers")

    model_config = {"populate_by_name": True}


class NavNavaidSchema(BaseModel):
    """Navigation aid (VOR, NDB, DME, etc.) record."""

    identifier: str = Field(..., description="Navaid identifier")
    name: Optional[str] = Field(None, description="Full navaid name")
    type: NavaidType = Field(..., description="Type of navigation aid")
    position: GeoPointSchema = Field(..., description="Geographic coordinates")
    frequency: Optional[float] = Field(None, description="Frequency in MHz or kHz")
    frequency_unit: Optional[str] = Field(None, alias="frequencyUnit", description="Frequency unit (MHz or kHz)")
    sources: List[str] = Field(default_factory=list, description="Data source identifiers")

    model_config = {"populate_by_name": True}


class NavAirspaceSchema(BaseModel):
    """Airspace region record."""

    identifier: str = Field(..., description="Airspace identifier")
    name: Optional[str] = Field(None, description="Airspace name")
    airspace_class: AirspaceClass = Field(..., alias="class", description="Airspace classification")
    lower_limit_ft: Optional[float] = Field(None, alias="lowerLimitFt", description="Lower altitude limit in feet")
    upper_limit_ft: Optional[float] = Field(None, alias="upperLimitFt", description="Upper altitude limit in feet")
    boundary: List[GeoPointSchema] = Field(default_factory=list, description="Boundary polygon vertices")
    sources: List[str] = Field(default_factory=list, description="Data source identifiers")

    model_config = {"populate_by_name": True}


class NavProcedureSchema(BaseModel):
    """Instrument procedure (SID, STAR, or approach) record."""

    identifier: str = Field(..., description="Procedure identifier")
    airport_icao: Optional[str] = Field(None, alias="airportIcao", description="Associated airport ICAO code")
    type: ProcedureType = Field(..., description="Procedure type")
    name: Optional[str] = Field(None, description="Procedure name")
    transition: Optional[str] = Field(None, description="Transition name")
    fixes: Optional[List[str]] = Field(None, description="Ordered list of fix identifiers")
    legs: Optional[List[ProcedureLegSchema]] = Field(None, description="Detailed procedure legs")
    raw_records: Optional[List[str]] = Field(None, alias="rawRecords", description="Raw source data records")
    sources: List[str] = Field(default_factory=list, description="Data source identifiers")

    model_config = {"populate_by_name": True}


class NavDataStoreSchema(BaseModel):
    """Complete navigation data store mirroring NavDataStore from storage.ts."""

    airports_by_icao: Dict[str, NavAirportSchema] = Field(
        default_factory=dict, alias="airportsByIcao", description="Airports indexed by ICAO code"
    )
    navaids_by_ident: Dict[str, NavNavaidSchema] = Field(
        default_factory=dict, alias="navaidsByIdent", description="Navaids indexed by identifier"
    )
    airspaces: List[NavAirspaceSchema] = Field(default_factory=list, description="List of airspace regions")
    procedures_by_airport: Dict[str, List[NavProcedureSchema]] = Field(
        default_factory=dict, alias="proceduresByAirport", description="Procedures indexed by airport ICAO"
    )

    model_config = {"populate_by_name": True}


# Rebuild models to resolve forward references introduced by `from __future__ import annotations`
GeoPointSchema.model_rebuild()
ProcedureAltitudeConstraintSchema.model_rebuild()
ProcedureSpeedConstraintSchema.model_rebuild()
ProcedureLegSchema.model_rebuild()
NavAirportSchema.model_rebuild()
NavNavaidSchema.model_rebuild()
NavAirspaceSchema.model_rebuild()
NavProcedureSchema.model_rebuild()
NavDataStoreSchema.model_rebuild()
