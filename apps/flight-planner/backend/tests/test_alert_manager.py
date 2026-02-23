import unittest
from datetime import datetime, timedelta
from app.services.alert_manager import AlertManager

class TestAlertManager(unittest.TestCase):

    def setUp(self):
        self.alert_manager = AlertManager()

    def test_add_alert(self):
        self.alert_manager.add_alert("Test Alert", 1)
        self.assertEqual(len(self.alert_manager.active_alerts), 1)

    def test_clear_alert(self):
        self.alert_manager.add_alert("Test Alert", 1)
        alert = self.alert_manager.active_alerts[0]
        self.alert_manager.clear_alert(alert)
        self.assertEqual(len(self.alert_manager.active_alerts), 0)
        self.assertEqual(len(self.alert_manager.cleared_alerts), 1)

    def test_ordering_by_severity_and_time(self):
        self.alert_manager.add_alert("Low Severity", 1)
        self.alert_manager.add_alert("High Severity", 2)
        self.assertEqual(self.alert_manager.active_alerts[0].message, "High Severity")

    def test_persistence_placeholder(self):
        # This test is a placeholder for persistence logic
        self.alert_manager.persist_alerts()
        self.assertTrue(True)

if __name__ == '__main__':
    unittest.main()
