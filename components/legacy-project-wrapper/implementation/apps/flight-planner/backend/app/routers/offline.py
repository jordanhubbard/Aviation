"""Explicit public-source package preparation; browser owns private package storage."""

from __future__ import annotations

from datetime import datetime, timezone
import hashlib
import json
import math
import re
import threading
from typing import Annotated, Literal
from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import FileResponse, JSONResponse
from fastapi.routing import APIRoute
from pydantic import AwareDatetime, BaseModel, ConfigDict, Field, model_validator

from ..services.chart_render import pdf_page, raster_info, tile
from ..services.charts import ChartError
from ..models.airport import get_airport
from .aviation_data import RouteBriefingRequest, route_weather
from .flight_plan import get_flight_plan

MAX_PACKAGE = 128 * 1024**2
PREPARING = threading.BoundedSemaphore(1)
Sha = Annotated[str, Field(pattern=r"^[a-f0-9]{64}$")]
Code = Annotated[str, Field(pattern=r"^[A-Za-z0-9]{3,4}$")]


class Input(BaseModel):
    model_config = ConfigDict(extra="forbid", allow_inf_nan=False, str_strip_whitespace=True)


class Selection(Input):
    chart_id: str = Field(pattern=r"^[A-Za-z0-9_-]{1,100}$")
    member: int = Field(default=0, ge=0, le=99, strict=True)
    sha256: Sha
    pdf_pages: list[Annotated[int, Field(ge=1, le=10000, strict=True)]] | None = Field(
        default=None, min_length=1, max_length=128
    )
    coverage: Literal["full-chart", "route-area"] = "full-chart"
    zoom: int = Field(default=8, ge=0, le=12, strict=True)


class Prepare(Input):
    name: str = Field(min_length=1, max_length=100)
    airports: list[Code] | None = Field(default=None, min_length=2, max_length=20)
    saved_plan_id: str | None = Field(default=None, min_length=1, max_length=100)
    charts: list[Selection] = Field(default_factory=list, max_length=4)
    revision_of: str | None = Field(default=None, pattern=r"^offline_[a-f0-9]{32}$")

    @model_validator(mode="after")
    def one_route(self):
        if (self.airports is None) == (self.saved_plan_id is None):
            raise ValueError("Select exactly one of airports or saved_plan_id")
        return self


class Asset(BaseModel):
    id: str
    label: str
    role: Literal["route", "airports", "weather", "chart_original", "chart_preview", "chart_tile"]
    sha256: Sha
    byte_length: int = Field(ge=0, le=MAX_PACKAGE)
    media_type: Literal["application/json", "application/pdf", "image/tiff", "image/png"]
    url: str | None
    inline_text: str | None
    source_url: str | None
    retrieved_at: AwareDatetime | None
    effective_from: AwareDatetime | None = None
    effective_until: AwareDatetime | None = None
    source_sha256: Sha | None = None
    chart_id: str | None = None
    page: int | None = None
    zoom: int | None = None
    x: int | None = None
    y: int | None = None


class ChartPackage(BaseModel):
    chart_id: str
    name: str
    cycle: str
    source_url: str
    source_checked_at: AwareDatetime | None
    verification_state: str
    freshness: str
    effective_from: AwareDatetime | None
    effective_until: AwareDatetime | None
    source_sha256: Sha
    coverage: Literal["pdf-pages", "full-chart", "route-area"]
    pages: list[int] | None = None
    bounds_wgs84: list[float] | None = None
    tile_bounds_wgs84: list[float] | None = None
    zoom: int | None = None
    tile_count: int | None = None
    limitations: str | None = None


class Manifest(BaseModel):
    schema_version: Literal[1] = 1
    id: str
    name: str
    created_at: AwareDatetime
    revision_of: str | None
    route: dict
    assets: list[Asset] = Field(max_length=647)
    charts: list[ChartPackage] = Field(max_length=4)
    total_bytes: int = Field(ge=0, le=MAX_PACKAGE)
    warnings: list[str]
    max_package_bytes: int = MAX_PACKAGE
    private_documents_included: Literal[False] = False


