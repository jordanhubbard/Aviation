import unittest
from app.services.hardware_integration import HardwareIntegrationService, HardwareType


class TestHardwareIntegration(unittest.TestCase):
    def setUp(self):
        self.hardware_service = HardwareIntegrationService()

    def test_connect_saitek_yoke(self):
        """Test connecting Saitek yoke hardware"""
        self.hardware_service.connect_hardware(HardwareType.SAITEK_YOKE)
        self.assertTrue(self.hardware_service.hardware_status[HardwareType.SAITEK_YOKE])

    def test_connect_logitech_yoke(self):
        """Test connecting Logitech yoke hardware"""
        self.hardware_service.connect_hardware(HardwareType.LOGITECH_YOKE)
        self.assertTrue(self.hardware_service.hardware_status[HardwareType.LOGITECH_YOKE])

    def test_connect_vr_headset(self):
        """Test connecting VR headset hardware"""
        self.hardware_service.connect_hardware(HardwareType.VR_HEADSET)
        self.assertTrue(self.hardware_service.hardware_status[HardwareType.VR_HEADSET])

    def test_connect_button_box(self):
        """Test connecting button box hardware"""
        self.hardware_service.connect_hardware(HardwareType.BUTTON_BOX)
        self.assertTrue(self.hardware_service.hardware_status[HardwareType.BUTTON_BOX])

    def test_disconnect_hardware(self):
        """Test disconnecting hardware"""
        self.hardware_service.connect_hardware(HardwareType.SAITEK_YOKE)
        self.assertTrue(self.hardware_service.hardware_status[HardwareType.SAITEK_YOKE])
        self.hardware_service.disconnect_hardware(HardwareType.SAITEK_YOKE)
        self.assertFalse(self.hardware_service.hardware_status[HardwareType.SAITEK_YOKE])

    def test_get_hardware_status(self):
        """Test getting hardware status"""
        status = self.hardware_service.get_hardware_status()
        self.assertIsInstance(status, dict)
        self.assertIn(HardwareType.SAITEK_YOKE, status)
        self.assertIn(HardwareType.VR_HEADSET, status)

    def test_send_command_to_connected_hardware(self):
        """Test sending command to connected hardware"""
        self.hardware_service.connect_hardware(HardwareType.BUTTON_BOX)
        command = {"action": "press", "button": 1}
        # Should not raise an exception
        self.hardware_service.send_command_to_hardware(HardwareType.BUTTON_BOX, command)

    def test_send_command_to_disconnected_hardware(self):
        """Test sending command to disconnected hardware"""
        command = {"action": "press", "button": 1}
        # Should not raise an exception, but should handle gracefully
        self.hardware_service.send_command_to_hardware(HardwareType.BUTTON_BOX, command)


if __name__ == '__main__':
    unittest.main()
