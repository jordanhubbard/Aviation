import unittest
from datetime import datetime, timedelta
from app.services.alert_manager import AlertManager

class TestAlertManager(unittest.TestCase):

    def setUp(self):
        self.alert_manager = AlertManager()

    def test_add_alert(self):
        self.alert_manager.add_alert("Test Alert", "Advisory")
        self.assertEqual(len(self.alert_manager.active_alerts), 1)

    def test_clear_alert(self):
        self.alert_manager.add_alert("Test Alert", "Advisory")
        alert = self.alert_manager.active_alerts[0]
        self.alert_manager.clear_alert(alert)
        self.assertEqual(len(self.alert_manager.active_alerts), 0)
        self.assertEqual(len(self.alert_manager.cleared_alerts), 1)

    def test_ordering_by_severity_and_time(self):
        self.alert_manager.add_alert("Low Severity", "Advisory")
        self.alert_manager.add_alert("High Severity", "Master Warning")
        self.assertEqual(self.alert_manager.active_alerts[0].message, "High Severity")

    def test_ordering_master_caution_vs_advisory(self):
        self.alert_manager.add_alert("Advisory Alert", "Advisory")
        self.alert_manager.add_alert("Caution Alert", "Master Caution")
        self.assertEqual(self.alert_manager.active_alerts[0].message, "Caution Alert")

    def test_get_active_alerts(self):
        self.alert_manager.add_alert("Test Alert", "Master Warning")
        alerts = self.alert_manager.get_active_alerts()
        self.assertEqual(len(alerts), 1)
        self.assertEqual(alerts[0]['message'], "Test Alert")
        self.assertEqual(alerts[0]['severity'], "Master Warning")

    def test_get_cleared_alerts(self):
        self.alert_manager.add_alert("Test Alert", "Advisory")
        alert = self.alert_manager.active_alerts[0]
        self.alert_manager.clear_alert(alert)
        cleared = self.alert_manager.get_cleared_alerts()
        self.assertEqual(len(cleared), 1)
        self.assertEqual(cleared[0]['message'], "Test Alert")

    def test_persistence_placeholder(self):
        # This test is a placeholder for persistence logic
        self.alert_manager.persist_alerts()
        self.assertTrue(True)

if __name__ == '__main__':
    unittest.main()
