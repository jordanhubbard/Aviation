# Hardware integration service for flight planner

from enum import Enum
from typing import Dict, Any

class HardwareType(str, Enum):
    HOTAS = "hotas"
    RUDDER_PEDALS = "rudder_pedals"
    MULTI_MONITOR = "multi_monitor"
    TOUCH_SCREEN = "touch_screen"
    SOFTKEY_PANEL = "softkey_panel"
    SAITEK_YOKE = "saitek_yoke"
    LOGITECH_YOKE = "logitech_yoke"
    SAITEK_THROTTLE = "saitek_throttle"
    LOGITECH_THROTTLE = "logitech_throttle"
    VR_HEADSET = "vr_headset"
    BUTTON_BOX = "button_box"
    MULTI_FUNCTION_PANEL = "multi_function_panel"

class HardwareIntegrationService:
    def __init__(self):
        self.hardware_status = {
            HardwareType.HOTAS: False,
            HardwareType.RUDDER_PEDALS: False,
            HardwareType.MULTI_MONITOR: False,
            HardwareType.TOUCH_SCREEN: False,
            HardwareType.SOFTKEY_PANEL: False,
            HardwareType.SAITEK_YOKE: False,
            HardwareType.LOGITECH_YOKE: False,
            HardwareType.SAITEK_THROTTLE: False,
            HardwareType.LOGITECH_THROTTLE: False,
            HardwareType.VR_HEADSET: False,
            HardwareType.BUTTON_BOX: False,
            HardwareType.MULTI_FUNCTION_PANEL: False,
        }

    def connect_hardware(self, hardware_type: HardwareType):
        # Simulate hardware connection
        self.hardware_status[hardware_type] = True
        print(f"Connected to {hardware_type}")

    def disconnect_hardware(self, hardware_type: HardwareType):
        # Simulate hardware disconnection
        self.hardware_status[hardware_type] = False
        print(f"Disconnected from {hardware_type}")

    def get_hardware_status(self) -> Dict[HardwareType, bool]:
        return self.hardware_status

    def send_command_to_hardware(self, hardware_type: HardwareType, command: Dict[str, Any]):
        # Simulate sending a command to the hardware
        if self.hardware_status[hardware_type]:
            print(f"Sending command to {hardware_type}: {command}")
        else:
            print(f"Cannot send command, {hardware_type} is not connected")
