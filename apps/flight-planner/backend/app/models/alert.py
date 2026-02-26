"""Alert message model for flight planning system."""

from datetime import datetime
from enum import Enum
from typing import Optional
from pydantic import BaseModel, Field


class AlertSeverity(str, Enum):
    """Alert severity levels."""
    CRITICAL = "critical"
    WARNING = "warning"
    INFO = "info"
    DEBUG = "debug"


class Alert(BaseModel):
    """Alert message model."""
    
    id: str = Field(..., description="Unique alert identifier")
    message: str = Field(..., description="Alert message text")
    severity: AlertSeverity = Field(default=AlertSeverity.INFO, description="Alert severity level")
    timestamp: datetime = Field(default_factory=datetime.utcnow, description="When alert was created")
    source: str = Field(..., description="Source of the alert (e.g., 'flight_plan_service')")
    cleared: bool = Field(default=False, description="Whether alert has been cleared")
    cleared_at: Optional[datetime] = Field(default=None, description="When alert was cleared")
    metadata: dict = Field(default_factory=dict, description="Additional alert metadata")
    
    class Config:
        """Pydantic config."""
        use_enum_values = False
        json_schema_extra = {
            "example": {
                "id": "alert_001",
                "message": "Flight plan exceeds fuel capacity",
                "severity": "warning",
                "timestamp": "2024-01-15T10:30:00Z",
                "source": "flight_plan_service",
                "cleared": False,
                "cleared_at": None,
                "metadata": {"flight_id": "fp_123"}
            }
        }
    
    def clear(self) -> None:
        """Mark alert as cleared."""
        self.cleared = True
        self.cleared_at = datetime.utcnow()
