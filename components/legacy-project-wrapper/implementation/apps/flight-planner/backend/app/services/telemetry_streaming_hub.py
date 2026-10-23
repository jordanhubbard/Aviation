from fastapi import WebSocket
from enum import Enum
from typing import Any, Dict, List

class SubscriptionFilter(str, Enum):
    PFD = "pfd"
    MFD = "mfd"

class TelemetryStreamingHub:
    def __init__(self):
        self.clients: List[WebSocket] = []

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.clients.append(websocket)

    async def disconnect(self, websocket: WebSocket):
        await websocket.close()
        self.remove(websocket)

    def remove(self, websocket: WebSocket) -> None:
        """Drop a client without closing it, for sockets the peer already closed."""
        if websocket in self.clients:
            self.clients.remove(websocket)

    async def broadcast(self, message_type: str, data: Dict[str, Any], filter: SubscriptionFilter = None):
        message = {
            "type": message_type,
            "data": data
        }
        for client in list(self.clients):
            # Subscriptions are optional; a plain WebSocket has no such attribute.
            subscriptions = getattr(client, "subscriptions", None)
            if filter is None or (subscriptions and filter in subscriptions):
                await client.send_json(message)

    async def handle_backpressure(self, websocket: WebSocket):
        # Implement backpressure handling logic here
        pass
