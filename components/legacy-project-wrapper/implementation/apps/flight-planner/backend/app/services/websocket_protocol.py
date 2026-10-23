import json
from fastapi import WebSocket
from enum import Enum
from typing import Any, Dict


class MessageType(str, Enum):
    """WebSocket message types for flight data communication."""
    FLIGHT_STATE_UPDATE = "flight_state_update"
    DISPLAY_UPDATE = "display_update"
    NAVIGATION_UPDATE = "navigation_update"
    SYSTEM_STATUS = "system_status"
    ALERT_COMMAND = "alert_command"


class WebSocketProtocol:
    """WebSocket protocol handler for flight data streaming.
    
    Supports both JSON and binary message formats for performance optimization.
    """
    
    def __init__(self, websocket: WebSocket):
        self.websocket = websocket

    async def connect(self):
        """Accept the WebSocket connection."""
        await self.websocket.accept()

    async def disconnect(self):
        """Close the WebSocket connection."""
        await self.websocket.close()

    async def send_message(self, message_type: MessageType, data: Dict[str, Any], binary: bool = False):
        """Send a message through the WebSocket.
        
        Args:
            message_type: The type of message being sent
            data: The message payload
            binary: If True, send as binary data for better performance
        """
        message = {
            "type": message_type.value,
            "data": data
        }
        if binary:
            await self.websocket.send_bytes(json.dumps(message).encode('utf-8'))
        else:
            await self.websocket.send_json(message)

    async def receive_message(self) -> Dict[str, Any]:
        """Receive a message from the WebSocket.
        
        Returns:
            The parsed message as a dictionary
        """
        return await self.websocket.receive_json()

    async def receive_binary_message(self) -> Dict[str, Any]:
        """Receive a binary message from the WebSocket.
        
        Returns:
            The parsed message as a dictionary
        """
        data = await self.websocket.receive_bytes()
        return json.loads(data.decode('utf-8'))
