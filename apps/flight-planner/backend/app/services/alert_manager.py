# Alert Manager for handling alert messages

from typing import List, Dict
from datetime import datetime

class Alert:
    def __init__(self, message: str, severity: str, timestamp: datetime = None):
        self.message = message
        self.severity = severity
        self.timestamp = timestamp or datetime.now()

    def get_priority(self) -> int:
        priority_map = {'Master Warning': 3, 'Master Caution': 2, 'Advisory': 1}
        return priority_map.get(self.severity, 0)

class AlertManager:
    def __init__(self):
        self.active_alerts: List[Alert] = []
        self.cleared_alerts: List[Alert] = []

    def add_alert(self, message: str, severity: str):
        alert = Alert(message, severity)
        self.active_alerts.append(alert)
        self.active_alerts.sort(key=lambda x: (x.severity, x.timestamp), reverse=True)

    def clear_alert(self, alert: Alert):
        if alert in self.active_alerts:
            self.active_alerts.remove(alert)
            self.cleared_alerts.append(alert)

    def get_active_alerts(self) -> List[Dict]:
        return [{'message': alert.message, 'severity': alert.severity, 'timestamp': alert.timestamp} for alert in self.active_alerts]

    def get_cleared_alerts(self) -> List[Dict]:
        return [{'message': alert.message, 'severity': alert.severity, 'timestamp': alert.timestamp} for alert in self.cleared_alerts]

    def persist_alerts(self):
        # Placeholder for persistence logic
        pass
