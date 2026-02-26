"""Alert API routes."""

from fastapi import APIRouter, HTTPException, Query
from typing import List, Optional

from app.models.alert import Alert, AlertSeverity
from app.services.alert_manager import AlertManager

router = APIRouter(prefix="/api/alerts", tags=["alerts"])

# Global alert manager instance
alert_manager = AlertManager()


@router.post("/", response_model=Alert)
def create_alert(
    message: str,
    severity: AlertSeverity = AlertSeverity.INFO,
    source: str = "unknown",
    metadata: Optional[dict] = None
):
    """Create a new alert."""
    return alert_manager.add_alert(
        message=message,
        severity=severity,
        source=source,
        metadata=metadata
    )


@router.get("/active", response_model=List[Alert])
def get_active_alerts(severity: Optional[AlertSeverity] = Query(None)):
    """Get active alerts, optionally filtered by severity."""
    return alert_manager.get_active_alerts(severity_filter=severity)


@router.get("/cleared", response_model=List[Alert])
def get_cleared_alerts(limit: Optional[int] = Query(None)):
    """Get cleared alerts."""
    return alert_manager.get_cleared_alerts(limit=limit)


@router.get("/{alert_id}", response_model=Alert)
def get_alert(alert_id: str):
    """Get a specific alert by ID."""
    alert = alert_manager.get_alert(alert_id)
    if not alert:
        raise HTTPException(status_code=404, detail="Alert not found")
    return alert


@router.post("/{alert_id}/clear", response_model=Alert)
def clear_alert(alert_id: str):
    """Clear an active alert."""
    alert = alert_manager.clear_alert(alert_id)
    if not alert:
        raise HTTPException(status_code=404, detail="Alert not found")
    return alert


@router.post("/clear-all")
def clear_all_alerts():
    """Clear all active alerts."""
    count = alert_manager.clear_all_alerts()
    return {"cleared_count": count}


@router.get("/count")
def get_alert_count(severity: Optional[AlertSeverity] = Query(None)):
    """Get count of active alerts."""
    count = alert_manager.get_alert_count(severity_filter=severity)
    return {"count": count}