def encoded(value):
    return json.dumps(
        value,
        ensure_ascii=False,
        sort_keys=True,
        separators=(",", ":"),
        allow_nan=False,
        default=str,
    )


def tile_rectangle(bounds, zoom):
    west, south, east, north = bounds
    if not (-180 <= west < east <= 180 and -85.05112878 <= south < north <= 85.05112878):
        raise ChartError(
            "Offline tile bounds must be a non-wrapping rectangle within Web Mercator coverage"
        )
    n = 2**zoom

    def column(lon):
        return max(0, min(n - 1, math.floor((lon + 180) / 360 * n)))

    def row(lat):
        radians = math.radians(lat)
        return max(0, min(n - 1, math.floor((1 - math.asinh(math.tan(radians)) / math.pi) / 2 * n)))

    return (
        column(west),
        row(north),
        column(math.nextafter(east, west)),
        row(math.nextafter(south, north)),
    )


def prepare(body: Prepare, charts):
    now = datetime.now(timezone.utc).isoformat()
    if body.saved_plan_id:
        saved = get_flight_plan(body.saved_plan_id).model_dump(mode="json")
        # Export the selected route, without pilot details or freeform private notes.
        route = {
            k: saved[k]
            for k in (
                "waypoints",
                "route",
                "distance_nm",
                "cruise_altitude_ft",
                "cruise_speed_kt",
                "fuel_required_gal",
            )
        }
        route["saved_plan_id"] = body.saved_plan_id
        route["name"] = saved["metadata"]["name"]
        points = [(w["latitude"], w["longitude"]) for w in saved["waypoints"]]
        codes = list(
            dict.fromkeys(
                c
                for c in [
                    saved["metadata"].get("origin"),
                    *saved["route"],
                    saved["metadata"].get("destination"),
                ]
                if c and re.fullmatch(r"[A-Za-z0-9]{3,4}", c)
            )
        )
        references = [get_airport(c) for c in codes[:20]]
        references = [a for a in references if a]
        if not points:
            points = [(float(a["latitude"]), float(a["longitude"])) for a in references]
        if not 2 <= len(points) <= 100:
            raise HTTPException(422, "Saved route requires 2–100 located waypoints")
        request_arguments = dict(points=points, max_stations=30)
    else:
        codes = [c.upper() for c in body.airports]
        references = [get_airport(c) for c in codes]
        if not all(references):
            raise HTTPException(404, "One or more route airports are unknown")
        points = [(float(a["latitude"]), float(a["longitude"])) for a in references]
        route = {"airports": codes, "points": points}
        request_arguments = dict(airports=codes, max_stations=30)
    if any(
        not math.isfinite(lat)
        or not math.isfinite(lon)
        or not -90 <= lat <= 90
        or not -180 <= lon <= 180
        for lat, lon in points
    ):
        raise HTTPException(422, "Saved route has invalid waypoint coordinates")
    warnings = [
        "Offline source snapshots age normally; reopening a package does not refresh weather."
    ]
    if len(codes) > 20:
        warnings.append(
            "Airport references are limited to the first 20 route identifiers; additional references are not included."
        )
    request = RouteBriefingRequest(**request_arguments)
    try:
        weather = route_weather(request)
    except HTTPException as error:
        weather = {
            "status": "unavailable",
            "error": str(error.detail),
            "stations": [],
            "retrieved_at": now,
        }
        warnings.append(
            "Source weather briefing unavailable; this package does not contain a complete weather briefing."
        )
    if weather.get("partial") or weather.get("truncated") or weather.get("discovery_limited"):
        warnings.append(
            "Source weather briefing has missing, truncated or unlocated coverage; inspect its retained source details."
        )
    assets, chart_records = [], []
    total = 0
    page_count = tile_count = 0

    def asset(
        label,
        role,
        media_type,
        *,
        content=None,
        inline=None,
        url=None,
        key=None,
        size=None,
        **metadata,
    ):
        nonlocal total
        if inline is not None:
            content = inline.encode("utf-8")
        if content is not None:
            key = hashlib.sha256(content).hexdigest()
            size = len(content)
        total += size
        if total > MAX_PACKAGE:
            raise ChartError(
                "Offline package exceeds 128 MiB; select fewer charts or a smaller tile area"
            )
        if content is not None and inline is None:
            with charts.lock:
                charts.save_object(content)
            url = f"/api/offline/assets/{key}"
        assets.append(
            Asset(
                id=f"asset_{len(assets)}",
                label=label,
                role=role,
                media_type=media_type,
                sha256=key,
                byte_length=size,
                inline_text=inline,
                url=url,
                **metadata,
            )
        )

    asset(
        "Route",
        "route",
        "application/json",
        inline=encoded(route),
        source_url=None,
        retrieved_at=now,
    )
    asset(
        "Airport references",
        "airports",
        "application/json",
        inline=encoded(
            {
                "airports": references,
                "source": "Existing suite airport reference catalog; source revision may be unknown",
                "retrieved_at": now,
            }
        ),
        source_url=None,
        retrieved_at=now,
    )
    text = encoded(weather)
    if len(text.encode()) > 2 * 1024**2:
        raise ChartError("Source briefing exceeds offline snapshot limit")
    asset(
        "TAF / METAR source briefing",
        "weather",
        "application/json",
        inline=text,
        source_url="https://aviationweather.gov/",
        retrieved_at=now,
    )
    for selection in body.charts:
        chart = charts.get(selection.chart_id)
        path, member, receipt = charts.member_receipt(
            selection.chart_id, selection.member, selection.sha256
        )
        if path.stat().st_size + total > MAX_PACKAGE:
            raise ChartError(
                "Offline package exceeds 128 MiB; select fewer or smaller chart originals"
            )
        with path.open("rb") as source:
            if hashlib.file_digest(source, "sha256").hexdigest() != selection.sha256:
                raise ChartError("Cached chart original failed integrity validation")
        common = dict(
            source_url=receipt["url"],
            retrieved_at=receipt["at"],
            effective_from=chart["effective_from"],
            effective_until=chart["effective_to"],
            source_sha256=selection.sha256,
            chart_id=selection.chart_id,
        )
        asset(
            member["name"],
            "chart_original",
            "application/pdf" if member["format"] == "pdf" else "image/tiff",
            key=selection.sha256,
            size=path.stat().st_size,
            url=f"/api/charts/{selection.chart_id}/members/{selection.member}?sha256={selection.sha256}",
            **common,
        )
        record = dict(
            chart_id=selection.chart_id,
            name=chart["name"],
            cycle=chart["cycle"],
            source_url=receipt["url"],
            source_checked_at=chart["source_checked_at"],
            verification_state=chart["verification_state"],
            freshness=chart["freshness"],
            effective_from=chart["effective_from"],
            effective_until=chart["effective_to"],
            source_sha256=selection.sha256,
        )
        if member["format"] == "pdf":
            import pypdfium2 as pdfium

            with pdfium.PdfDocument(str(path)) as document:
                count = len(document)
            if count == 0:
                raise ChartError("Chart PDF has no pages to include offline")
            pages = sorted(set(selection.pdf_pages or range(1, count + 1)))
            page_count += len(pages)
            if page_count > 128 or any(p > count for p in pages):
                raise ChartError("Select at most 128 existing PDF pages per package")
            for page in pages:
                content, _ = pdf_page(path, page)
                asset(
                    f"{chart['name']} page {page}",
                    "chart_preview",
                    "image/png",
                    content=content,
                    page=page,
                    **common,
                )
            chart_records.append(ChartPackage(**record, coverage="pdf-pages", pages=pages))
        else:
            info = raster_info(path)
            bounds = info["bounds_wgs84"]
            if selection.coverage == "route-area":
                latitudes, longitudes = list(zip(*points))
                if max(longitudes) - min(longitudes) > 180:
                    raise ChartError(
                        "Route-area packages crossing the antimeridian require separate non-wrapping packages"
                    )
                bounds = [
                    max(bounds[0], min(longitudes) - 0.5),
                    max(bounds[1], min(latitudes) - 0.5),
                    min(bounds[2], max(longitudes) + 0.5),
                    min(bounds[3], max(latitudes) + 0.5),
                ]
            bounds = [
                bounds[0],
                max(-85.05112878, bounds[1]),
                bounds[2],
                min(85.05112878, bounds[3]),
            ]
            left, top, right, bottom = tile_rectangle(bounds, selection.zoom)
            count = (right - left + 1) * (bottom - top + 1)
            tile_count += count
            if tile_count > 512:
                raise ChartError(
                    "Tile selection exceeds 512 tiles; choose a lower zoom or smaller area"
                )
            for x in range(left, right + 1):
                for y in range(top, bottom + 1):
                    asset(
                        f"{chart['name']} tile {selection.zoom}/{x}/{y}",
                        "chart_tile",
                        "image/png",
                        content=tile(path, selection.zoom, x, y),
                        zoom=selection.zoom,
                        x=x,
                        y=y,
                        **common,
                    )
            chart_records.append(
                ChartPackage(
                    **record,
                    coverage=selection.coverage,
                    zoom=selection.zoom,
                    bounds_wgs84=bounds,
                    tile_bounds_wgs84=[
                        left / 2**selection.zoom * 360 - 180,
                        math.degrees(
                            math.atan(
                                math.sinh(math.pi * (1 - 2 * (bottom + 1) / 2**selection.zoom))
                            )
                        ),
                        (right + 1) / 2**selection.zoom * 360 - 180,
                        math.degrees(
                            math.atan(math.sinh(math.pi * (1 - 2 * top / 2**selection.zoom)))
                        ),
                    ],
                    tile_count=count,
                    limitations=info["limitation"],
                )
            )
    return Manifest(
        id="offline_" + uuid4().hex,
        name=body.name.strip(),
        created_at=now,
        revision_of=body.revision_of,
        route=route,
        assets=assets,
        charts=chart_records,
        total_bytes=total,
        warnings=warnings,
    )


