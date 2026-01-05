from __future__ import annotations

from datetime import datetime, timezone
import math
from typing import Any, Dict, List, Optional, Tuple

from fastapi import APIRouter, HTTPException

from app.models.airport import get_airport_coordinates, load_airport_cache
from app.schemas.local import LocalPlanRequest, LocalPlanResponse

router = APIRouter()


def _to_float(v: Any) -> Optional[float]:
    if v is None:
        return None
    try:
        return float(v)
    except Exception:
        return None


def _extract_lat_lon(airport: Dict[str, Any]) -> Tuple[Optional[float], Optional[float]]:
    if "geometry" in airport and isinstance(airport["geometry"], dict):
        coords = airport["geometry"].get("coordinates")
        if isinstance(coords, list) and len(coords) == 2:
            lon, lat = coords
            return _to_float(lat), _to_float(lon)

    lat = airport.get("lat") or airport.get("latitude")
    lon = airport.get("lon") or airport.get("longitude")
    return _to_float(lat), _to_float(lon)


def _haversine_nm(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    r_nm = 3440.065
    phi1 = math.radians(lat1)
    phi2 = math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlambda = math.radians(lon2 - lon1)

    a = math.sin(dphi / 2) ** 2 + math.cos(phi1) * math.cos(phi2) * math.sin(dlambda / 2) ** 2
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
    return r_nm * c


@router.post(
    "/local",
    response_model=LocalPlanResponse,
    summary="Plan a local flight",
    description="Returns nearby airports around a center airport within a radius.",
    openapi_extra={
        "requestBody": {
            "content": {
                "application/json": {
                    "example": {
                        "airport": "KSFO",
                        "radius_nm": 25,
                    }
                }
            }
        }
    },
)
def local_plan(req: LocalPlanRequest) -> LocalPlanResponse:
    radius_nm = float(req.radius_nm) if req.radius_nm is not None else 50.0
    planned_at_utc = datetime.now(timezone.utc)

    center = get_airport_coordinates(req.airport)
    if not center:
        raise HTTPException(status_code=404, detail=f"Unknown airport '{req.airport}'")

    center_lat = center.get("latitude")
    center_lon = center.get("longitude")
    if center_lat is None or center_lon is None:
        raise HTTPException(status_code=404, detail=f"Airport '{req.airport}' has no coordinates")

    nearby: List[Dict[str, Any]] = []
    center_icao = str(center.get("icao") or "").upper()
    center_iata = str(center.get("iata") or "").upper()
    center_codes = {c for c in (center_icao, center_iata) if c}

    for airport in load_airport_cache():
        icao_code = str(airport.get("icao") or airport.get("icaoCode") or "").upper()
        iata_code = str(airport.get("iata") or airport.get("iataCode") or "").upper()
        if center_codes and ({c for c in (icao_code, iata_code) if c} & center_codes):
            continue

        lat, lon = _extract_lat_lon(airport)
        if lat is None or lon is None:
            continue

        distance_nm = _haversine_nm(float(center_lat), float(center_lon), float(lat), float(lon))
        if distance_nm > radius_nm:
            continue

        nearby.append(
            {
                "icao": icao_code,
                "iata": iata_code,
                "name": airport.get("name"),
                "city": str(airport.get("city") or ""),
                "country": str(airport.get("country") or ""),
                "latitude": float(lat),
                "longitude": float(lon),
                "elevation": airport.get("elevation"),
                "type": str(airport.get("type") or ""),
                "distance_nm": round(distance_nm, 2),
            }
        )

    nearby.sort(key=lambda a: a["distance_nm"])
    nearby = nearby[:25]

    return LocalPlanResponse(
        planned_at_utc=planned_at_utc,
        airport=req.airport.upper(),
        radius_nm=round(radius_nm, 2),
        center={
            "icao": str(center.get("icao") or ""),
            "iata": str(center.get("iata") or ""),
            "name": center.get("name"),
            "city": str(center.get("city") or ""),
            "country": str(center.get("country") or ""),
            "latitude": float(center_lat),
            "longitude": float(center_lon),
            "elevation": center.get("elevation"),
            "type": str(center.get("type") or ""),
        },
        nearby_airports=nearby,
    )
