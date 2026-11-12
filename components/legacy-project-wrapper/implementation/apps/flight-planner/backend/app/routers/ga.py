"""General aviation data and deterministic planning operations."""

from __future__ import annotations

import math
import re
from dataclasses import asdict
from typing import Annotated, Literal

from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel, ConfigDict, Field, model_validator

from app.models.airport import get_airport, load_airport_cache
from app.services import ga_data
from aviation.aircraft import (
    AircraftOperatingProfile,
    AircraftTypeDesignatorRecord,
    AIRCRAFT_TYPE_DESIGNATORS,
    C172S_OPERATING_PROFILE,
    C182T_OPERATING_PROFILE,
    SR22_PERSPECTIVE_3600_OPERATING_PROFILE,
    find_aircraft_operating_profile,
    find_aircraft_type_designator,
    AIRCRAFT_TYPE_DESIGNATOR_SEARCH_URL,
)
from aviation import navigation as nav
from aviation.weight_balance import (
    loading_profile_from_mapping,
    LoadingInput,
    LoadingCondition,
    calculate_load,
)

router = APIRouter()
PROFILES = (
    C172S_OPERATING_PROFILE,
    C182T_OPERATING_PROFILE,
    SR22_PERSPECTIVE_3600_OPERATING_PROFILE,
)
REFERENCES = {
    "C172": "https://cessna.txtav.com/en/piston/cessna-skyhawk",
    "C182": "https://cessna.txtav.com/en/piston/cessna-skylane",
    "SR22": "https://cirrusaircraft.com/aircraft/sr-series/",
}
PROFILE_LIMITS = "Bundled manufacturer sea-level reference figures, not predicted takeoff/landing performance for a specific aircraft, load or atmosphere. Use the applicable POH/AFM."
Code = Annotated[str, Field(min_length=2, max_length=16, pattern=r"^[A-Za-z0-9_-]+$")]


class Inputs(BaseModel):
    model_config = ConfigDict(extra="forbid", allow_inf_nan=False)


class Source(BaseModel):
    model_config = ConfigDict(extra="allow")
    provider: str
    url: str | None = None
    retrieved_at_utc: str | None = None
    effective_date: str | None = None


class AircraftCatalogResponse(BaseModel):
    aircraft: list[AircraftTypeDesignatorRecord]
    total_matches: int
    profiles: list[AircraftOperatingProfile]
    limitations: str
    source: Source


class AircraftResponse(BaseModel):
    aircraft: AircraftTypeDesignatorRecord | None
    operating_profile: AircraftOperatingProfile | None
    limitations: str
    source: Source


class FAAFacilityRecord(BaseModel):
    model_config = ConfigDict(extra="allow")
    ARPT_ID: str | None = None
    ICAO_ID: str | None = None
    EFF_DATE: str | None = None
    FUEL_TYPES: str | None = Field(
        default=None,
        description="Published FAA fuel-type codes; not guaranteed current availability or prices",
    )
    OTHER_SERVICES: str | None = Field(
        default=None,
        description="Published FAA service codes, e.g. INSTR instruction, RNTL rental, AVNCS avionics",
    )
    AIRFRAME_REPAIR_SER_CODE: str | None = None
    PWR_PLANT_REPAIR_SER: str | None = None
    TRNS_STRG_HGR_FLAG: str | None = None
    TRNS_STRG_TIE_FLAG: str | None = None
    TWR_TYPE_CODE: str | None = None


class ServicesResponse(BaseModel):
    status: Literal["available", "no_record", "outside_coverage"]
    record: FAAFacilityRecord | None
    source: Source | None = None
    fuel_prices: None = None
    fbo_hours: None = None
    limitations: str


class RunwayEnd(BaseModel):
    ident: str | None
    latitude: float | None
    longitude: float | None
    heading_true_deg: float | None
    displaced_threshold_ft: float | None


class Runway(BaseModel):
    ident: str
    length_ft: float | None
    width_ft: float | None
    surface: str | None
    lighted: bool | None
    closed: bool | None
    ends: list[RunwayEnd]


class Frequency(BaseModel):
    type: str | None
    description: str | None
    frequency_mhz: float | None


class AirportDetailsResponse(BaseModel):
    airport: dict = Field(
        description="SDK airport identity, coordinates in decimal degrees, elevation in feet MSL"
    )
    runways: list[Runway]
    frequencies: list[Frequency]
    services: ServicesResponse
    sources: list[Source]


