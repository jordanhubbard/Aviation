from __future__ import annotations

from fastapi import APIRouter, HTTPException, Query

from app.models.airport import get_airport_coordinates, search_airports_advanced


router = APIRouter()


@router.get(
    "/airports/search",
    summary="Search airports",
    description="Search by text query and/or proximity (lat/lon/radius).",
)
def airports_search(
    q: str | None = Query(None),
    limit: int = Query(20, ge=1, le=50),
    lat: float | None = Query(None),
    lon: float | None = Query(None),
    radius_nm: float | None = Query(None, ge=0.1),
) -> list[dict]:
    """Search airports by text query and/or proximity."""
    if not q and (lat is None or lon is None):
        raise HTTPException(status_code=400, detail="q is required unless lat/lon are provided")
    return search_airports_advanced(query=q, limit=limit, lat=lat, lon=lon, radius_nm=radius_nm)


@router.get(
    "/airports/{code}",
    summary="Get airport by code",
    description="Look up an airport by ICAO/IATA code.",
)
def airport_lookup(code: str) -> dict:
    """Look up an airport by ICAO/IATA code."""
    airport = get_airport_coordinates(code)
    if not airport:
        raise HTTPException(status_code=404, detail=f"Airport {code} not found")
    return airport


@router.get(
    "/airport/{code}",
    summary="Get airport by code (legacy)",
    description="Legacy alias for /airports/{code}.",
)
def airport_lookup_legacy(code: str) -> dict:
    """Legacy alias for /airports/{code}."""
    return airport_lookup(code)
