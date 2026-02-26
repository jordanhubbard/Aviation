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

    def skip_active_waypoint(self):
        if self.active_waypoint_index < len(self.waypoints) - 1:
            self.waypoints[self.active_waypoint_index].status = WaypointStatus.SKIPPED
            self.active_waypoint_index += 1
            self.waypoints[self.active_waypoint_index].status = WaypointStatus.ACTIVE

    def activate_waypoint(self, index: int):
        if 0 <= index < len(self.waypoints):
            self.waypoints[self.active_waypoint_index].status = WaypointStatus.PASSED
            self.active_waypoint_index = index
            self.waypoints[self.active_waypoint_index].status = WaypointStatus.ACTIVE

    def activate_waypoint(self, waypoint_name: str) -> None:
        for index, waypoint in enumerate(self.waypoints):
            if waypoint.name == waypoint_name:
                self.active_waypoint_index = index
                waypoint.status = WaypointStatus.ACTIVE
                break
        else:
            raise ValueError(f"Waypoint {waypoint_name} not found in flight plan.")

import json
import os

FLIGHT_PLANS_FILE = os.path.join(os.path.dirname(__file__), '..', '..', '..', 'data', 'flight_plans.json')

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

@router.get("/list", response_model=List[FlightPlanSummary])
def list_flight_plans() -> List[FlightPlanSummary]:
    return [FlightPlanSummary(
        id=fp['id'],
        name=fp['name'],
        origin=fp.get('origin'),
        destination=fp.get('destination'),
        created_at=fp['created_at'],
        updated_at=fp['updated_at'],
        distance_nm=fp.get('distance_nm'),
        waypoint_count=len(fp['waypoints'])
    ) for fp in flight_plans]

@router.post("/", response_model=FlightPlan)
def create_flight_plan(flight_plan: FlightPlan) -> FlightPlan:
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
    return flight_plan

@router.get("/{flight_plan_id}", response_model=FlightPlan)
def read_flight_plan(flight_plan_id: int) -> FlightPlan:
    for flight_plan in flight_plans:
        if flight_plan.id == flight_plan_id:
            return flight_plan
    raise HTTPException(status_code=404, detail="Flight plan not found")

@router.put("/{flight_plan_id}", response_model=FlightPlan)
def update_flight_plan(flight_plan_id: int, flight_plan: FlightPlan) -> FlightPlan:
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
            return {"message": "Flight plan deleted"}
    raise HTTPException(status_code=404, detail="Flight plan not found")

@router.post("/{flight_plan_id}/skip-waypoint", response_model=FlightPlan)
def skip_active_waypoint(flight_plan_id: int) -> FlightPlan:
    for fp in flight_plans:
        if fp.id == flight_plan_id:
            flight_plan = FlightPlan(**fp)
            flight_plan.skip_active_waypoint()
            # Update the flight plan in storage
            for idx, stored_fp in enumerate(flight_plans):
                if stored_fp.id == flight_plan_id:
                    flight_plans[idx] = flight_plan.dict()
                    save_flight_plans()
                    return flight_plan
    raise HTTPException(status_code=404, detail="Flight plan not found")

@router.post("/{flight_plan_id}/activate-waypoint", response_model=FlightPlan)
def activate_waypoint(flight_plan_id: int, waypoint_index: int) -> FlightPlan:
    for fp in flight_plans:
        if fp.id == flight_plan_id:
            flight_plan = FlightPlan(**fp)
            flight_plan.activate_waypoint(waypoint_index)
            # Update the flight plan in storage
            for idx, stored_fp in enumerate(flight_plans):
                if stored_fp.id == flight_plan_id:
                    flight_plans[idx] = flight_plan.dict()
                    save_flight_plans()
                    return flight_plan
    raise HTTPException(status_code=404, detail="Flight plan not found")