class GeoFeature(BaseModel):
    model_config = ConfigDict(extra="allow")
    type: Literal["Feature"]
    geometry: dict = Field(description="GeoJSON geometry in WGS84 longitude/latitude order")
    properties: dict


class MapResponse(BaseModel):
    model_config = ConfigDict(extra="allow")
    type: Literal["FeatureCollection"]
    features: list[GeoFeature]
    source: Source


class AviationWeatherResponse(BaseModel):
    status: Literal["available", "no_reports"]
    reports: list[dict] = Field(
        description="Unmodified NOAA records with observation/issue/validity timestamps; full product schemas at https://aviationweather.gov/data/api/"
    )
    source: Source


class PerformanceRequest(Inputs):
    distance_nm: float = Field(ge=0, le=30000)
    true_airspeed_kt: float = Field(gt=0, le=1000)
    true_course_deg: float = Field(ge=0, lt=360)
    wind_from_deg: float = Field(default=0, ge=0, lt=360)
    wind_speed_kt: float = Field(default=0, ge=0, le=500)
    fuel_burn_gph: float = Field(gt=0, le=5000)
    fuel_on_board_gal: float | None = Field(default=None, ge=0, le=50000)
    reserve_minutes: float = Field(
        default=45,
        ge=0,
        le=600,
        description="User-selected planning reserve; not a regulatory compliance assessment.",
    )
    extra_fuel_gal: float = Field(
        default=0,
        ge=0,
        le=50000,
        description="Caller allowance for taxi, climb, alternate or other fuel beyond cruise.",
    )
    indicated_altitude_ft: float | None = Field(default=None, ge=-2000, le=30000)
    altimeter_inhg: float | None = Field(default=None, ge=25, le=35)
    temperature_c: float | None = Field(default=None, ge=-80, le=60)

    @model_validator(mode="after")
    def atmosphere_together(self):
        values = [self.indicated_altitude_ft, self.altimeter_inhg, self.temperature_c]
        if any(v is not None for v in values) and not all(v is not None for v in values):
            raise ValueError("Provide altitude, altimeter and temperature together")
        return self


class PerformanceResponse(BaseModel):
    true_heading_deg: float
    wind_correction_deg: float
    groundspeed_kt: float
    headwind_kt: float
    crosswind_from_right_kt: float
    ete_minutes: float
    trip_fuel_gal: float
    reserve_fuel_gal: float
    total_required_gal: float
    remaining_fuel_gal: float | None
    reserve_satisfied: bool | None
    range_with_reserve_nm: float | None
    endurance_with_reserve_minutes: float | None
    pressure_altitude_ft: float | None
    density_altitude_ft: float | None
    method: str
    limitations: str


class NavlogLeg(PerformanceResponse):
    from_code: str = Field(alias="from")
    to_code: str = Field(alias="to")
    distance_nm: float
    true_course_deg: float


class NavlogResponse(BaseModel):
    legs: list[NavlogLeg]
    distance_nm: float
    ete_minutes: float
    trip_fuel_gal: float
    reserve_fuel_gal: float
    total_required_gal: float
    reserve_satisfied: bool | None
    geometry: dict = Field(description="GeoJSON LineString, WGS84 longitude/latitude")
    limitations: str


