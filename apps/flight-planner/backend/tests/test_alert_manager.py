"""Tests for alert manager."""

import pytest
from datetime import datetime
from app.models.alert import Alert, AlertSeverity
from app.services.alert_manager import AlertManager


class TestAlertManager:
    """Test suite for AlertManager."""
    
    def setup_method(self):
        """Set up test fixtures."""
        self.manager = AlertManager()
    
    def test_add_alert(self):
        """Test adding an alert."""
        alert = self.manager.add_alert(
            message="Test alert",
            severity=AlertSeverity.WARNING,
            source="test_service"
        )
        
        assert alert.message == "Test alert"
        assert alert.severity == AlertSeverity.WARNING
        assert alert.source == "test_service"
        assert alert.cleared is False
        assert alert.id in self.manager.active_alerts
    
    def test_clear_alert(self):
        """Test clearing an alert."""
        alert = self.manager.add_alert(
            message="Test alert",
            severity=AlertSeverity.INFO,
            source="test_service"
        )
        alert_id = alert.id
        
        cleared_alert = self.manager.clear_alert(alert_id)
        
        assert cleared_alert is not None
        assert cleared_alert.cleared is True
        assert cleared_alert.cleared_at is not None
        assert alert_id not in self.manager.active_alerts
        assert cleared_alert in self.manager.cleared_alerts
    
    def test_get_active_alerts(self):
        """Test getting active alerts."""
        self.manager.add_alert("Critical alert", AlertSeverity.CRITICAL, "service1")
        self.manager.add_alert("Warning alert", AlertSeverity.WARNING, "service2")
        self.manager.add_alert("Info alert", AlertSeverity.INFO, "service3")
        
        alerts = self.manager.get_active_alerts()
        
        assert len(alerts) == 3
        # Should be sorted by severity (critical first)
        assert alerts[0].severity == AlertSeverity.CRITICAL
        assert alerts[1].severity == AlertSeverity.WARNING
        assert alerts[2].severity == AlertSeverity.INFO
    
    def test_get_active_alerts_filtered(self):
        """Test getting active alerts filtered by severity."""
        self.manager.add_alert("Critical alert", AlertSeverity.CRITICAL, "service1")
        self.manager.add_alert("Warning alert", AlertSeverity.WARNING, "service2")
        self.manager.add_alert("Info alert", AlertSeverity.INFO, "service3")
        
        alerts = self.manager.get_active_alerts(severity_filter=AlertSeverity.WARNING)
        
        assert len(alerts) == 1
        assert alerts[0].severity == AlertSeverity.WARNING
    
    def test_get_cleared_alerts(self):
        """Test getting cleared alerts."""
        alert1 = self.manager.add_alert("Alert 1", AlertSeverity.INFO, "service1")
        alert2 = self.manager.add_alert("Alert 2", AlertSeverity.WARNING, "service2")
        
        self.manager.clear_alert(alert1.id)
        self.manager.clear_alert(alert2.id)
        
        cleared = self.manager.get_cleared_alerts()
        
        assert len(cleared) == 2
    
    def test_get_alert(self):
        """Test getting a specific alert."""
        alert = self.manager.add_alert("Test alert", AlertSeverity.INFO, "service1")
        
        retrieved = self.manager.get_alert(alert.id)
        
        assert retrieved is not None
        assert retrieved.id == alert.id
        assert retrieved.message == "Test alert"
    
    def test_get_alert_not_found(self):
        """Test getting a non-existent alert."""
        retrieved = self.manager.get_alert("nonexistent")
        
        assert retrieved is None
    
    def test_clear_all_alerts(self):
        """Test clearing all alerts."""
        self.manager.add_alert("Alert 1", AlertSeverity.INFO, "service1")
        self.manager.add_alert("Alert 2", AlertSeverity.WARNING, "service2")
        self.manager.add_alert("Alert 3", AlertSeverity.CRITICAL, "service3")
        
        count = self.manager.clear_all_alerts()
        
        assert count == 3
        assert len(self.manager.active_alerts) == 0
        assert len(self.manager.cleared_alerts) == 3
    
    def test_get_alert_count(self):
        """Test getting alert count."""
        self.manager.add_alert("Alert 1", AlertSeverity.INFO, "service1")
        self.manager.add_alert("Alert 2", AlertSeverity.WARNING, "service2")
        self.manager.add_alert("Alert 3", AlertSeverity.CRITICAL, "service3")
        
        count = self.manager.get_alert_count()
        
        assert count == 3
    
    def test_get_alert_count_filtered(self):
        """Test getting alert count filtered by severity."""
        self.manager.add_alert("Alert 1", AlertSeverity.INFO, "service1")
        self.manager.add_alert("Alert 2", AlertSeverity.WARNING, "service2")
        self.manager.add_alert("Alert 3", AlertSeverity.CRITICAL, "service3")
        
        count = self.manager.get_alert_count(severity_filter=AlertSeverity.WARNING)
        
        assert count == 1
    
    def test_alert_metadata(self):
        """Test alert with metadata."""
        metadata = {"flight_id": "fp_123", "user_id": "user_456"}
        alert = self.manager.add_alert(
            message="Test alert",
            severity=AlertSeverity.WARNING,
            source="service1",
            metadata=metadata
        )
        
        assert alert.metadata == metadata
    
    def test_alert_timestamp(self):
        """Test that alert has a timestamp."""
        alert = self.manager.add_alert(
            message="Test alert",
            severity=AlertSeverity.INFO,
            source="service1"
        )
        
        assert alert.timestamp is not None
        assert isinstance(alert.timestamp, datetime)
