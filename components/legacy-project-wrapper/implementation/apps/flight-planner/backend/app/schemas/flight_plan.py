"""Flight plan schemas for storage and import/export."""
from __future__ import annotations

from datetime import datetime
from typing import List, Literal, Optional, Tuple
from uuid import uuid4

from pydantic import BaseModel, Field


class FlightPlanWaypoint(BaseModel):
    """A waypoint in a flight plan."""
    name: str
    latitude: float
    longitude: float
    altitude_ft: Optional[float] = None
    type: Literal["airport", "navaid", "fix", "user"] = "user"
    sequence: int = 0


class FlightPlanMetadata(BaseModel):
    """Metadata for a saved flight plan."""
    id: str = Field(default_factory=lambda: str(uuid4()))
    name: str
    description: Optional[str] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)
    origin: Optional[str] = None
    destination: Optional[str] = None
    aircraft_type: Optional[str] = None
    pilot_name: Optional[str] = None


class SavedFlightPlan(BaseModel):
    """A complete saved flight plan."""
    metadata: FlightPlanMetadata
    waypoints: List[FlightPlanWaypoint] = []
    route: List[str] = []
    distance_nm: Optional[float] = None
    estimated_time_hr: Optional[float] = None
    cruise_altitude_ft: Optional[int] = None
    cruise_speed_kt: Optional[float] = None
    fuel_required_gal: Optional[float] = None
    notes: Optional[str] = None


class FlightPlanSummary(BaseModel):
    """Summary of a flight plan for listing."""
    id: str
    name: str
    origin: Optional[str] = None
    destination: Optional[str] = None
    created_at: datetime
    updated_at: datetime
    distance_nm: Optional[float] = None
    waypoint_count: int = 0


class CreateFlightPlanRequest(BaseModel):
    """Request to create a new flight plan."""
    name: str
    description: Optional[str] = None
    origin: Optional[str] = None
    destination: Optional[str] = None
    waypoints: List[FlightPlanWaypoint] = []
    route: List[str] = []
    distance_nm: Optional[float] = None
    estimated_time_hr: Optional[float] = None
    cruise_altitude_ft: Optional[int] = None
    cruise_speed_kt: Optional[float] = None
    fuel_required_gal: Optional[float] = None
    aircraft_type: Optional[str] = None
    pilot_name: Optional[str] = None
    notes: Optional[str] = None


class UpdateFlightPlanRequest(BaseModel):
    """Request to update an existing flight plan."""
    name: Optional[str] = None
    description: Optional[str] = None
    origin: Optional[str] = None
    destination: Optional[str] = None
    waypoints: Optional[List[FlightPlanWaypoint]] = None
    route: Optional[List[str]] = None
    distance_nm: Optional[float] = None
    estimated_time_hr: Optional[float] = None
    cruise_altitude_ft: Optional[int] = None
    cruise_speed_kt: Optional[float] = None
    fuel_required_gal: Optional[float] = None
    aircraft_type: Optional[str] = None
    pilot_name: Optional[str] = None
    notes: Optional[str] = None


class ImportFlightPlanRequest(BaseModel):
    """Request to import a flight plan from file content."""
    format: Literal["gpx", "fpl"]
    content: str
    name: Optional[str] = None


class ExportFlightPlanResponse(BaseModel):
    """Response containing exported flight plan data."""
    format: Literal["gpx", "fpl"]
    content: str
    filename: str
