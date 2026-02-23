import unittest
from ..app.services.alerts import AlertService

class TestAlertService(unittest.TestCase):
    def setUp(self):
        self.alert_service = AlertService(fuel_threshold=50.0, oil_threshold=20.0, electrical_threshold=30.0)

    def test_fuel_alert(self):
        alert = self.alert_service.check_fuel_level(40.0)
        self.assertIsNotNone(alert)
        self.assertEqual(alert.severity, "high")

    def test_oil_alert(self):
        alert = self.alert_service.check_oil_pressure(15.0)
        self.assertIsNotNone(alert)
        self.assertEqual(alert.severity, "medium")

    def test_electrical_alert(self):
        alert = self.alert_service.check_electrical_system(25.0)
        self.assertIsNotNone(alert)
        self.assertEqual(alert.severity, "low")

    def test_no_alerts(self):
        self.assertIsNone(self.alert_service.check_fuel_level(60.0))
        self.assertIsNone(self.alert_service.check_oil_pressure(25.0))
        self.assertIsNone(self.alert_service.check_electrical_system(35.0))

if __name__ == '__main__':
    unittest.main()
