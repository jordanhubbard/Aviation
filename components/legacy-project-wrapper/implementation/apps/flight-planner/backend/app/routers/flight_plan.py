"""Flight plan router — thin FastAPI HTTP adapter for saved flight plans."""
from __future__ import annotations

import json
import os
import xml.etree.ElementTree as ET
from datetime import datetime
from typing import Dict, List, Optional
from uuid import uuid4

from fastapi import APIRouter, HTTPException

from app.schemas.flight_plan import (
    CreateFlightPlanRequest,
    ExportFlightPlanResponse,
    FlightPlanSummary,
    ImportFlightPlanRequest,
    SavedFlightPlan,
    UpdateFlightPlanRequest,
    FlightPlanMetadata,
    FlightPlanWaypoint,
)

router = APIRouter()

# ---------------------------------------------------------------------------
# Storage helpers
# ---------------------------------------------------------------------------

_DATA_DIR = os.path.join(os.path.dirname(__file__), "..", "..", "..", "data")
_PLANS_FILE = os.path.join(_DATA_DIR, "saved_flight_plans.json")

# In-memory store: plan_id -> SavedFlightPlan (as dict for JSON-serialisable storage)
_plans: Dict[str, dict] = {}


def _load_plans() -> None:
    os.makedirs(_DATA_DIR, exist_ok=True)
    if os.path.exists(_PLANS_FILE):
        try:
            with open(_PLANS_FILE, "r") as fh:
                data = json.load(fh)
            if isinstance(data, list):
                for item in data:
                    _plans[item["metadata"]["id"]] = item
        except Exception:
            pass


def _save_plans() -> None:
    os.makedirs(_DATA_DIR, exist_ok=True)
    with open(_PLANS_FILE, "w") as fh:
        json.dump(list(_plans.values()), fh, indent=2, default=str)


# Initialise from disk on module load
_load_plans()


def _to_summary(plan_dict: dict) -> FlightPlanSummary:
    meta = plan_dict["metadata"]
    return FlightPlanSummary(
        id=meta["id"],
        name=meta["name"],
        origin=meta.get("origin"),
        destination=meta.get("destination"),
        created_at=meta["created_at"],
        updated_at=meta["updated_at"],
        distance_nm=plan_dict.get("distance_nm"),
        waypoint_count=len(plan_dict.get("waypoints", [])),
    )


# ---------------------------------------------------------------------------
# Export / import helpers
# ---------------------------------------------------------------------------


def _export_gpx(plan: SavedFlightPlan) -> str:
    gpx = ET.Element("gpx", version="1.1", creator="flight-planner")
    trk = ET.SubElement(gpx, "trk")
    name_elem = ET.SubElement(trk, "name")
    name_elem.text = plan.metadata.name
    trkseg = ET.SubElement(trk, "trkseg")
    for wp in plan.waypoints:
        trkpt = ET.SubElement(trkseg, "trkpt", lat=str(wp.latitude), lon=str(wp.longitude))
        if wp.altitude_ft is not None:
            ET.SubElement(trkpt, "ele").text = str(wp.altitude_ft)
        ET.SubElement(trkpt, "name").text = wp.name
    return ET.tostring(gpx, encoding="unicode")


def _export_fpl(plan: SavedFlightPlan) -> str:
    lines = [
        f"(FPL-{plan.metadata.name}-IS",
        f"-{plan.metadata.aircraft_type or 'C172'}/L",
        f"-{plan.metadata.origin or 'XXXX'}{plan.metadata.destination or 'XXXX'}",
    ]
    if plan.waypoints:
        lines.append(" ".join(wp.name for wp in plan.waypoints))
    lines.append(")")
    return "\n".join(lines)


def _import_gpx(content: str, name: Optional[str]) -> SavedFlightPlan:
    try:
        root = ET.fromstring(content)
        ns = {"gpx": "http://www.topografix.com/GPX/1/1"}
        waypoints: List[FlightPlanWaypoint] = []
        for i, trkpt in enumerate(root.findall(".//gpx:trkpt", ns) or root.findall(".//{*}trkpt")):
            lat = float(trkpt.get("lat", 0))
            lon = float(trkpt.get("lon", 0))
            ele = trkpt.find("gpx:ele", ns) or trkpt.find("{*}ele")
            wp_name_el = trkpt.find("gpx:name", ns) or trkpt.find("{*}name")
            waypoints.append(FlightPlanWaypoint(
                name=wp_name_el.text if wp_name_el is not None else f"WP{i}",
                latitude=lat,
                longitude=lon,
                altitude_ft=float(ele.text) if ele is not None else None,
                sequence=i,
            ))
        plan_name = name or "Imported GPX"
        trk_name = root.find(".//gpx:name", ns) or root.find(".//{*}name")
        if trk_name is not None and not name:
            plan_name = trk_name.text or plan_name
    except ET.ParseError as exc:
        raise HTTPException(status_code=422, detail=f"Invalid GPX content: {exc}")
    return SavedFlightPlan(
        metadata=FlightPlanMetadata(id=str(uuid4()), name=plan_name),
        waypoints=waypoints,
    )


