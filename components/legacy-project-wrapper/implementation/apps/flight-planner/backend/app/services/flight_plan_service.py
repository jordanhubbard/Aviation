from fastapi import APIRouter, HTTPException, UploadFile, File
from .envelope_protection import EnvelopeProtection
from .nav_database import NavDatabase
from .routing import Routing
from .procedures import Procedures
from .geo_calculations import GeoCalculations
from .alert_manager import AlertManager
from pydantic import BaseModel, Field
from app.schemas.flight_plan import FlightPlanSummary
from typing import List, Optional, Dict, Any
from dataclasses import dataclass, field
from enum import Enum
from datetime import datetime
import json
import os
from pathlib import Path
import xml.etree.ElementTree as ET
from io import StringIO

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

FLIGHT_PLANS_FILE = os.path.join(os.path.dirname(__file__), '..', '..', '..', 'data', 'flight_plans.json')
RECENT_PLANS_FILE = os.path.join(os.path.dirname(__file__), '..', '..', '..', 'data', 'recent_flight_plans.json')

# Ensure data directory exists
os.makedirs(os.path.dirname(FLIGHT_PLANS_FILE), exist_ok=True)

if os.path.exists(FLIGHT_PLANS_FILE):
    with open(FLIGHT_PLANS_FILE, 'r') as file:
        flight_plans = json.load(file)
else:
    flight_plans = []

if os.path.exists(RECENT_PLANS_FILE):
    with open(RECENT_PLANS_FILE, 'r') as file:
        recent_plans = json.load(file)
else:
    recent_plans = []

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
        json.dump(flight_plans, file, indent=2)

# Update recent plans list
def update_recent_plans(flight_plan_id: int, name: str):
    global recent_plans
    # Remove if already exists
    recent_plans = [p for p in recent_plans if p['id'] != flight_plan_id]
    # Add to front
    recent_plans.insert(0, {
        'id': flight_plan_id,
        'name': name,
        'accessed_at': datetime.now().isoformat()
    })
    # Keep only last 10
    recent_plans = recent_plans[:10]
    with open(RECENT_PLANS_FILE, 'w') as file:
        json.dump(recent_plans, file, indent=2)

# Export flight plan to GPX format
def export_to_gpx(flight_plan: Dict[str, Any]) -> str:
    gpx = ET.Element('gpx', version='1.1', creator='flight-planner')
    trk = ET.SubElement(gpx, 'trk')
    name_elem = ET.SubElement(trk, 'name')
    name_elem.text = flight_plan.get('name', 'Flight Plan')
    trkseg = ET.SubElement(trk, 'trkseg')
    
    for wp in flight_plan.get('waypoints', []):
        trkpt = ET.SubElement(trkseg, 'trkpt', lat=str(wp['latitude']), lon=str(wp['longitude']))
        if wp.get('altitude'):
            ele = ET.SubElement(trkpt, 'ele')
            ele.text = str(wp['altitude'])
        if wp.get('name'):
            name = ET.SubElement(trkpt, 'name')
            name.text = wp['name']
    
    return ET.tostring(gpx, encoding='unicode')

# Export flight plan to FPL format (simple text format)
def export_to_fpl(flight_plan: Dict[str, Any]) -> str:
    lines = []
    lines.append(f"(FPL-{flight_plan.get('name', 'PLAN')}-IS")
    lines.append(f"-{flight_plan.get('aircraft_type', 'C172')}/L")
    lines.append(f"-{flight_plan.get('origin', 'XXXX')}{flight_plan.get('destination', 'XXXX')}")
    
    waypoints_str = ' '.join([wp.get('name', f"WP{i}") for i, wp in enumerate(flight_plan.get('waypoints', []))])
    lines.append(f"-{waypoints_str}")
    lines.append(")")
    
    return '\n'.join(lines)

# Import flight plan from GPX
def import_from_gpx(gpx_content: str) -> Dict[str, Any]:
    root = ET.fromstring(gpx_content)
    waypoints = []
    
    for trkpt in root.findall('.//{http://www.topografix.com/GPX/1/1}trkpt'):
        lat = float(trkpt.get('lat'))
        lon = float(trkpt.get('lon'))
        name_elem = trkpt.find('{http://www.topografix.com/GPX/1/1}name')
        name = name_elem.text if name_elem is not None else None
        ele_elem = trkpt.find('{http://www.topografix.com/GPX/1/1}ele')
        altitude = float(ele_elem.text) if ele_elem is not None else None
        
        waypoints.append({
            'latitude': lat,
            'longitude': lon,
            'name': name,
            'altitude': altitude,
            'status': 'pending',
            'sequence_number': len(waypoints)
        })
    
    # Try to get name from track
    name = 'Imported Plan'
    trk_name = root.find('.//{http://www.topografix.com/GPX/1/1}name')
    if trk_name is not None:
        name = trk_name.text
    
    return {
        'name': name,
        'waypoints': waypoints,
        'active_waypoint_index': 0
    }

# Import flight plan from FPL
def import_from_fpl(fpl_content: str) -> Dict[str, Any]:
    lines = fpl_content.strip().split('\n')
    waypoints = []
    name = 'Imported FPL'
    
    for line in lines:
        if line.startswith('(FPL'):
            parts = line.split('-')
            if len(parts) > 1:
                name = parts[1]
        elif not line.startswith('(') and not line.startswith(')'):
            # Parse waypoint line
            wp_names = line.split()
            for i, wp_name in enumerate(wp_names):
                waypoints.append({
                    'name': wp_name,
                    'latitude': 0.0,
                    'longitude': 0.0,
                    'status': 'pending',
                    'sequence_number': i
                })
    
    return {
        'name': name,
        'waypoints': waypoints,
        'active_waypoint_index': 0
    }


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
