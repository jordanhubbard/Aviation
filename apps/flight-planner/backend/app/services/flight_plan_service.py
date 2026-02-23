from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import List

router = APIRouter()

class FlightPlan(BaseModel):
    id: int
    name: str
    waypoints: List[str]

flight_plans = [{'id': 1, 'name': 'Test Plan', 'waypoints': ['WP1', 'WP2']}]

@router.post("/", response_model=FlightPlan)
def create_flight_plan(flight_plan: FlightPlan):
    flight_plans.append(flight_plan)
    return flight_plan

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
            return {"message": "Flight plan deleted"}
    raise HTTPException(status_code=404, detail="Flight plan not found")