def _import_fpl(content: str, name: Optional[str]) -> SavedFlightPlan:
    waypoints: List[FlightPlanWaypoint] = []
    plan_name = name or "Imported FPL"
    for line in content.strip().splitlines():
        if line.startswith("(FPL"):
            parts = line.split("-")
            if len(parts) > 1 and not name:
                plan_name = parts[1] or plan_name
        elif not line.startswith("(") and not line.startswith(")"):
            for i, wp_name in enumerate(line.split()):
                waypoints.append(FlightPlanWaypoint(
                    name=wp_name, latitude=0.0, longitude=0.0, sequence=i
                ))
    return SavedFlightPlan(
        metadata=FlightPlanMetadata(id=str(uuid4()), name=plan_name),
        waypoints=waypoints,
    )


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------


@router.get("/", response_model=List[FlightPlanSummary], summary="List saved flight plans")
def list_flight_plans() -> List[FlightPlanSummary]:
    return [_to_summary(p) for p in _plans.values()]


@router.post("/", response_model=SavedFlightPlan, status_code=201, summary="Create a flight plan")
def create_flight_plan(req: CreateFlightPlanRequest) -> SavedFlightPlan:
    now = datetime.utcnow()
    plan = SavedFlightPlan(
        metadata=FlightPlanMetadata(
            id=str(uuid4()),
            name=req.name,
            description=req.description,
            created_at=now,
            updated_at=now,
            origin=req.origin,
            destination=req.destination,
            aircraft_type=req.aircraft_type,
            pilot_name=req.pilot_name,
        ),
        waypoints=req.waypoints,
        route=req.route,
        distance_nm=req.distance_nm,
        estimated_time_hr=req.estimated_time_hr,
        cruise_altitude_ft=req.cruise_altitude_ft,
        cruise_speed_kt=req.cruise_speed_kt,
        fuel_required_gal=req.fuel_required_gal,
        notes=req.notes,
    )
    _plans[plan.metadata.id] = json.loads(plan.model_dump_json())
    _save_plans()
    return plan


@router.get("/{plan_id}", response_model=SavedFlightPlan, summary="Get a flight plan by ID")
def get_flight_plan(plan_id: str) -> SavedFlightPlan:
    if plan_id not in _plans:
        raise HTTPException(status_code=404, detail=f"Flight plan {plan_id!r} not found")
    return SavedFlightPlan(**_plans[plan_id])


@router.put("/{plan_id}", response_model=SavedFlightPlan, summary="Update a flight plan")
def update_flight_plan(plan_id: str, req: UpdateFlightPlanRequest) -> SavedFlightPlan:
    if plan_id not in _plans:
        raise HTTPException(status_code=404, detail=f"Flight plan {plan_id!r} not found")
    existing = SavedFlightPlan(**_plans[plan_id])
    update_data = req.model_dump(exclude_unset=True)
    meta_fields = {"name", "description", "origin", "destination", "aircraft_type", "pilot_name"}
    meta_updates = {k: v for k, v in update_data.items() if k in meta_fields}
    plan_updates = {k: v for k, v in update_data.items() if k not in meta_fields}
    meta_dict = existing.metadata.model_dump()
    meta_dict.update(meta_updates)
    meta_dict["updated_at"] = datetime.utcnow()
    plan_dict = existing.model_dump()
    plan_dict["metadata"] = meta_dict
    plan_dict.update(plan_updates)
    updated = SavedFlightPlan(**plan_dict)
    _plans[plan_id] = json.loads(updated.model_dump_json())
    _save_plans()
    return updated


@router.delete("/{plan_id}", status_code=204, summary="Delete a flight plan")
def delete_flight_plan(plan_id: str) -> None:
    if plan_id not in _plans:
        raise HTTPException(status_code=404, detail=f"Flight plan {plan_id!r} not found")
    del _plans[plan_id]
    _save_plans()


@router.post(
    "/{plan_id}/export",
    response_model=ExportFlightPlanResponse,
    summary="Export a flight plan to GPX or FPL",
)
def export_flight_plan(plan_id: str, fmt: str = "gpx") -> ExportFlightPlanResponse:
    if plan_id not in _plans:
        raise HTTPException(status_code=404, detail=f"Flight plan {plan_id!r} not found")
    plan = SavedFlightPlan(**_plans[plan_id])
    fmt = fmt.lower()
    if fmt == "gpx":
        content = _export_gpx(plan)
        filename = f"{plan.metadata.name.replace(' ', '_')}.gpx"
    elif fmt == "fpl":
        content = _export_fpl(plan)
        filename = f"{plan.metadata.name.replace(' ', '_')}.fpl"
    else:
        raise HTTPException(status_code=422, detail=f"Unsupported format {fmt!r}; use 'gpx' or 'fpl'")
    return ExportFlightPlanResponse(format=fmt, content=content, filename=filename)


@router.post(
    "/import",
    response_model=SavedFlightPlan,
    status_code=201,
    summary="Import a flight plan from GPX or FPL content",
)
def import_flight_plan(req: ImportFlightPlanRequest) -> SavedFlightPlan:
    if req.format == "gpx":
        plan = _import_gpx(req.content, req.name)
    elif req.format == "fpl":
        plan = _import_fpl(req.content, req.name)
    else:
        raise HTTPException(status_code=422, detail=f"Unsupported format {req.format!r}")
    _plans[plan.metadata.id] = json.loads(plan.model_dump_json())
    _save_plans()
    return plan
