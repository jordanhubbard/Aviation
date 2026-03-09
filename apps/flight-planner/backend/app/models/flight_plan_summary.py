from pydantic import BaseModel, Field
from typing import Optional

class FlightPlanSummary(BaseModel):
    id: int
    name: str
    origin: Optional[str] = None
    destination: Optional[str] = None
    created_at: str
    updated_at: str
    distance_nm: Optional[float] = None
    waypoint_count: int
