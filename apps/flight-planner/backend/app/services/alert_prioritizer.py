from typing import List, Dict, Optional
from datetime import datetime, timedelta
from enum import Enum

class AlertSeverity(Enum):
    HIGH = 3
    MEDIUM = 2
    LOW = 1

class AlertCategory(Enum):
    ENGINE = "engine"
    SYSTEM = "system"
    WEATHER = "weather"
    NAVIGATION = "navigation"
    PERFORMANCE = "performance"
    INFORMATIONAL = "informational"

class AlertPrioritizer:
    MAX_DISPLAYED_ALERTS = 5
    ESCALATION_THRESHOLD = timedelta(minutes=5)
    ALERT_DEDUP_WINDOW = timedelta(seconds=2)
    SEVERITY_WEIGHTS = {AlertSeverity.HIGH: 100, AlertSeverity.MEDIUM: 50, AlertSeverity.LOW: 10}

    def __init__(self):
        self.active_alerts: List[Dict] = []
        self.cleared_alerts: List[Dict] = []
        self.alert_history: List[Dict] = []
        self._alert_counter = 0

    def add_alert(self, message: str, severity: AlertSeverity, category: AlertCategory, timestamp: Optional[datetime] = None, metadata: Optional[Dict] = None) -> Dict:
        timestamp = timestamp or datetime.now()
        alert = {'id': self._generate_alert_id(), 'message': message, 'severity': severity.name, 'severity_value': severity.value, 'category': category.value, 'timestamp': timestamp, 'created_at': timestamp, 'escalated': False, 'escalated_at': None, 'metadata': metadata or {}}
        if not self._is_duplicate(alert):
            self.active_alerts.append(alert)
            self.alert_history.append(alert.copy())
            self._sort_alerts()
        return alert

    def clear_alert(self, alert_id: str) -> Optional[Dict]:
        for i, alert in enumerate(self.active_alerts):
            if alert['id'] == alert_id:
                cleared_alert = self.active_alerts.pop(i)
                cleared_alert['cleared_at'] = datetime.now()
                self.cleared_alerts.append(cleared_alert)
                return cleared_alert
        return None

    def get_displayed_alerts(self, limit: Optional[int] = None) -> List[Dict]:
        limit = limit or self.MAX_DISPLAYED_ALERTS
        displayed = self.active_alerts[:limit]
        return [{'id': alert['id'], 'message': alert['message'], 'severity': alert['severity'], 'category': alert['category'], 'timestamp': alert['timestamp'].isoformat(), 'escalated': alert['escalated'], 'priority_score': self._calculate_priority_score(alert)} for alert in displayed]

    def check_escalations(self) -> List[Dict]:
        now = datetime.now()
        escalated = []
        for alert in self.active_alerts:
            if not alert['escalated']:
                age = now - alert['timestamp']
                if age > self.ESCALATION_THRESHOLD:
                    alert['escalated'] = True
                    alert['escalated_at'] = now
                    escalated.append(alert)
        if escalated:
            self._sort_alerts()
        return escalated

    def get_alerts_by_category(self, category: AlertCategory) -> List[Dict]:
        return [alert for alert in self.active_alerts if alert['category'] == category.value]

    def get_alerts_by_severity(self, severity: AlertSeverity) -> List[Dict]:
        return [alert for alert in self.active_alerts if alert['severity_value'] == severity.value]

    def clear_all_alerts(self) -> int:
        count = len(self.active_alerts)
        now = datetime.now()
        for alert in self.active_alerts:
            alert['cleared_at'] = now
            self.cleared_alerts.append(alert)
        self.active_alerts.clear()
        return count

    def get_alert_statistics(self) -> Dict:
        active_by_severity = {}
        for severity in AlertSeverity:
            count = len(self.get_alerts_by_severity(severity))
            if count > 0:
                active_by_severity[severity.name] = count
        active_by_category = {}
        for category in AlertCategory:
            count = len(self.get_alerts_by_category(category))
            if count > 0:
                active_by_category[category.value] = count
        return {'total_active': len(self.active_alerts), 'total_cleared': len(self.cleared_alerts), 'by_severity': active_by_severity, 'by_category': active_by_category}

    def _generate_alert_id(self) -> str:
        self._alert_counter += 1
        return f"alert_{self._alert_counter}_{int(datetime.now().timestamp() * 1000)}"

    def _is_duplicate(self, alert: Dict) -> bool:
        now = datetime.now()
        for existing in self.active_alerts:
            if (existing['message'] == alert['message'] and existing['category'] == alert['category'] and (now - existing['timestamp']) < self.ALERT_DEDUP_WINDOW):
                return True
        return False

    def _sort_alerts(self):
        self.active_alerts.sort(key=lambda x: (-int(x['escalated']), -x['severity_value'], x['timestamp']))

    def _calculate_priority_score(self, alert: Dict) -> int:
        base_score = self.SEVERITY_WEIGHTS.get(AlertSeverity(alert['severity_value']), 0)
        escalation_bonus = 1000 if alert['escalated'] else 0
        return base_score + escalation_bonus
