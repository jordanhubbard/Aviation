# Initialize the backend application
from fastapi import FastAPI
from .services.flight_plan_service import router as flight_plan_router
from .services.alert_manager import AlertManager
from .services.websocket_protocol import WebSocketProtocol, MessageType
from .services.flight_recording_service import router as flight_recording_router
from .services.hardware_integration import HardwareIntegrationService
from .services.envelope_protection import EnvelopeProtection
from .services.ahrs_adc_simulation import AHRS, ADC
from .services.gps_simulation import GPSSimulationService, GPSState

app = FastAPI(docs_url=None, redoc_url=None, openapi_url=None, title='Flight Planner API', version='0.1.0')

# Define REST API endpoints
@app.post('/api/control/autopilot/engage')
async def engage_autopilot():
    # Logic to engage autopilot
    return {'status': 'Autopilot engaged'}

@app.post('/api/control/autopilot/set-mode')
async def set_autopilot_mode(mode: str):
    # Logic to set autopilot mode
    return {'status': f'Autopilot mode set to {mode}'}

@app.post('/api/control/heading/set')
async def set_heading(heading: float):
    # Logic to set heading
    return {'status': f'Heading set to {heading}'}

@app.post('/api/control/altitude/set')
async def set_altitude(altitude: float):
    # Logic to set altitude
    return {'status': f'Altitude set to {altitude}'}

@app.post('/api/control/flight-plan/load')
async def load_flight_plan(plan_id: str):
    # Logic to load flight plan
    return {'status': f'Flight plan {plan_id} loaded'}

@app.get('/api/state/flight')
async def get_flight_state():
    # Logic to get flight state
    return {'state': 'Flight state data'}

@app.get('/api/state/navigation')
async def get_navigation_state():
    # Logic to get navigation state
    return {'state': 'Navigation state data'}

@app.get('/api/state/systems')
async def get_systems_state():
    # Logic to get systems state
    return {'state': 'Systems state data'}
app.include_router(flight_plan_router, prefix="/flight-plans", tags=["flight-plans"])
app.include_router(flight_recording_router, prefix="/flight-recordings", tags=["flight-recordings"])

# Initialize AlertManager
alert_manager = AlertManager()

# Initialize HardwareIntegrationService
hardware_integration_service = HardwareIntegrationService()

# Initialize GPSSimulationService
initial_gps_state = GPSState(lat=0.0, lon=0.0, alt=0.0, speed=0.0, track=0.0, raim=True, epe=10.0)
gps_simulation_service = GPSSimulationService(initial_gps_state)

# Example WebSocket endpoint
from fastapi import WebSocket, WebSocketDisconnect

@app.websocket("/ws/telemetry")
async def websocket_telemetry(websocket: WebSocket):
    protocol = WebSocketProtocol(websocket)
    await protocol.connect()
    try:
        while True:
            data = await protocol.receive_message()
            # Handle incoming telemetry data
            await protocol.send_message(MessageType.FLIGHT_STATE_UPDATE, {"status": "telemetry received"})
    except WebSocketDisconnect:
        print("Telemetry WebSocket disconnected")
    except Exception as e:
        print(f"Telemetry WebSocket error: {e}")
    finally:
        await protocol.disconnect()

@app.websocket("/ws/commands")
async def websocket_commands(websocket: WebSocket):
    protocol = WebSocketProtocol(websocket)
    await protocol.connect()
    try:
        while True:
            data = await protocol.receive_message()
            # Handle incoming commands
            await protocol.send_message(MessageType.FLIGHT_STATE_UPDATE, {"status": "command received"})
    except WebSocketDisconnect:
        print("Commands WebSocket disconnected")
    except Exception as e:
        print(f"Commands WebSocket error: {e}")
    finally:
        await protocol.disconnect()
