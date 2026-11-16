"""Current FAA charts/navigation through the existing planning HTTP/MCP boundary."""

from __future__ import annotations

import os
import secrets
from typing import Any, Literal

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from fastapi.responses import FileResponse, Response
from fastapi.security import HTTPBearer
from fastapi.routing import APIRoute
from pydantic import BaseModel

from ..services.charts import Charts, ChartError
from ..services.aircraft_library.discovery import AcquisitionError
from ..services.chart_render import raster_info, tile, pdf_page
from ..services.navigation_cycle import navigation


class ChartRecord(BaseModel):
    id: str
    name: str
    family: Literal["terminal", "vfr", "ifr"]
    kind: str
    format: Literal["pdf", "pdf_zip", "geotiff"]
    url: str
    airport: str | None = None
    icao: str | None = None
    faa_ident: str | None = None
    airport_name: str | None = None
    state: str | None = None
    cycle: str
    effective_from: str | None
    effective_to: str | None
    freshness: Literal["current", "expired", "future", "undated", "withdrawn"]
    source: str
    record: dict[str, Any]
    cached: dict[str, Any] | None
    original_url: str


class Catalog(BaseModel):
    charts: list[ChartRecord]
    total: int
    page: int
    limit: int
    source_status: dict[str, Any]


class DownloadRequest(BaseModel):
    force: bool = False


class NavigationLeg(BaseModel):
    fix: str
    path_type: str | None
    altitude_constraint: str | None
    speed_constraint: str | None
    altitude_ft: float | None
    course_deg: float | None


class NavigationProcedure(BaseModel):
    identifier: str
    airport_icao: str
    procedure_type: Literal["SID", "STAR", "APPROACH"]
    runway: str | None
    initial_altitude_ft: float | None
    transitions: list[str]
    legs: list[NavigationLeg]


class ProviderRecord(BaseModel):
    fields: dict[str, str]
    raw: str
    primary: bool


class ProcedureSource(BaseModel):
    id: str
    route_type: str
    records: list[ProviderRecord]
    omitted_from_common_legs: int
    usage: str


class SourcedProcedure(BaseModel):
    record: NavigationProcedure
    provider: ProcedureSource


class NavigationResult(BaseModel):
    airport: str
    procedures: list[SourcedProcedure]
    total: int
    page: int
    limit: int
    status: dict[str, Any]
    source: dict[str, Any]
    parse_receipt: dict[str, Any]
    navaids: list[dict[str, Any]]
    limitations: str


