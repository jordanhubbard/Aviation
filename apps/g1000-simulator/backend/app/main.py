# main.py

from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
import asyncio
import json
from typing import Set
from services.flight_plan import FlightPlanService
from services.nav_database import NavigationDatabaseService
from services.routing import RoutingService
from services.procedures import ProceduresService
from services.geo_calculations import GeoCalculationsService
from services.flight_dynamics import FlightDynamicsService
from services.streaming import StreamingService
from app.routers import settings as settings_router

app = FastAPI()

# Add CORS middleware for frontend communication
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize services
flight_plan_service = FlightPlanService()
nav_database_service = NavigationDatabaseService()
routing_service = RoutingService()
procedures_service = ProceduresService()
geo_calculations_service = GeoCalculationsService()
flight_dynamics_service = FlightDynamicsService()
streaming_service = StreamingService()

# WebSocket connection manager
class ConnectionManager:
    def __init__(self):
        self.active_connections: Set[WebSocket] = set()

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.add(websocket)

    def disconnect(self, websocket: WebSocket):
        self.active_connections.discard(websocket)

    async def broadcast(self, message: dict):
        """Broadcast message to all connected clients"""
        disconnected = set()
        for connection in self.active_connections:
            try:
                await connection.send_json(message)
            except Exception:
                disconnected.add(connection)
        
        # Clean up disconnected clients
        for connection in disconnected:
            self.disconnect(connection)

manager = ConnectionManager()

# REST API endpoints
@app.post("/api/flight-plan")
async def create_flight_plan(data: dict):
    return flight_plan_service.create_flight_plan(data)

@app.get("/api/flight-plan/{plan_id}")
async def get_flight_plan(plan_id: str):
    return flight_plan_service.get_flight_plan(plan_id)

@app.put("/api/flight-plan/{plan_id}")
async def update_flight_plan(plan_id: str, data: dict):
    return flight_plan_service.update_flight_plan(plan_id, data)

@app.delete("/api/flight-plan/{plan_id}")
async def delete_flight_plan(plan_id: str):
    return flight_plan_service.delete_flight_plan(plan_id)

@app.get("/api/nav/search")
async def search_nav_database(query: str):
    return nav_database_service.search(query)

@app.get("/api/procedures/{airport}")
async def get_procedures(airport: str):
    return nav_database_service.get_procedures(airport)

@app.post("/api/flight/initialize")
async def initialize_flight(data: dict):
    """Initialize a new flight with aircraft type and initial conditions"""
    return flight_dynamics_service.initialize_flight(data)

@app.post("/api/flight/update")
async def update_flight(data: dict):
    """Update flight state with control inputs"""
    return flight_dynamics_service.update_flight(data)

@app.get("/api/flight/state")
async def get_flight_state():
    """Get current flight state"""
    return flight_dynamics_service.get_flight_state()

@app.post("/api/flight/reset")
async def reset_flight():
    """Reset flight to initial conditions"""
    return flight_dynamics_service.reset_flight()

# WebSocket endpoint for real-time data streaming
@app.websocket("/ws/flight-data")
async def websocket_flight_data(websocket: WebSocket):
    """WebSocket endpoint for streaming flight data at 20Hz for PFD, 5Hz for MFD"""
    await manager.connect(websocket)
    try:
        # Start streaming flight data
        streaming_task = asyncio.create_task(
            streaming_service.stream_flight_data(manager, websocket)
        )
        
        # Handle incoming messages (control inputs, mode changes, etc.)
        while True:
            data = await websocket.receive_json()
            await streaming_service.handle_client_message(data, flight_dynamics_service)
    except WebSocketDisconnect:
        manager.disconnect(websocket)
    except Exception as e:
        manager.disconnect(websocket)
        print(f"WebSocket error: {e}")

@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {"status": "healthy"}


# Settings router (ConfigPanel support)
app.include_router(settings_router.router)
