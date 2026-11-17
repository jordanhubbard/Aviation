"""Credential-free cache reads shared by native HTTP, legacy consumers and MCP."""

import json
import os
from pathlib import Path
import re
import sqlite3
from urllib.parse import urlencode

from fastapi import APIRouter, HTTPException, Query, Response

from ..schemas.notams import NMSCapabilities, NMSDetail, NMSReports
from ..services.nms_cache import NMSCache, utc
from ..services.nms_client import NMSUnavailable, ORIGINS
from aviation.notam import categorize_notam_severity

CAUTION = "Exact source location matching and source-provided aliases; not an en-route intersection assessment or complete NOTAM briefing."


def selection():
    environment = os.environ.get("FAA_NMS_ENVIRONMENT")
    if environment not in ORIGINS:
        return None, None
    root = os.environ.get("FAA_NMS_CACHE_DIR")
    if not root:
        data = os.environ.get("DATA_DIR") or Path(__file__).resolve().parents[2] / "data"
        root = Path(data) / "nms" / environment
    return environment, Path(root)


def install(app, *, cache=None):
    router = APIRouter(prefix="/api/notams", tags=["NOTAMs"])

    def current():
        if cache is not None:
            return cache
        environment, root = selection()
        if root is None or not (root / "notams.sqlite3").is_file():
            raise NMSUnavailable("NMS cache is not configured or not yet initialized")
        return NMSCache(root, environment, read_only=True)

    def unavailable(environment, locations, offset, limit):
        return dict(
            snapshot_id=None,
            status="unavailable",
            environment=environment,
            production_data=False,
            complete_snapshot=False,
            requested_locations=locations,
            matched_locations=locations,
            source=dict(
                provider="FAA NMS",
                url=ORIGINS[environment] + "/nmsapi/v1/notams" if environment else None,
                retrieved_at_utc=None,
                environment=environment,
            ),
            synchronized_at=None,
            full_load_at=None,
            incomplete_records=0,
            total=0,
            offset=offset,
            limit=limit,
            next_offset=None,
            notams=[],
            warnings=[CAUTION]
            + (
                ["Non-production feed: may include test NOTAMs."]
                if environment and environment != "production"
                else []
            ),
            error="NMS cache unavailable; this is not an empty NOTAM briefing",
        )

    def projection(row, *, preview=True):
        text = row["text"]
        raw = row["feature"]["properties"]["coreNOTAMData"]["notam"]
        reference = {
            key: raw.get(key) if isinstance(raw.get(key), str) and len(raw[key]) <= 128 else None
            for key in ("number", "series", "year")
        }
        return dict(
            id=row["id"],
            **reference,
            location=row["location"],
            icao_location=row["icao_location"] or None,
            text=text[:2000] if text and preview else text,
            text_length=len(text or ""),
            text_truncated=bool(preview and text and len(text) > 2000),
            detail_url="/api/notams/detail?" + urlencode({"id": row["id"]}),
            classification=row["classification"],
            type=row["type"],
            effective_start_utc=(
                utc(row["effective_start"]) if row["effective_start"] is not None else None
            ),
            effective_end_utc=(
                utc(row["effective_end"]) if row["effective_end"] is not None else None
            ),
            cancelled_at_utc=utc(row["cancelled_at"]) if row["cancelled_at"] is not None else None,
            last_updated_utc=utc(row["last_updated"]),
            permanent=row["permanent"],
            estimated=row["estimated"],
            schedule=row["schedule"],
            activity=row["activity"],
            missing_fields=row["missing_fields"],
            severity=categorize_notam_severity(text) if text else None,
        )

    def metadata(result):
        environment = result["environment"]
        return dict(
            environment=environment,
            production_data=result["production_data"] and result["complete_snapshot"],
            source=dict(
                provider="FAA NMS",
                url=ORIGINS[environment] + "/nmsapi/v1/notams",
                retrieved_at_utc=result["synchronized_at"],
                environment=environment,
            ),
            warnings=[*result["limitations"], CAUTION],
        )

    @router.get("/capabilities", response_model=NMSCapabilities, operation_id="notams_capabilities")
    def capabilities(response: Response):
        response.headers["Cache-Control"] = "no-store"
        environment, root = selection()
        if cache is not None:
            environment, root = cache.environment, cache.root
        return dict(
            environment=environment,
            cache_present=bool(root and (root / "notams.sqlite3").is_file()),
            coverage=CAUTION,
            warnings=(
                ["Non-production feed: may include test NOTAMs."]
                if environment and environment != "production"
                else []
            ),
        )

    @router.get(
        "",
        response_model=NMSReports,
        operation_id="notams_reports",
        summary="Read cached FAA NMS NOTAM location reports",
        description="Exact source location matching with explicit source freshness, partial/missing fields and environment. No FAA credentials or upstream calls are needed. This is not a complete route NOTAM briefing.",
    )
    def reports(
        response: Response,
        airport: str = Query(min_length=2, max_length=899),
        include_inactive: bool = False,
        offset: int = Query(0, ge=0, le=250000),
        limit: int = Query(50, ge=1, le=100),
        snapshot_id: str | None = Query(None, pattern=r"^[a-f0-9]{64}$"),
    ):
        locations = sorted(set(p.strip().upper() for p in airport.split(",")))
        if not 1 <= len(locations) <= 100 or any(
            not re.fullmatch(r"[A-Z0-9]{2,8}", v) for v in locations
        ):
            raise HTTPException(
                422, detail="Provide 1 to 100 comma-separated source location identifiers"
            )
        environment = cache.environment if cache is not None else selection()[0]
        try:
            result = current().query(
                locations, include_inactive=include_inactive, offset=offset, limit=limit
            )
            if snapshot_id and snapshot_id != result["snapshot_id"]:
                raise HTTPException(409, detail="NMS snapshot changed; reload the reports")
            status = result["status"]
            if status == "available" and result["total"] == 0:
                status = "no_reports"
            value = dict(
                snapshot_id=result["snapshot_id"],
                status=status,
                **metadata(result),
                complete_snapshot=result["complete_snapshot"],
                requested_locations=result["requested_locations"],
                matched_locations=result["matched_locations"],
                synchronized_at=result["synchronized_at"],
                full_load_at=result["full_load_at"],
                incomplete_records=result["incomplete_records"],
                total=result["total"],
                offset=offset,
                limit=limit,
                next_offset=(
                    offset + len(result["notams"])
                    if offset + len(result["notams"]) < result["total"]
                    else None
                ),
                notams=[projection(row) for row in result["notams"]],
                error=result["last_error"],
            )
        except (NMSUnavailable, ValueError, KeyError, sqlite3.Error, OSError):
            value = unavailable(environment, locations, offset, limit)
        response.headers["Cache-Control"] = "no-store"
        return value

    @router.get("/detail", response_model=NMSDetail, operation_id="notams_detail")
    def detail(
        response: Response,
        id: str = Query(min_length=1, max_length=128),
        snapshot_id: str | None = Query(None, pattern=r"^[a-f0-9]{64}$"),
    ):
        try:
            store = current()
            row = store.detail(id)
            if row is None:
                raise HTTPException(404, detail="NOTAM identity is not in this cached snapshot")
            coverage = store.query([row["location"]], limit=1)
            if coverage["snapshot_id"] != row["snapshot_id"] or (
                snapshot_id and snapshot_id != row["snapshot_id"]
            ):
                raise HTTPException(409, detail="NMS snapshot changed; reload the notice")
            value = dict(
                snapshot_id=row["snapshot_id"],
                status=coverage["status"],
                **metadata(coverage),
                notice=projection(row, preview=False),
                source_feature=row["feature"],
            )
            if len(json.dumps(value, allow_nan=False).encode()) > 16 * 1024 * 1024:
                raise NMSUnavailable("NOTAM detail exceeds its response bound")
        except (NMSUnavailable, ValueError, KeyError, sqlite3.Error, OSError):
            raise HTTPException(
                503,
                detail="NMS detail unavailable; cached source has not been replaced with sample data",
            ) from None
        response.headers["Cache-Control"] = "no-store"
        return value

    @app.middleware("http")
    async def no_cache(request, call_next):
        response = await call_next(request)
        if request.url.path == "/api/notams" or request.url.path.startswith("/api/notams/"):
            response.headers["Cache-Control"] = "no-store"
            response.headers["X-Content-Type-Options"] = "nosniff"
        return response

    app.include_router(router)