def install(app, *, charts):
    class PreparationRoute(APIRoute):
        def get_route_handler(self):
            original = super().get_route_handler()

            async def guarded(request):
                content = bytearray()
                async for block in request.stream():
                    if len(content) + len(block) > 128 * 1024:
                        return JSONResponse(
                            {"detail": "Offline request exceeds 128 KiB"}, status_code=413
                        )
                    content.extend(block)
                request._body = bytes(content)
                if not PREPARING.acquire(blocking=False):
                    return JSONResponse(
                        {"detail": "Another package is being prepared; retry after it finishes"},
                        status_code=429,
                    )
                try:
                    response = await original(request)
                    response.headers["Cache-Control"] = "private, no-store"
                    return response
                finally:
                    PREPARING.release()

            return guarded

    preparations = APIRouter(
        prefix="/api/offline", tags=["offline packages"], route_class=PreparationRoute
    )

    @preparations.post("/prepare", response_model=Manifest)
    def create(body: Prepare, current=Depends(charts)):
        return prepare(body, current)

    router = APIRouter(prefix="/api/offline", tags=["offline packages"])

    @router.get("/assets/{sha256}")
    def public_asset(sha256: Sha, current=Depends(charts)):
        path = current.objects / sha256
        if not path.is_file():
            raise HTTPException(
                404, "Offline rendered asset unavailable; prepare the package again"
            )
        # Only rendered PNGs are public here; inline route/weather/private data is never stored.
        with path.open("rb") as source:
            prefix = source.read(8)
            source.seek(0)
            actual = hashlib.file_digest(source, "sha256").hexdigest()
        if prefix != b"\x89PNG\r\n\x1a\n" or actual != sha256:
            raise HTTPException(422, "Offline rendered asset failed identity/type validation")
        return FileResponse(
            path,
            media_type="image/png",
            headers={
                "X-Content-SHA256": sha256,
                "Cache-Control": "public, max-age=31536000, immutable",
                "X-Content-Type-Options": "nosniff",
                "ETag": f'"{sha256}"',
            },
        )

    app.include_router(preparations)
    app.include_router(router)
