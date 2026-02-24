"""Procedure schemas for API responses."""
from __future__ import annotations

from enum import Enum
from typing import Optional

from pydantic import BaseModel


class ProcedureType(str, Enum):
    """Type of instrument procedure."""
    SID = "SID"
    STAR = "STAR"
    APPROACH = "APPROACH"
    OTHER = "OTHER"


class AltitudeConstraintType(str, Enum):
    """Type of altitude constraint."""
    AT = "AT"
    AT_OR_ABOVE = "AT_OR_ABOVE"
    AT_OR_BELOW = "AT_OR_BELOW"


class SpeedConstraintType(str, Enum):
    """Type of speed constraint."""
    AT = "AT"
    AT_OR_BELOW = "AT_OR_BELOW"


class AltitudeConstraint(BaseModel):
    """Altitude constraint for a procedure leg."""
    type: AltitudeConstraintType
    altitude_ft: int


class SpeedConstraint(BaseModel):
    """Speed constraint for a procedure leg."""
    type: SpeedConstraintType
    speed_kts: int


class ProcedureLeg(BaseModel):
    """A single leg/fix in a procedure."""
    fix: str
    path_type: Optional[str] = None
    altitude_constraint: Optional[AltitudeConstraint] = None
    speed_constraint: Optional[SpeedConstraint] = None


class Procedure(BaseModel):
    """An instrument procedure (SID, STAR, or Approach)."""
    identifier: str
    airport_icao: str
    type: ProcedureType
    name: Optional[str] = None
    transition: Optional[str] = None
    fixes: Optional[list[str]] = None
    legs: Optional[list[ProcedureLeg]] = None


class ProcedureListResponse(BaseModel):
    """Response for procedure list endpoint."""
    procedures: list[Procedure]
    total: int
    airport_icao: str
