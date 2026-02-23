from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import List

router = APIRouter()

@dataclass
class Waypoint:
    latitude: float
    longitude: float
    altitude: Optional[float] = None
    name: Optional[str] = None

class FlightPlan(BaseModel):
    id: int
    name: str
    waypoints: List[Waypoint] = []

import json
import os

FLIGHT_PLANS_FILE = 'flight_plans.json'

if os.path.exists(FLIGHT_PLANS_FILE):
    with open(FLIGHT_PLANS_FILE, 'r') as file:
        flight_plans = json.load(file)
else:
    flight_plans = []

# Save flight plans to file
def save_flight_plans():
    with open(FLIGHT_PLANS_FILE, 'w') as file:
        json.dump(flight_plans, file)


@router.post("/", response_model=FlightPlan)
def create_flight_plan(flight_plan: FlightPlan):
    flight_plans.append(flight_plan.dict())
    save_flight_plans()
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
            flight_plans[idx] = flight_plan
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