def install(app, *, store=None):
    selected = [store]

    def charts():
        if selected[0] is None:
            selected[0] = Charts()
        return selected[0]

    async def operator(request: Request):
        expected = os.environ.get("AVIATION_CHARTS_TOKEN") or os.environ.get(
            "AIRCRAFT_LIBRARY_TOKEN", ""
        )
        if len(expected) < 32:
            raise HTTPException(503, "Chart cache management requires an operator credential")
        if not secrets.compare_digest(
            request.headers.get("authorization", "").encode(), ("Bearer " + expected).encode()
        ):
            raise HTTPException(
                401, "Chart operator credential required", headers={"WWW-Authenticate": "Bearer"}
            )

    class OperatorRoute(APIRoute):
        def get_route_handler(self):
            handler = super().get_route_handler()

            async def guarded(request):
                await operator(request)
                body = bytearray()
                async for chunk in request.stream():
                    if len(body) + len(chunk) > 16384:
                        raise HTTPException(413, "Chart management request is too large")
                    body.extend(chunk)
                request._body = bytes(body)
                return await handler(request)

            return guarded

    router = APIRouter(prefix="/api/charts", tags=["FAA charts"])
    management = APIRouter(
        prefix="/api/charts",
        tags=["FAA charts"],
        route_class=OperatorRoute,
        dependencies=[Depends(HTTPBearer(auto_error=False))],
    )

    @router.get("/status")
    def status(current: Charts = Depends(charts)) -> dict[str, Any]:
        return current.status()

    @management.post("/refresh")
    def refresh(current: Charts = Depends(charts)) -> dict[str, Any]:
        return current.refresh()

    @router.get("/catalog", response_model=Catalog)
    def catalog(
        airport: str | None = Query(default=None, max_length=4),
        query: str = Query(default="", max_length=100),
        family: Literal["terminal", "vfr", "ifr"] | None = None,
        freshness: Literal["current", "expired", "future", "undated", "withdrawn"] | None = None,
        page: int = Query(default=1, ge=1, le=1000),
        limit: int = Query(default=40, ge=1, le=100),
        current: Charts = Depends(charts),
    ):
        return current.search(
            airport=airport, query=query, family=family, freshness=freshness, page=page, limit=limit
        )

    @router.get("/{chart_id}", response_model=ChartRecord)
    def detail(chart_id: str, current: Charts = Depends(charts)):
        return current.get(chart_id)

    @management.post("/{chart_id}/download", response_model=ChartRecord)
    def download(chart_id: str, body: DownloadRequest, current: Charts = Depends(charts)):
        return current.acquire(chart_id, force=body.force)

    def file_headers(key):
        return {
            "ETag": '"' + key + '"',
            "X-Content-SHA256": key,
            "X-Content-Type-Options": "nosniff",
            "Cache-Control": "public, no-cache",
        }

    @router.get("/{chart_id}/original")
    def original(chart_id: str, current: Charts = Depends(charts)):
        chart = current.get(chart_id)
        if not chart["cached"]:
            raise HTTPException(
                404, "Chart is not cached; use the FAA source link or download first"
            )
        receipt = chart["cached"]
        return FileResponse(
            current.objects / receipt["sha256"],
            media_type="application/pdf" if chart["format"] == "pdf" else "application/zip",
            filename=chart_id + (".pdf" if chart["format"] == "pdf" else ".zip"),
            headers=file_headers(receipt["sha256"]),
        )

    @router.get("/{chart_id}/members/{number}")
    def member(
        chart_id: str, number: int, sha256: str | None = None, current: Charts = Depends(charts)
    ):
        path, record = current.member(chart_id, number, sha256)
        return FileResponse(
            path,
            media_type="application/pdf" if record["format"] == "pdf" else "image/tiff",
            filename=record["name"],
            content_disposition_type="inline",
            headers=file_headers(record["sha256"]),
        )

    @router.get("/{chart_id}/members/{number}/info")
    def member_info(
        chart_id: str, number: int, sha256: str | None = None, current: Charts = Depends(charts)
    ) -> dict[str, Any]:
        path, record = current.member(chart_id, number, sha256)
        if record["format"] == "geotiff":
            return {**record, **raster_info(path)}
        import pypdfium2 as pdfium

        with pdfium.PdfDocument(str(path)) as document:
            return {**record, "pages": len(document)}

    @router.get("/{chart_id}/members/{number}/preview/{page}.png")
    def preview(
        chart_id: str,
        number: int,
        page: int,
        sha256: str | None = None,
        current: Charts = Depends(charts),
    ):
        path, record = current.member(chart_id, number, sha256)
        if record["format"] != "pdf":
            raise HTTPException(422, "This chart is a raster; use map tiles")
        content, pages = pdf_page(path, page)
        return Response(
            content,
            media_type="image/png",
            headers={**file_headers(record["sha256"]), "X-PDF-Pages": str(pages)},
        )

    @router.get("/{chart_id}/members/{number}/tiles/{zoom}/{x}/{y}.png")
    def raster_tile(
        chart_id: str,
        number: int,
        zoom: int,
        x: int,
        y: int,
        sha256: str | None = None,
        current: Charts = Depends(charts),
    ):
        path, record = current.member(chart_id, number, sha256)
        if record["format"] != "geotiff":
            raise HTTPException(422, "This chart has no GeoTIFF tile layer")
        return Response(
            tile(path, zoom, x, y), media_type="image/png", headers=file_headers(record["sha256"])
        )

    @router.get("/{chart_id}/offline-manifest")
    def offline_manifest(chart_id: str, current: Charts = Depends(charts)) -> dict[str, Any]:
        chart = current.get(chart_id)
        return {
            "chart": chart,
            "acquired": chart["cached"] is not None,
            "files": (
                [
                    {**m, "url": f"/api/charts/{chart_id}/members/{index}?sha256={m['sha256']}"}
                    for index, m in enumerate(chart["cached"]["members"])
                ]
                if chart["cached"]
                else []
            ),
            "note": "Verify SHA-256 when creating an offline package; preserve effective dates and retrieval time.",
        }

    nav = APIRouter(prefix="/api/navigation", tags=["FAA navigation cycles"])

    @nav.get("/{airport}", response_model=NavigationResult)
    def navdata(
        airport: str,
        procedure_type: Literal["SID", "STAR", "APPROACH"] | None = None,
        runway: str | None = Query(default=None, max_length=5),
        page: int = Query(default=1, ge=1, le=1000),
        limit: int = Query(default=25, ge=1, le=50),
        query: str | None = Query(default=None, max_length=100),
        current: Charts = Depends(charts),
    ) -> dict[str, Any]:
        return navigation(
            current,
            airport,
            procedure_type=procedure_type,
            runway=runway,
            page=page,
            limit=limit,
            query=query,
        )

    @app.exception_handler(ChartError)
    async def chart_error(request, error):
        from fastapi.responses import JSONResponse

        return JSONResponse({"detail": str(error)}, status_code=422)

    @app.exception_handler(AcquisitionError)
    async def acquisition_error(request, error):
        from fastapi.responses import JSONResponse

        return JSONResponse({"detail": str(error)}, status_code=503)

    app.include_router(router)
    app.include_router(management)
    app.include_router(nav)
    return selected
