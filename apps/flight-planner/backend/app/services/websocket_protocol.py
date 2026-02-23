from fastapi import WebSocket
from enum import Enum
from typing import Any, Dict

class MessageType(str, Enum):
    FLIGHT_STATE_UPDATE = "flight_state_update"
    DISPLAY_UPDATE = "display_update"
    NAVIGATION_UPDATE = "navigation_update"
    SYSTEM_STATUS = "system_status"
    ALERT_COMMAND = "alert_command"

from .hardware_integration import HardwareIntegrationService, HardwareType

class WebSocketProtocol:
    def __init__(self, websocket: WebSocket, hardware_integration_service: HardwareIntegrationService):
        self.websocket = websocket
        self.hardware_integration_service = hardware_integration_service
    def __init__(self, websocket: WebSocket):
        self.websocket = websocket

    async def connect(self):
        await self.websocket.accept()

    async def disconnect(self):
        await self.websocket.close()

    async def send_message(self, message_type: MessageType, data: Dict[str, Any], binary: bool = False):
        message = {
            "type": message_type,
            "data": data
        }
        await self.websocket.send_json(message)

    async def receive_message(self) -> Dict[str, Any]:
        return await self.websocket.receive_json()
