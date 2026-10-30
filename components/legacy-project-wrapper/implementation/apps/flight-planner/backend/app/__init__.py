# Initialize the backend application
from pathlib import Path

from fastapi import FastAPI, Request
from fastapi.responses import FileResponse, JSONResponse
from aviation.e2e import verify_e2e_headers
from .e2e import RUN_ID as E2E_RUN_ID, SECRET as E2E_SECRET
from fastapi.staticfiles import StaticFiles
from .routers.flight_plan import router as flight_plan_router
from .services.alert_manager import AlertManager
from .services.websocket_protocol import WebSocketProtocol, MessageType
from .services.flight_recording_service import router as flight_recording_router
from .services.hardware_integration import HardwareIntegrationService
from .services.envelope_protection import EnvelopeProtection
from .services.gps_simulation import GPSSimulationService, GPSState
from .services.telemetry_recording import TelemetryRecordingService, TelemetrySnapshot
from .services.telemetry_streaming_hub import TelemetryStreamingHub
from .services.approaches import ApproachProcedure, ApproachType, ApproachCategory, Waypoint, MissedApproachAction
from .routes.alerts import router as alerts_router
from .routers.settings import router as settings_router
from .routers.explain import router as explain_router
from .routers.health import router as health_router
from .routers.route import router as route_router
from .routers.plan import router as plan_router
from .routers.weather import router as weather_router
from .routers.airports import router as airports_router
from .routers.airspace import router as airspace_router
from .routers.terrain import router as terrain_router
from .routers.mac_tasks import router as mac_tasks_router
from .routers.local import router as local_router
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

    @app.middleware('http')
    async def separate_test_traffic(request: Request, call_next):
        try:
            signed_run = verify_e2e_headers('flight-planner', request.headers, E2E_SECRET)
            if (E2E_RUN_ID and signed_run != E2E_RUN_ID) or (not E2E_RUN_ID and signed_run):
                return JSONResponse({'error': 'E2E credential rejected'}, status_code=403)
        except ValueError:
            return JSONResponse({'error': 'Invalid E2E credential'}, status_code=403)
        return await call_next(request)

    if E2E_RUN_ID:
        @app.get('/__e2e/status', include_in_schema=False)
        def e2e_status():
            from .routers.flight_plan import _plans
            from .services.flight_recording_service import flight_recordings
            return {'test_run_id': E2E_RUN_ID, 'is_test_data': True,
                    'saved_plan_count': sum(p.get('is_test_data') is True and p.get('test_run_id') == E2E_RUN_ID
                                            for p in _plans.values()),
                    'recording_count': sum(r.get('is_test_data') is True and r.get('test_run_id') == E2E_RUN_ID
                                           for r in flight_recordings)}

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
    # Core API routers (exposed under /api prefix)
    app.include_router(health_router, prefix="/api", tags=["health"])
    app.include_router(route_router, prefix="/api", tags=["route"])
    app.include_router(plan_router, prefix="/api", tags=["plan"])
    app.include_router(weather_router, prefix="/api", tags=["weather"])
    app.include_router(airports_router, prefix="/api", tags=["airports"])
    app.include_router(airspace_router, prefix="/api", tags=["airspace"])
    app.include_router(terrain_router, prefix="/api", tags=["terrain"])
    app.include_router(mac_tasks_router, prefix="/api", tags=["mac"])
    app.include_router(local_router, prefix="/api", tags=["local"])

    # Initialize AlertManager
    app.alert_manager = AlertManager()

    # Initialize HardwareIntegrationService
    app.hardware_integration_service = HardwareIntegrationService()

    # Initialize GPSSimulationService
    initial_gps_state = GPSState(lat=0.0, lon=0.0, alt=0.0, speed=0.0, track=0.0, raim=True, epe=10.0)
    app.gps_simulation_service = GPSSimulationService(initial_gps_state)

    # Initialize TelemetryRecordingService
    app.telemetry_recording_service = TelemetryRecordingService()

    # Telemetry streaming hub: clients connect here and receive broadcasts.
    app.telemetry_hub = TelemetryStreamingHub()

    @app.websocket("/ws")
    async def websocket_hub(websocket: WebSocket):
        hub = app.telemetry_hub
        await hub.connect(websocket)
        try:
            while True:
                message = await websocket.receive_json()
                await hub.broadcast(message.get("type", "telemetry"), message.get("data", {}))
        except WebSocketDisconnect:
            hub.remove(websocket)
        except Exception as e:
            print(f"Telemetry hub error: {e}")
            hub.remove(websocket)

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

    static_root = Path(__file__).resolve().parents[1] / "static"
    if (static_root / "index.html").is_file():
        @app.get("/", include_in_schema=False)
        @app.get("/weather", include_in_schema=False)
        @app.get("/airports", include_in_schema=False)
        def frontend_page() -> FileResponse:
            return FileResponse(static_root / "index.html")

        app.mount("/", StaticFiles(directory=static_root, html=True), name="frontend")

    return app
