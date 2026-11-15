"""Source discovery and route-level aviation data, shared by HTTP and MCP."""

from __future__ import annotations

from datetime import datetime
from enum import IntEnum
from typing import Annotated, Literal

from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel, ConfigDict, Field, model_validator

from app.config import settings
from app.models.airport import get_airport
from app.services import aviation_sources as sources, route_briefing
from app.services import ga_data
from app.routers.ga import Source

router = APIRouter(tags=["aviation data"])
Latitude = Annotated[float, Field(ge=-90, le=90)]
Longitude = Annotated[float, Field(ge=-180, le=180)]
AirportCode = Annotated[str, Field(pattern=r"^[A-Za-z0-9]{3,4}$")]
Point = tuple[Latitude, Longitude]
Resource = Literal["airports", "airspaces", "navaids", "reporting-points", "hotspots", "obstacles"]


class PressureLevel(IntEnum):
    HPA1000 = 1000
    HPA925 = 925
    HPA850 = 850
    HPA700 = 700
    HPA500 = 500
    HPA300 = 300
    HPA250 = 250
    HPA200 = 200


class Inputs(BaseModel):
    model_config = ConfigDict(extra="forbid", allow_inf_nan=False)


class RouteBriefingRequest(Inputs):
    airports: list[AirportCode] | None = Field(default=None, min_length=2, max_length=50)
    points: list[Point] | None = Field(
        default=None,
        min_length=2,
        max_length=100,
        description="WGS84 [latitude, longitude] pairs, in route order",
    )
    corridor_nm: float = Field(default=25, ge=1, le=100)
    max_stations: int = Field(default=50, ge=1, le=100)
    include_metars: bool = True
    valid_at: datetime | None = Field(
        default=None,
        description="Optional timezone-aware UTC/offset validity instant; never a request to invent future forecasts",
    )

    @model_validator(mode="after")
    def route_shape(self):
        if (self.airports is None) == (self.points is None):
            raise ValueError("Provide exactly one of airports or points")
        if self.airports and len({a.upper() for a in self.airports}) > self.max_stations:
            raise ValueError("max_stations must include every unique requested airport")
        if self.valid_at and (self.valid_at.tzinfo is None or self.valid_at.utcoffset() is None):
            raise ValueError("valid_at must include a timezone")
        return self


class Reports(BaseModel):
    status: Literal["available", "no_reports", "unavailable"]
    reports: list[dict] = Field(
        description="Original NOAA records, including rawTAF/rawOb and structured forecast periods/timestamps"
    )
    source: Source
    error: str | None = None
    truncated: bool = False


class StationMatch(BaseModel):
    station_id: str
    name: str | None = None
    latitude: float
    longitude: float
    products: list[str]
    requested_airport: bool
    distance_from_route_nm: float
    along_route_nm: float
    closest_leg: int = Field(description="Zero-based index of the nearest route leg")


class StationWeather(StationMatch):
    taf: Reports
    metar: Reports | None
    valid_at_status: Literal["not_requested", "valid", "outside_validity", "unknown"]
    periods_at_time: list[dict] = Field(
        description="Unmodified overlapping NOAA periods with station IDs, including concurrent TEMPO/PROB groups"
    )


class ResolvedAirport(BaseModel):
    requested_code: str
    station_id: str
    latitude: float
    longitude: float


class StationCatalogSource(Source):
    freshness: str | None = None
    total_catalog_records: int | None = None
    excluded_unlocated_count: int = 0
    unlocated_taf_station_ids: list[str] = Field(default_factory=list)


class RouteBriefingResponse(BaseModel):
    resolved_airports: list[ResolvedAirport] = Field(default_factory=list)
    points: list[Point]
    route_distance_nm: float
    corridor_nm: float
    valid_at: datetime | None
    stations: list[StationWeather]
    total_matching_stations: int
    truncated: bool
    partial: bool
    discovery_limited: bool = Field(
        description="Some TAF-capable stations in NOAA metadata have unknown coordinates; see source.unlocated_taf_station_ids"
    )
    source: StationCatalogSource
    limitations: str


class StationDiscoveryResponse(BaseModel):
    stations: list[StationMatch]
    total_matching_stations: int
    truncated: bool
    source: StationCatalogSource


class CollectionResponse(BaseModel):
    status: Literal["available", "no_reports"]
    records: list[dict] = Field(
        description="Original provider records, geometry, units, timestamps and missing values"
    )
    truncated: bool
    source: Source
    limitations: str


class OpenAIPResponse(CollectionResponse):
    page: int
    next_page: int | None
    total_count: int


class ForecastResponse(BaseModel):
    data: dict = Field(
        description="Original NWS GeoJSON forecast and provider periods, units and timestamps"
    )
    source: Source
    limitations: str


