"""Alert message stack manager service."""

from datetime import datetime
from typing import List, Optional, Dict
from enum import Enum
import uuid
import json
from pathlib import Path

from app.models.alert import Alert, AlertSeverity


class AlertManager:
    """Manages alert message stack with persistence."""
    
    def __init__(self, persistence_path: Optional[str] = None):
        """Initialize alert manager.
        
        Args:
            persistence_path: Optional path to persist alerts to disk
        """
        self.active_alerts: Dict[str, Alert] = {}
        self.cleared_alerts: List[Alert] = []
        self.persistence_path = persistence_path
        if persistence_path:
            self._load_alerts()
    
    def add_alert(
        self,
        message: str,
        severity: AlertSeverity = AlertSeverity.INFO,
        source: str = "unknown",
        metadata: Optional[dict] = None
    ) -> Alert:
        """Add a new alert to the stack.
        
        Args:
            message: Alert message text
            severity: Alert severity level
            source: Source of the alert
            metadata: Additional metadata
            
        Returns:
            The created Alert object
        """
        alert_id = str(uuid.uuid4())
        alert = Alert(
            id=alert_id,
            message=message,
            severity=severity,
            source=source,
            metadata=metadata or {}
        )
        self.active_alerts[alert_id] = alert
        self._persist()
        return alert
    
    def acknowledge_alert(self, alert_id: str) -> Optional[Alert]:
        """Acknowledge an active alert.
        
        Args:
            alert_id: ID of alert to acknowledge
            
        Returns:
            The acknowledged Alert object, or None if not found
        """
        if alert_id not in self.active_alerts:
            return None
        
        alert = self.active_alerts[alert_id]
        alert.acknowledge()
        self._persist()
        return alert
    
    def acknowledge_all_alerts(self) -> int:
        """Acknowledge all active alerts.
        
        Returns:
            Number of alerts acknowledged
        """
        count = 0
        for alert in self.active_alerts.values():
            if not alert.acknowledged:
                alert.acknowledge()
                count += 1
        self._persist()
        return count
    
    def clear_alert(self, alert_id: str) -> Optional[Alert]:
        """Clear an active alert.
        
        Args:
            alert_id: ID of alert to clear
            
        Returns:
            The cleared Alert object, or None if not found
        """
        if alert_id not in self.active_alerts:
            return None
        
        alert = self.active_alerts.pop(alert_id)
        alert.clear()
        self.cleared_alerts.append(alert)
        self._persist()
        return alert
    
    def get_active_alerts(self, severity_filter: Optional[AlertSeverity] = None) -> List[Alert]:
        """Get active alerts, optionally filtered by severity.
        
        Args:
            severity_filter: Optional severity level to filter by
            
        Returns:
            List of active alerts sorted by severity (critical first) then by timestamp
        """
        alerts = list(self.active_alerts.values())
        
        if severity_filter:
            alerts = [a for a in alerts if a.severity == severity_filter]
        
        # Sort by severity (critical > warning > info > debug) then by timestamp (newest first)
        severity_order = {
            AlertSeverity.CRITICAL: 0,
            AlertSeverity.WARNING: 1,
            AlertSeverity.INFO: 2,
            AlertSeverity.DEBUG: 3
        }
        
        alerts.sort(
            key=lambda a: (severity_order[a.severity], -a.timestamp.timestamp())
        )
        return alerts
    
    def get_unacknowledged_alerts(self, severity_filter: Optional[AlertSeverity] = None) -> List[Alert]:
        """Get unacknowledged active alerts, optionally filtered by severity.
        
        Args:
            severity_filter: Optional severity level to filter by
            
        Returns:
            List of unacknowledged active alerts sorted by severity then timestamp
        """
        alerts = [a for a in self.active_alerts.values() if not a.acknowledged]
        
        if severity_filter:
            alerts = [a for a in alerts if a.severity == severity_filter]
        
        # Sort by severity (critical > warning > info > debug) then by timestamp (newest first)
        severity_order = {
            AlertSeverity.CRITICAL: 0,
            AlertSeverity.WARNING: 1,
            AlertSeverity.INFO: 2,
            AlertSeverity.DEBUG: 3
        }
        
        alerts.sort(
            key=lambda a: (severity_order[a.severity], -a.timestamp.timestamp())
        )
        return alerts
    
    def get_cleared_alerts(self, limit: Optional[int] = None) -> List[Alert]:
        """Get cleared alerts.
        
        Args:
            limit: Optional limit on number of alerts to return
            
        Returns:
            List of cleared alerts sorted by cleared time (newest first)
        """
        alerts = sorted(
            self.cleared_alerts,
            key=lambda a: a.cleared_at.timestamp() if a.cleared_at else 0,
            reverse=True
        )
        return alerts[:limit] if limit else alerts
    
    def get_alert(self, alert_id: str) -> Optional[Alert]:
        """Get a specific alert by ID.
        
        Args:
            alert_id: ID of alert to retrieve
            
        Returns:
            The Alert object, or None if not found
        """
        return self.active_alerts.get(alert_id)
    
    def clear_all_alerts(self) -> int:
        """Clear all active alerts.
        
        Returns:
            Number of alerts cleared
        """
        count = len(self.active_alerts)
        for alert in list(self.active_alerts.values()):
            self.clear_alert(alert.id)
        return count
    
    def get_alert_count(self, severity_filter: Optional[AlertSeverity] = None) -> int:
        """Get count of active alerts.
        
        Args:
            severity_filter: Optional severity level to filter by
            
        Returns:
            Count of active alerts
        """
        return len(self.get_active_alerts(severity_filter))
    
    def get_unacknowledged_count(self, severity_filter: Optional[AlertSeverity] = None) -> int:
        """Get count of unacknowledged active alerts.
        
        Args:
            severity_filter: Optional severity level to filter by
            
        Returns:
            Count of unacknowledged active alerts
        """
        return len(self.get_unacknowledged_alerts(severity_filter))
    
    def _persist(self) -> None:
        """Persist alerts to disk if persistence path is configured."""
        if not self.persistence_path:
            return
        
        try:
            path = Path(self.persistence_path)
            path.parent.mkdir(parents=True, exist_ok=True)
            
            data = {
                "active_alerts": [
                    json.loads(alert.model_dump_json())
                    for alert in self.active_alerts.values()
                ],
                "cleared_alerts": [
                    json.loads(alert.model_dump_json())
                    for alert in self.cleared_alerts
                ]
            }
            
            with open(path, 'w') as f:
                json.dump(data, f, indent=2, default=str)
        except Exception as e:
            print(f"Failed to persist alerts: {e}")
    
    def _load_alerts(self) -> None:
        """Load alerts from disk if persistence path is configured."""
        if not self.persistence_path:
            return
        
        try:
            path = Path(self.persistence_path)
            if not path.exists():
                return
            
            with open(path, 'r') as f:
                data = json.load(f)
            
            # Load active alerts
            for alert_data in data.get("active_alerts", []):
                alert = Alert(**alert_data)
                self.active_alerts[alert.id] = alert
            
            # Load cleared alerts
            for alert_data in data.get("cleared_alerts", []):
                alert = Alert(**alert_data)
                self.cleared_alerts.append(alert)
        except Exception as e:
            print(f"Failed to load alerts: {e}")
