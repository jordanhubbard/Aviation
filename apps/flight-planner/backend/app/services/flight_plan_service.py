from fastapi import APIRouter, HTTPException
from .envelope_protection import EnvelopeProtection
from .nav_database import NavDatabase
from .routing import Routing
from .procedures import Procedures
from .geo_calculations import GeoCalculations
from .alert_manager import AlertManager
from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
from dataclasses import dataclass, field
from enum import Enum

router = APIRouter()

class WaypointStatus(str, Enum):
    PENDING = "pending"
    ACTIVE = "active"
    PASSED = "passed"
    SKIPPED = "skipped"

@dataclass
class Waypoint:
    latitude: float
    longitude: float
    altitude: Optional[float] = None
    name: Optional[str] = None
    status: WaypointStatus = WaypointStatus.PENDING
    sequence_number: int = 0

class FlightPlan(BaseModel):
    id: int
    name: str
    waypoints: List[Waypoint] = []
    active_waypoint_index: int = 0

import json
import os

FLIGHT_PLANS_FILE = 'backend/data/flight_plans.json'

if os.path.exists(FLIGHT_PLANS_FILE):
    with open(FLIGHT_PLANS_FILE, 'r') as file:
        flight_plans = json.load(file)
else:
    flight_plans = []

# API Endpoints

@router.get("/api/nav/search")
def search_navigation(query: str):
    return nav_database.search(query)

@router.get("/api/procedures/{airport}")
def get_procedures(airport: str):
    return {
        "sids": procedures.get_sids(airport),
        "stars": procedures.get_stars(airport),
        "approaches": procedures.get_approaches(airport)
    }

# Save flight plans to file
def save_flight_plans():
    return FlightPlan(**flight_plan.dict())
    with open(FLIGHT_PLANS_FILE, 'w') as file:
        json.dump(flight_plans, file)


envelope_protection = EnvelopeProtection()
nav_database = NavDatabase()
routing = Routing()
procedures = Procedures()
geo_calculations = GeoCalculations()
alert_manager = AlertManager()

# Active flight plan tracking for en-route operations
active_flight_plan_id: Optional[int] = None

@router.post("/", response_model=FlightPlan)
def create_flight_plan(flight_plan: FlightPlan):
    # Check envelope protection limits
    for waypoint in flight_plan.waypoints:
        pitch_status = envelope_protection.check_pitch(waypoint.altitude)  # Assuming altitude as a proxy for pitch
        bank_status = envelope_protection.check_bank(waypoint.altitude)   # Assuming altitude as a proxy for bank
        overspeed_status = envelope_protection.check_overspeed(waypoint.altitude)  # Assuming altitude as a proxy for speed
        stall_status = envelope_protection.check_stall(waypoint.altitude)  # Assuming altitude as a proxy for speed
        
        if "exceeded" in (pitch_status, bank_status, overspeed_status, stall_status):
            raise HTTPException(status_code=400, detail=f"Envelope protection limit exceeded: {pitch_status}, {bank_status}, {overspeed_status}, {stall_status}")

    flight_plans.append(flight_plan.dict())
    save_flight_plans()
    return FlightPlan(**flight_plan)

@router.get("/{flight_plan_id}", response_model=FlightPlan)
def read_flight_plan(flight_plan_id: int):
    for flight_plan in flight_plans:
        if flight_plan.id == flight_plan_id:
            return flight_plan
    raise HTTPException(status_code=404, detail="Flight plan not found")

@router.put("/{flight_plan_id}", response_model=FlightPlan)
def update_flight_plan(flight_plan_id: int, flight_plan: FlightPlan):
    for idx, fp in enumerate(flight_plans):
        if fp.id == flight_plan_id:
            flight_plans[idx] = flight_plan.dict()
            return flight_plan
    raise HTTPException(status_code=404, detail="Flight plan not found")

@router.delete("/{flight_plan_id}")
def delete_flight_plan(flight_plan_id: int):
    for idx, fp in enumerate(flight_plans):
        if fp.id == flight_plan_id:
            del flight_plans[idx]
            save_flight_plans()
    save_flight_plans()
    return {"message": "Flight plan deleted"}
    raise HTTPException(status_code=404, detail="Flight plan not found")
