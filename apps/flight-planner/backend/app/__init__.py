# Initialize the backend application
from fastapi import FastAPI
from .services.flight_plan_service import router as flight_plan_router
from .services.alert_manager import AlertManager
from .services.websocket_protocol import WebSocketProtocol, MessageType
from .services.flight_recording_service import router as flight_recording_router
from .services.envelope_protection import EnvelopeProtection
from .services.ahrs_adc_simulation import AHRS, ADC
from .services.gps_simulation import GPSSimulationService, GPSState

app = FastAPI()
app.include_router(flight_plan_router, prefix="/flight-plans", tags=["flight-plans"])
app.include_router(flight_recording_router, prefix="/flight-recordings", tags=["flight-recordings"])

# Initialize AlertManager
alert_manager = AlertManager()

# Example WebSocket endpoint
@app.websocket("/ws")
from fastapi import WebSocket

async def websocket_endpoint(websocket: WebSocket):
    protocol = WebSocketProtocol(websocket)
    await protocol.connect()
    try:
        while True:
            data = await protocol.receive_message()
            # Handle incoming data
            await protocol.send_message(MessageType.FLIGHT_STATE_UPDATE, {"status": "received"})
    except Exception as e:
        print(f"WebSocket error: {e}")
    finally:
        await protocol.disconnect()