@router.post(
    "/performance",
    response_model=PerformanceResponse,
    tags=["performance"],
    summary="Calculate wind, fuel, range and density altitude from explicit inputs",
)
def performance(req: PerformanceRequest) -> dict:
    try:
        gs = nav.ground_speed(
            req.true_airspeed_kt, req.true_course_deg, req.wind_from_deg, req.wind_speed_kt
        )
        wca = nav.wind_correction_angle(
            req.true_airspeed_kt, req.true_course_deg, req.wind_from_deg, req.wind_speed_kt
        )
        head, cross = nav.wind_components(req.wind_from_deg, req.wind_speed_kt, req.true_course_deg)
        hours = nav.flight_time(req.distance_nm, gs)
        trip = nav.fuel_consumption(req.fuel_burn_gph, hours) + req.extra_fuel_gal
        reserve = nav.fuel_reserve(req.fuel_burn_gph, req.reserve_minutes)
        onboard = req.fuel_on_board_gal
        endurance = (
            None
            if onboard is None
            else max(0, onboard - reserve - req.extra_fuel_gal) / req.fuel_burn_gph
        )
        pa = da = None
        if req.indicated_altitude_ft is not None:
            pa = nav.pressure_altitude(req.indicated_altitude_ft, req.altimeter_inhg)
            da = nav.density_altitude(pa, req.temperature_c)
        return {
            "true_heading_deg": (req.true_course_deg + wca) % 360,
            "wind_correction_deg": wca,
            "groundspeed_kt": gs,
            "headwind_kt": head,
            "crosswind_from_right_kt": cross,
            "ete_minutes": hours * 60,
            "trip_fuel_gal": trip,
            "reserve_fuel_gal": reserve,
            "total_required_gal": trip + reserve,
            "remaining_fuel_gal": None if onboard is None else onboard - trip,
            "reserve_satisfied": None if onboard is None else onboard >= trip + reserve,
            "range_with_reserve_nm": None if endurance is None else endurance * gs,
            "endurance_with_reserve_minutes": None if endurance is None else endurance * 60,
            "pressure_altitude_ft": pa,
            "density_altitude_ft": da,
            "method": "aviation.navigation wind triangle, constant cruise fuel flow, ISA/120 ft per C density-altitude approximation",
            "limitations": "True courses/headings, winds FROM true north, knots, NM and US gallons. Constant caller-supplied cruise inputs; include taxi/climb/alternate allowances explicitly. No aircraft-specific takeoff/landing or loading prediction.",
        }
    except ValueError as exc:
        raise HTTPException(422, detail=str(exc)) from exc


@router.get(
    "/aircraft",
    response_model=AircraftCatalogResponse,
    tags=["aircraft"],
    summary="Search aircraft type snapshot and bundled manufacturer profiles",
)
def aircraft_catalog(
    q: str = Query("", max_length=80), limit: int = Query(25, ge=1, le=200)
) -> dict:
    query = q.strip().casefold()
    matches = [
        asdict(r)
        for r in AIRCRAFT_TYPE_DESIGNATORS.values()
        if query in " ".join((r.code, r.manufacturer, r.model)).casefold()
    ]
    return {
        "aircraft": matches[:limit],
        "total_matches": len(matches),
        "profiles": [asdict(p) for p in PROFILES],
        "limitations": PROFILE_LIMITS,
        "source": {
            "provider": "Aviation SDK qualified bundled snapshot",
            "official_type_lookup": AIRCRAFT_TYPE_DESIGNATOR_SEARCH_URL,
            "profile_references": REFERENCES,
        },
    }


@router.get(
    "/aircraft/{identifier}",
    response_model=AircraftResponse,
    tags=["aircraft"],
    summary="Get a type designator or exact bundled operating profile",
)
def aircraft_lookup(identifier: Code) -> dict:
    profile = find_aircraft_operating_profile(identifier)
    record = find_aircraft_type_designator(identifier)
    if not profile and not record:
        raise HTTPException(404, detail="Aircraft not present in the bundled snapshot")
    return {
        "aircraft": asdict(record) if record else None,
        "operating_profile": asdict(profile) if profile else None,
        "limitations": PROFILE_LIMITS,
        "source": {
            "provider": "Aviation SDK qualified bundled snapshot",
            "reference_url": (
                REFERENCES.get(profile.icao_type_designator)
                if profile
                else AIRCRAFT_TYPE_DESIGNATOR_SEARCH_URL
            ),
        },
    }


class NavlogRequest(Inputs):
    airports: list[Code] = Field(min_length=2, max_length=30)
    true_airspeed_kt: float = Field(gt=0, le=1000)
    fuel_burn_gph: float = Field(gt=0, le=5000)
    wind_from_deg: float = Field(default=0, ge=0, lt=360)
    wind_speed_kt: float = Field(default=0, ge=0, le=500)
    reserve_minutes: float = Field(default=45, ge=0, le=600)
    fuel_on_board_gal: float | None = Field(default=None, ge=0, le=50000)
    extra_fuel_gal: float = Field(default=0, ge=0, le=50000)


def lookup(code: str) -> dict:
    airport = get_airport(code)
    if not airport:
        raise HTTPException(404, detail=f"Airport {code} not found")
    if not re.fullmatch(r"[A-Z0-9_-]{2,16}", airport["icao"]):
        raise HTTPException(502, detail="Invalid airport provider identity")
    return airport


