# main.py

from fastapi import FastAPI
from services.flight_plan import FlightPlanService
from services.nav_database import NavigationDatabaseService
from services.routing import RoutingService
from services.procedures import ProceduresService
from services.geo_calculations import GeoCalculationsService

app = FastAPI()

flight_plan_service = FlightPlanService()
nav_database_service = NavigationDatabaseService()
routing_service = RoutingService()
procedures_service = ProceduresService()
geo_calculations_service = GeoCalculationsService()

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
