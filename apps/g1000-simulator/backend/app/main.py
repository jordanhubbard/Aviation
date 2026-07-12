from __future__ import annotations

from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
import asyncio
from typing import Set

from app.services.flight_plan import FlightPlanService
from app.services.nav_database import NavigationDatabaseService
from app.services.routing import RoutingService
from app.services.procedures import ProceduresService
from app.services.geo_calculations import GeoCalculationsService
from app.services.flight_dynamics import FlightDynamicsSimulator
from app.routers import settings as settings_router

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

flight_plan_service = FlightPlanService()
nav_database_service = NavigationDatabaseService()
routing_service = RoutingService()
procedures_service = ProceduresService()
geo_calculations_service = GeoCalculationsService()
flight_dynamics_service = FlightDynamicsSimulator()


class ConnectionManager:
    def __init__(self) -> None:
        self.active_connections: Set[WebSocket] = set()

    async def connect(self, websocket: WebSocket) -> None:
        await websocket.accept()
        self.active_connections.add(websocket)

    def disconnect(self, websocket: WebSocket) -> None:
        self.active_connections.discard(websocket)

    async def broadcast(self, message: dict) -> None:
        disconnected: Set[WebSocket] = set()
        for connection in self.active_connections:
            try:
                await connection.send_json(message)
            except Exception:
                disconnected.add(connection)
        for connection in disconnected:
            self.disconnect(connection)


manager = ConnectionManager()


@app.post("/api/flight-plan")
async def create_flight_plan(data: dict) -> dict:
    return flight_plan_service.create_flight_plan(data)


@app.get("/api/flight-plan/{plan_id}")
async def get_flight_plan(plan_id: str) -> dict:
    return flight_plan_service.get_flight_plan(plan_id)


@app.put("/api/flight-plan/{plan_id}")
async def update_flight_plan(plan_id: str, data: dict) -> dict:
    return flight_plan_service.update_flight_plan(plan_id, data)


@app.delete("/api/flight-plan/{plan_id}")
async def delete_flight_plan(plan_id: str) -> dict:
    deleted = flight_plan_service.delete_flight_plan(plan_id)
    return {"deleted": deleted, "id": plan_id}


@app.get("/api/nav/search")
async def search_nav_database(query: str) -> dict:
    return nav_database_service.search(query)


@app.get("/api/procedures/{airport}")
async def get_procedures(airport: str) -> dict:
    return nav_database_service.get_procedures(airport)


@app.get("/health")
async def health_check() -> dict:
    return {"status": "healthy"}


app.include_router(settings_router.router)