@router.post(
    "/navlog",
    response_model=NavlogResponse,
    tags=["plan"],
    summary="Build a multi-leg cross-country navigation log with winds and fuel",
)
def navlog(req: NavlogRequest) -> dict:
    airports = [lookup(code) for code in req.airports]
    legs = []
    for a, b in zip(airports, airports[1:]):
        coords = (a["latitude"], a["longitude"], b["latitude"], b["longitude"])
        distance = nav.haversine_distance(*coords, "NM")
        if distance < 0.001:
            raise HTTPException(422, detail="Consecutive airports must have distinct coordinates")
        course = nav.initial_bearing(*coords)
        result = performance(
            PerformanceRequest(
                distance_nm=distance,
                true_airspeed_kt=req.true_airspeed_kt,
                true_course_deg=course,
                wind_from_deg=req.wind_from_deg,
                wind_speed_kt=req.wind_speed_kt,
                fuel_burn_gph=req.fuel_burn_gph,
                reserve_minutes=0,
            )
        )
        legs.append(
            {
                "from": a["icao"],
                "to": b["icao"],
                "distance_nm": distance,
                "true_course_deg": course,
                **result,
            }
        )
    trip = sum(l["trip_fuel_gal"] for l in legs) + req.extra_fuel_gal
    reserve = nav.fuel_reserve(req.fuel_burn_gph, req.reserve_minutes)
    return {
        "legs": legs,
        "distance_nm": sum(l["distance_nm"] for l in legs),
        "ete_minutes": sum(l["ete_minutes"] for l in legs),
        "trip_fuel_gal": trip,
        "reserve_fuel_gal": reserve,
        "total_required_gal": trip + reserve,
        "reserve_satisfied": (
            None if req.fuel_on_board_gal is None else req.fuel_on_board_gal >= trip + reserve
        ),
        "geometry": {
            "type": "LineString",
            "coordinates": [[a["longitude"], a["latitude"]] for a in airports],
        },
        "limitations": "Direct great-circle legs and constant caller winds/fuel flow; no obstacle/airspace avoidance or clearance assessment. Extra fuel allowances are caller inputs.",
    }


@router.get(
    "/airports/{code}/details",
    response_model=AirportDetailsResponse,
    tags=["airports"],
    summary="Get airport runways, frequencies, and published facility services",
)
def airport_details(code: Code) -> dict:
    try:
        return ga_data.airport_details(lookup(code))
    except ga_data.DataUnavailable as exc:
        raise HTTPException(503, detail=str(exc)) from exc


@router.get(
    "/airports/{code}/services",
    response_model=ServicesResponse,
    tags=["airports"],
    summary="Get published US fuel types, repairs, parking and service codes",
)
def airport_services(code: Code) -> dict:
    airport = lookup(code)
    if airport.get("country") != "US":
        return {
            "status": "outside_coverage",
            "record": None,
            "limitations": "FAA facility services cover United States airports.",
        }
    try:
        return ga_data.airport_facilities(airport["icao"])
    except ga_data.DataUnavailable as exc:
        raise HTTPException(503, detail=str(exc)) from exc


@router.get(
    "/map/{layer}",
    response_model=MapResponse,
    tags=["mapping"],
    summary="Get a bounded airport, navaid or class-airspace GeoJSON map layer",
)
def map_layer(
    layer: Literal["airports", "navaids", "airspace"],
    west: float = Query(ge=-180, le=180),
    south: float = Query(ge=-90, le=90),
    east: float = Query(ge=-180, le=180),
    north: float = Query(ge=-90, le=90),
    limit: int = Query(200, ge=1, le=1000),
    include_closed: bool = False,
) -> dict:
    if (
        not all(math.isfinite(x) for x in (west, south, east, north))
        or south >= north
        or west >= east
    ):
        raise HTTPException(
            422,
            detail="Bounding box must be finite with west < east and south < north; split antimeridian queries",
        )
    if east - west > 20 or north - south > 20:
        raise HTTPException(422, detail="Bounding box limited to 20 degrees per dimension")
    try:
        if layer == "navaids":
            return ga_data.navaids(west, south, east, north)
        if layer == "airspace":
            return ga_data.airspace(west, south, east, north)
    except ga_data.DataUnavailable as exc:
        raise HTTPException(503, detail=str(exc)) from exc
    found = [
        a
        for a in load_airport_cache()
        if west <= a["longitude"] <= east
        and south <= a["latitude"] <= north
        and (include_closed or a.get("type") != "closed")
    ]
    return {
        "type": "FeatureCollection",
        "features": [
            {
                "type": "Feature",
                "id": a["icao"],
                "geometry": {"type": "Point", "coordinates": [a["longitude"], a["latitude"]]},
                "properties": {k: v for k, v in a.items() if k not in {"latitude", "longitude"}},
            }
            for a in found[:limit]
        ],
        "total_matches": len(found),
        "truncated": len(found) > limit,
        "source": {
            "provider": "Aviation SDK bundled airport snapshot",
            "freshness": "Bundled snapshot; not live airport status",
        },
    }