class WindsResponse(BaseModel):
    data: dict = Field(
        description="Original Open-Meteo hourly pressure-level arrays, UTC timestamps, units and nulls"
    )
    levels_hpa: list[int]
    source: Source
    limitations: str


class SourceEntry(BaseModel):
    id: str
    provider: str
    coverage: str
    authentication: str
    configured: bool
    operations: list[str]
    documentation_url: str
    license: str
    limitations: str


class SourcesResponse(BaseModel):
    sources: list[SourceEntry]
    limitations: str


def unavailable(operation, *args):
    try:
        return operation(*args)
    except ga_data.DataUnavailable as exc:
        raise HTTPException(503, detail=str(exc)) from exc


@router.post(
    "/aviation-weather/route",
    response_model=RouteBriefingResponse,
    summary="Get TAFs and METARs for requested airports and reporting stations along a route",
)
def route_weather(req: RouteBriefingRequest):
    requested = []
    resolved = []
    if req.airports:
        points = []
        for code in req.airports:
            code = code.upper()
            airport = get_airport(code)
            if not airport:
                raise HTTPException(404, detail=f"Unknown route airport: {code}")
            point = (float(airport["latitude"]), float(airport["longitude"]))
            points.append(point)
            station_id = (airport.get("icao") or code).upper()
            requested.append((station_id, point))
            resolved.append(
                {
                    "requested_code": code,
                    "station_id": station_id,
                    "latitude": point[0],
                    "longitude": point[1],
                }
            )
    else:
        points = list(req.points)
    try:
        result = unavailable(
            route_briefing.briefing,
            points,
            requested,
            req.corridor_nm,
            req.max_stations,
            req.include_metars,
            req.valid_at,
        )
        result["resolved_airports"] = resolved
        return result
    except ValueError as exc:
        raise HTTPException(422, detail=str(exc)) from exc


@router.get(
    "/aviation-weather/stations",
    response_model=StationDiscoveryResponse,
    summary="Discover nearby NOAA reporting stations, optionally TAF-only",
)
def stations(
    lat: Latitude,
    lon: Longitude,
    radius_nm: float = Query(50, ge=1, le=200),
    taf_only: bool = True,
    limit: int = Query(50, ge=1, le=200),
):
    from aviation.navigation import distance_nm

    catalog, source = unavailable(sources.station_catalog)
    matches = []
    legs, _ = route_briefing.route_legs([(lat, lon), (lat, lon)])
    for station in catalog:
        if not station.get("icaoId") or (taf_only and "TAF" not in station["siteType"]):
            continue
        if distance_nm(lat, lon, station["lat"], station["lon"]) <= radius_nm:
            matches.append(route_briefing.station_match(station, legs))
    matches.sort(key=lambda row: (row["distance_from_route_nm"], row["station_id"]))
    return {
        "stations": matches[:limit],
        "total_matching_stations": len(matches),
        "truncated": len(matches) > limit,
        "source": source,
    }


@router.get(
    "/aviation-weather/winds-aloft",
    response_model=WindsResponse,
    summary="Get modeled winds and temperatures at pressure levels (Open-Meteo)",
)
def winds_aloft(
    lat: Latitude,
    lon: Longitude,
    levels_hpa: list[PressureLevel] = Query(default=[850, 700, 500], min_length=1, max_length=8),
    hours: int = Query(24, ge=1, le=72),
):
    return unavailable(sources.winds_aloft, lat, lon, levels_hpa, hours)


@router.get(
    "/aviation-data/openaip/{resource}",
    response_model=OpenAIPResponse,
    summary="Query bounded, paginated openAIP reference data with server-side credentials",
)
def openaip(
    resource: Resource,
    country: str | None = Query(None, pattern=r"^[A-Za-z]{2}$"),
    search: str | None = Query(None, min_length=3, max_length=80),
    page: int = Query(1, ge=1, le=10000),
    limit: int = Query(100, ge=1, le=1000),
):
    if not country and not (search and search.strip()):
        raise HTTPException(422, detail="Bound the query with country or search")
    return unavailable(sources.openaip, resource, country, search, page, limit)


@router.get(
    "/aviation-data/nws/alerts",
    response_model=CollectionResponse,
    summary="Get active NWS alerts for a US point or state/territory",
)
def nws_alerts(
    lat: Latitude | None = None,
    lon: Longitude | None = None,
    area: str | None = Query(None, pattern=r"^[A-Za-z]{2}$"),
    limit: int = Query(500, ge=1, le=500),
):
    if (lat is None) != (lon is None) or ((lat is not None) == (area is not None)):
        raise HTTPException(422, detail="Provide a latitude/longitude pair or an area, exclusively")
    return unavailable(sources.nws_alerts, lat, lon, area, limit)


