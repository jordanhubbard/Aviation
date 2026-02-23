# Initialize the backend application
from fastapi import FastAPI
from .services.flight_plan_service import router as flight_plan_router
from .services.websocket_protocol import WebSocketProtocol, MessageType
from .services.ahrs_adc_simulation import AHRS, ADC
from .services.gps_simulation import GPSSimulationService, GPSState

app = FastAPI()
app.include_router(flight_plan_router, prefix="/flight-plans", tags=["flight-plans"])