@router.get(
    "/aviation-weather/{product}",
    response_model=AviationWeatherResponse,
    tags=["weather"],
    summary="Get sourced NOAA METAR/TAF, pilot reports or aviation advisories",
)
def aviation_weather(
    product: Literal["metar", "taf", "pirep", "gairmet", "airsigmet"],
    airport: str | None = Query(None, pattern=r"^[A-Za-z0-9]{3,4}$"),
    radius_nm: float = Query(100, ge=1, le=500),
    hours: int = Query(3, ge=1, le=24),
) -> dict:
    params = {}
    if product in {"metar", "taf"}:
        if not airport:
            raise HTTPException(422, detail="Airport station identifier required for METAR/TAF")
        params = {"ids": airport.upper()}
    elif product == "pirep":
        if not airport:
            raise HTTPException(422, detail="Airport required to bound pilot reports")
        params = {"id": airport.upper(), "distance": radius_nm, "age": hours}
    try:
        return ga_data.aviation_weather(product, params)
    except ga_data.DataUnavailable as exc:
        raise HTTPException(503, detail=str(exc)) from exc


class Station(Inputs):
    stationId: str = Field(min_length=1, max_length=80)
    name: str = Field(min_length=1, max_length=80)
    arm: float
    maximumWeight: float | None = Field(default=None, gt=0)


class Envelope(Inputs):
    weight: float = Field(gt=0)
    forward: float
    aft: float


class StationGroup(Inputs):
    name: str = Field(min_length=1, max_length=80)
    stationIds: list[str] = Field(min_length=1, max_length=50)
    maximumWeight: float = Field(gt=0)


class LoadingProfile(Inputs):
    profileId: str = Field(min_length=1, max_length=80)
    aircraftProfileId: str = Field(min_length=1, max_length=80)
    displayName: str = Field(min_length=1, max_length=80)
    emptyWeight: float = Field(gt=0, description="Aircraft-specific empty weight in pounds")
    emptyMoment: float = Field(description="Aircraft-specific empty moment in pound-inches")
    maxGross: float = Field(gt=0)
    usableFuelCapacity: float = Field(gt=0, description="US gallons")
    fuelArm: float = Field(description="Inches from datum")
    fuelDensity: float = Field(gt=0, description="Pounds per US gallon")
    stations: list[Station] = Field(min_length=1, max_length=50)
    stationGroupLimits: list[StationGroup] = Field(default_factory=list, max_length=50)
    envelope: list[Envelope] = Field(min_length=2, max_length=100)


class LoadingRequest(Inputs):
    profile: LoadingProfile
    station_weights_lb: list[float] = Field(min_length=1, max_length=50)
    fuel_gal: float = Field(ge=0)
    fuel_burn_gal: float = Field(ge=0)


class LoadingResponse(BaseModel):
    takeoff: LoadingCondition
    landing: LoadingCondition
    units: dict[str, str]
    limitations: str


@router.post(
    "/performance/weight-balance",
    response_model=LoadingResponse,
    tags=["performance"],
    summary="Calculate takeoff/landing weight and CG using caller aircraft-specific POH/loading records",
)
def weight_balance(req: LoadingRequest) -> dict:
    try:
        profile = loading_profile_from_mapping(req.profile.model_dump())
        result = calculate_load(
            profile, LoadingInput(tuple(req.station_weights_lb), req.fuel_gal, req.fuel_burn_gal)
        )
        return {
            **asdict(result),
            "units": {"weight": "lb", "cg": "inches from caller datum"},
            "limitations": "Computed against caller-supplied aircraft-specific loading records and envelope; no generic empty weight or CG limits are inferred.",
        }
    except (ValueError, TypeError) as exc:
        raise HTTPException(422, detail=str(exc)) from exc