@router.get(
    "/aviation-data/nws/forecast",
    response_model=ForecastResponse,
    summary="Get an NWS point surface forecast with original units and periods",
)
def nws_forecast(lat: Latitude, lon: Longitude, hourly: bool = True):
    return unavailable(sources.nws_forecast, lat, lon, hourly)


@router.get(
    "/aviation-data/faa/airport-events",
    response_model=CollectionResponse,
    summary="Get FAA NAS ground stops, delays, closures and other airport-event summaries",
)
def airport_events(airport_id: str | None = Query(None, pattern=r"^[A-Za-z0-9]{3,4}$")):
    return unavailable(sources.airport_events, airport_id)


@router.get(
    "/aviation-data/sources",
    response_model=SourcesResponse,
    summary="Discover aviation data sources, API operations, coverage and configuration readiness",
)
def source_catalog():
    rows = [
        (
            "noaa-awc",
            "NOAA Aviation Weather Center",
            "Global stations/METAR/TAF; PIREP/advisory coverage varies",
            "none",
            True,
            [
                "POST /api/aviation-weather/route",
                "GET /api/aviation-weather/stations",
                "GET /api/aviation-weather/{product}",
            ],
            "https://aviationweather.gov/data/api/",
            "US government public data",
            "NOAA rate/result limits apply. Route results explicitly report station caps and partial failures.",
        ),
        (
            "openaip",
            "openAIP",
            "Worldwide community-contributed reference data",
            "OPENAIP_API_KEY (server-side)",
            bool(settings.openaip_api_key),
            ["GET /api/aviation-data/openaip/{resource}"],
            "https://docs.openaip.net/",
            sources.LICENSE,
            "Attribution and noncommercial terms apply. Explicit pagination; not certified navigation or complete obstacle data.",
        ),
        (
            "nws",
            "NOAA National Weather Service",
            "United States and covered territories",
            "none",
            True,
            [
                "GET /api/aviation-data/nws/alerts",
                "GET /api/aviation-data/nws/forecast",
            ],
            "https://www.weather.gov/documentation/services-web-api",
            "US government public data",
            "Point surface forecasts/alerts are distinct from aviation TAFs and winds aloft.",
        ),
        (
            "faa-nas",
            "FAA NAS Status",
            "United States NAS airport events",
            "none",
            True,
            ["GET /api/aviation-data/faa/airport-events"],
            "https://nasstatus.faa.gov/",
            "US government public data",
            "Published event summaries, not the complete NOTAM service.",
        ),
        (
            "faa-tfr",
            "FAA temporary flight restrictions",
            "United States",
            "none",
            True,
            ["GET /api/restrictions/tfr"],
            "https://tfr.faa.gov/",
            "US government public data",
            "Published TFR list, not a complete NOTAM briefing or route intersection analysis.",
        ),
        (
            "faa-aeronautical",
            "FAA AIS / NASR via US DOT NTAD",
            "United States",
            "none",
            True,
            ["GET /api/map/{layer}", "GET /api/airports/{code}/details"],
            "https://ais-faa.opendata.arcgis.com/",
            "US government public data",
            "Preserve effective dates, service codes and unknown values; no guaranteed current fuel availability.",
        ),
        (
            "ourairports",
            "OurAirports",
            "Worldwide bundled airports and published runway/frequency data",
            "none",
            True,
            ["GET /api/map/{layer}", "GET /api/airports/{code}/details"],
            "https://ourairports.com/data/",
            "Public domain",
            "Reference data; snapshot/fetch dates are not live airport status.",
        ),
        (
            "open-meteo",
            "Open-Meteo",
            "Global weather and elevation with provider coverage limits",
            "none",
            True,
            [
                "GET /api/weather/{code}/forecast",
                "POST /api/weather/route",
                "POST /api/terrain/profile",
                "GET /api/aviation-weather/winds-aloft",
            ],
            "https://open-meteo.com/en/docs",
            "See provider attribution and usage terms",
            "Numerical forecasts are distinct from TAFs. Terrain fallback providers and unknown values are explicit.",
        ),
        (
            "openweathermap",
            "OpenWeatherMap",
            "Global current weather",
            "OPENWEATHERMAP_API_KEY (server-side)",
            bool(settings.openweather_api_key),
            ["GET /api/weather/{code}"],
            "https://openweathermap.org/current",
            "Registered plan and provider terms",
            "Optional METAR enrichment; cloud percentage is not an observed ceiling.",
        ),
    ]
    names = [
        "id",
        "provider",
        "coverage",
        "authentication",
        "configured",
        "operations",
        "documentation_url",
        "license",
        "limitations",
    ]
    return {
        "sources": [dict(zip(names, row)) for row in rows],
        "limitations": "Configuration readiness is not a live availability check. See OpenAPI for full operation schemas. Complete FAA NOTAM access requires separately approved credentials; no mock NOTAM fallback is used by these operations.",
    }
