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
from .services.telemetry_recording import TelemetryRecordingService, TelemetrySnapshot
from .services.approaches import ApproachProcedure, ApproachType, ApproachCategory, Waypoint, MissedApproachAction
from .routes.alerts import router as alerts_router
from .routers.settings import router as settings_router
from .routers.explain import router as explain_router
from .routers import plan as plan_router_mod
from .routers import route as route_router_mod
from .routers import weather as weather_router_mod
from .routers import terrain as terrain_router_mod
from .routers import local as local_router_mod
from .routers import airports as airports_router_mod
from .routers import airspace as airspace_router_mod
from .routers import health as health_router_mod
from .routers import beads as beads_router_mod
from fastapi import WebSocket, WebSocketDisconnect


def create_app(settings):
    """Create and configure the FastAPI application.
    
    Args:
        settings: Application settings object
        
    Returns:
        Configured FastAPI application instance
    """
    app = FastAPI(
        docs_url=None,
        redoc_url=None,
        openapi_url=None,
        title='Flight Planner API',
        version='0.1.0'
    )

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
    app.include_router(alerts_router)
    app.include_router(settings_router, tags=["settings"])
    app.include_router(explain_router)
    # Core routing / planning routers (were imported in routers/__init__ but never mounted)
    app.include_router(plan_router_mod.router, prefix="/api", tags=["plan"])
    app.include_router(route_router_mod.router, prefix="/api", tags=["route"])
    app.include_router(weather_router_mod.router, prefix="/api", tags=["weather"])
    app.include_router(terrain_router_mod.router, prefix="/api", tags=["terrain"])
    app.include_router(local_router_mod.router, prefix="/api", tags=["local"])
    app.include_router(airports_router_mod.router, prefix="/api", tags=["airports"])
    app.include_router(airspace_router_mod.router, prefix="/api", tags=["airspace"])
    app.include_router(health_router_mod.router, prefix="/api", tags=["health"])
    app.include_router(beads_router_mod.router, prefix="/api", tags=["beads"])

    # Initialize AlertManager
    app.alert_manager = AlertManager()

    # Initialize HardwareIntegrationService
    app.hardware_integration_service = HardwareIntegrationService()

    # Initialize GPSSimulationService
    initial_gps_state = GPSState(lat=0.0, lon=0.0, alt=0.0, speed=0.0, track=0.0, raim=True, epe=10.0)
    app.gps_simulation_service = GPSSimulationService(initial_gps_state)

    # Initialize TelemetryRecordingService
    app.telemetry_recording_service = TelemetryRecordingService()

    # Example WebSocket endpoint
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

    return app