class TFRRecord(BaseModel):
    model_config = ConfigDict(extra="allow")
    notam_id: str
    type: str | None = None
    facility: str | None = None
    state: str | None = None
    description: str | None = None
    creation_date: str | None = None


class TFRResponse(BaseModel):
    restrictions: list[TFRRecord]
    source: Source
    limitations: str


@router.get(
    "/restrictions/tfr",
    response_model=TFRResponse,
    tags=["airspace"],
    summary="Get published FAA TFR summaries, optionally filtered by US state",
)
def temporary_restrictions(state: str | None = Query(None, pattern=r"^[A-Za-z]{2}$")) -> dict:
    try:
        return ga_data.temporary_restrictions(state)
    except ga_data.DataUnavailable as exc:
        raise HTTPException(503, detail=str(exc)) from exc


class PerformanceTablePoint(Inputs):
    pressure_altitude_ft: float = Field(ge=-2000, le=30000)
    temperature_c: float = Field(ge=-80, le=60)
    value: float = Field(gt=0)


class PerformanceTableRequest(Inputs):
    metric: Literal[
        "takeoff_ground_roll_ft",
        "takeoff_over_50ft_ft",
        "landing_ground_roll_ft",
        "landing_over_50ft_ft",
        "climb_rate_fpm",
    ]
    weight_lb: float = Field(
        gt=0,
        description="Weight at which every supplied table value applies; no weight correction is inferred",
    )
    source_reference: str = Field(
        min_length=5,
        max_length=1000,
        description="Caller POH/AFM edition, page/table and aircraft/configuration applicability",
    )
    points: list[PerformanceTablePoint] = Field(
        min_length=4,
        max_length=400,
        description="Complete rectangular altitude/temperature grid from the applicable POH, at one weight/configuration",
    )
    pressure_altitude_ft: float = Field(ge=-2000, le=30000)
    temperature_c: float = Field(ge=-80, le=60)


class PerformanceTableResponse(BaseModel):
    metric: str
    value: float
    weight_lb: float
    source_reference: str
    input_authority: str
    method: str
    limitations: str


@router.post(
    "/performance/table",
    response_model=PerformanceTableResponse,
    tags=["performance"],
    summary="Interpolate caller-supplied POH takeoff, landing or climb tables without extrapolation",
)
def performance_table(req: PerformanceTableRequest) -> dict:
    grid = {(p.pressure_altitude_ft, p.temperature_c): p.value for p in req.points}
    altitudes = sorted({p.pressure_altitude_ft for p in req.points})
    temperatures = sorted({p.temperature_c for p in req.points})
    if (
        len(grid) != len(req.points)
        or len(grid) != len(altitudes) * len(temperatures)
        or min(len(altitudes), len(temperatures)) < 2
    ):
        raise HTTPException(
            422,
            detail="Provide a complete rectangular grid with at least two distinct altitudes and temperatures and no duplicate points",
        )

    def bracket(values, target):
        if not values[0] <= target <= values[-1]:
            raise HTTPException(
                422,
                detail="Requested conditions are outside the supplied POH table; extrapolation is prohibited",
            )
        low, high = next((a, b) for a, b in zip(values, values[1:]) if a <= target <= b)
        return low, high, (target - low) / (high - low)

    a, b, fa = bracket(altitudes, req.pressure_altitude_ft)
    c, d, ft = bracket(temperatures, req.temperature_c)
    value = (1 - fa) * ((1 - ft) * grid[a, c] + ft * grid[a, d]) + fa * (
        (1 - ft) * grid[b, c] + ft * grid[b, d]
    )
    return {
        "metric": req.metric,
        "value": value,
        "weight_lb": req.weight_lb,
        "source_reference": req.source_reference,
        "input_authority": "Caller-supplied table; not independently verified by this service",
        "method": "Bilinear interpolation within the supplied pressure-altitude/temperature grid",
        "limitations": "Applies only at the supplied weight/configuration and table conditions. No runway, wind, slope, surface or obstacle corrections are inferred; apply the applicable POH instructions and margins.",
    }
