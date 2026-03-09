# Navigation Service for G1000 Simulator

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from typing import List, Optional

app = FastAPI()

# Define data models
class Waypoint(BaseModel):
    id: str
    name: str
    latitude: float
    longitude: float

class FlightPlan(BaseModel):
    id: str
    waypoints: List[Waypoint]
    active: bool = False

# In-memory database
flight_plans = {}

@app.post("/api/flight-plan", response_model=FlightPlan)
def create_flight_plan(flight_plan: FlightPlan):
    if flight_plan.id in flight_plans:
        raise HTTPException(status_code=400, detail="Flight plan already exists")
    flight_plans[flight_plan.id] = flight_plan
    return flight_plan

@app.get("/api/flight-plan/{flight_plan_id}", response_model=FlightPlan)
def get_flight_plan(flight_plan_id: str):
    flight_plan = flight_plans.get(flight_plan_id)
    if not flight_plan:
        raise HTTPException(status_code=404, detail="Flight plan not found")
    return flight_plan

@app.put("/api/flight-plan/{flight_plan_id}", response_model=FlightPlan)
def update_flight_plan(flight_plan_id: str, flight_plan: FlightPlan):
    if flight_plan_id not in flight_plans:
        raise HTTPException(status_code=404, detail="Flight plan not found")
    flight_plans[flight_plan_id] = flight_plan
    return flight_plan

@app.delete("/api/flight-plan/{flight_plan_id}")
def delete_flight_plan(flight_plan_id: str):
    if flight_plan_id not in flight_plans:
        raise HTTPException(status_code=404, detail="Flight plan not found")
    del flight_plans[flight_plan_id]
    return {"detail": "Flight plan deleted"}

@app.get("/api/nav/search")
def search_navigation_database(query: str):
    # Placeholder for navigation database search
    return {"results": []}

@app.get("/api/procedures/{airport}")
def get_procedures_for_airport(airport: str):
    # Placeholder for procedures retrieval
    return {"procedures": []}
