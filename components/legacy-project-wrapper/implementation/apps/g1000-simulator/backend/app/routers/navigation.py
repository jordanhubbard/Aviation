"""Typed, read-only G1000 adapter to the shared planning navigation API.

FAA ingestion, source verification and SDK catalog selection stay with planning.
No provider fetch occurs at startup and no sample data substitutes for a failure.
"""

from __future__ import annotations

import os
import re
from typing import Any, Literal
from urllib.parse import quote, urlsplit

import httpx
from fastapi import APIRouter, Depends, HTTPException, Path, Query
from pydantic import BaseModel, ConfigDict


class WireModel(BaseModel):
    model_config = ConfigDict(strict=True, extra="allow", allow_inf_nan=False)


class NavigationLeg(WireModel):
    fix: str
    path_type: str | None
    altitude_constraint: str | None
    speed_constraint: str | None
    altitude_ft: float | None
    course_deg: float | None


class NavigationProcedure(WireModel):
    identifier: str
    airport_icao: str
    procedure_type: Literal["SID", "STAR", "APPROACH"]
    runway: str | None
    initial_altitude_ft: float | None
    transitions: list[str]
    legs: list[NavigationLeg]


class ProviderRecord(WireModel):
    fields: dict[str, str]
    raw: str
    primary: bool


class ProcedureSource(WireModel):
    id: str
    route_type: str
    records: list[ProviderRecord]
    omitted_from_common_legs: int
    usage: str


class SourcedProcedure(WireModel):
    record: NavigationProcedure
    provider: ProcedureSource


class CycleSource(WireModel):
    cycle: str
    url: str
    effective_from: str
    effective_to: str
    retrieved_at: str
    records_sha256: str
    freshness: str
    verification_state: str
    source_checked_at: str | None


class NavigationResult(WireModel):
    airport: str
    procedures: list[SourcedProcedure]
    total: int
    page: int
    limit: int
    status: dict[str, Any]
    source: CycleSource
    parse_receipt: dict[str, Any]
    navaids: list[dict[str, Any]]
    limitations: str


class NavigationService:
    def __init__(self, base_url: str | None = None, *, transport=None):
        self.base_url = (
            base_url
            or os.environ.get("AVIATION_PLANNING_BASE_URL")
            or "https://meta-app.jordanhubbard.net/api/v1/planning"
        ).rstrip("/")
        parsed = urlsplit(self.base_url)
        if (
            parsed.scheme not in {"https", "http"}
            or not parsed.hostname
            or parsed.username
            or parsed.password
            or parsed.query
            or parsed.fragment
        ):
            raise ValueError(
                "Invalid planning service URL; use an HTTP(S) origin/base path without credentials"
            )
        self.transport = transport

    async def read(
        self, airport, *, page=1, limit=25, procedure_type=None, runway=None, query=None
    ):
        airport = airport.strip().upper()
        if not re.fullmatch(r"[A-Z0-9]{3,4}", airport):
            raise HTTPException(
                422, "Enter a published three- or four-character airport identifier"
            )
        params = {"page": page, "limit": limit}
        for name, value in (
            ("procedure_type", procedure_type),
            ("runway", runway),
            ("query", query),
        ):
            if value is not None:
                params[name] = value
        try:
            async with httpx.AsyncClient(
                timeout=httpx.Timeout(30, connect=5),
                follow_redirects=False,
                transport=self.transport,
                trust_env=False,
            ) as client:
                async with client.stream(
                    "GET",
                    self.base_url + "/api/navigation/" + quote(airport, safe=""),
                    params=params,
                    headers={"Accept": "application/json", "Accept-Encoding": "identity"},
                ) as response:
                    if response.status_code != 200:
                        raise HTTPException(
                            503,
                            f"FAA navigation service unavailable (HTTP {response.status_code}); current procedure coverage is unverified",
                        )
                    if (
                        response.headers.get("content-type", "").split(";", 1)[0]
                        != "application/json"
                    ):
                        raise ValueError("Navigation response is not JSON")
                    if response.headers.get("content-encoding", "identity").lower() != "identity":
                        raise ValueError("Navigation response must use identity encoding")
                    body = bytearray()
                    async for chunk in response.aiter_bytes(chunk_size=65536):
                        body.extend(chunk)
                        if len(body) > 16 * 1024 * 1024:
                            raise ValueError("Navigation response exceeds the bounded reader")
            value = NavigationResult.model_validate_json(body)
            if (
                value.airport != airport
                or value.page != page
                or value.limit != limit
                or value.total < len(value.procedures)
                or len(value.procedures) > limit
                or value.total < 0
                or len(value.procedures) != max(0, min(limit, value.total - (page - 1) * limit))
                or any(p.record.airport_icao != airport for p in value.procedures)
                or (
                    procedure_type
                    and any(p.record.procedure_type != procedure_type for p in value.procedures)
                )
            ):
                raise ValueError("Navigation result scope or pagination mismatch")
            if (
                value.source.freshness != "current"
                or value.source.verification_state != "verified"
                or not value.source.source_checked_at
            ):
                raise HTTPException(
                    503,
                    "FAA navigation cycle is not verified current; refresh the shared chart sources",
                )
            return value
        except httpx.HTTPError:
            raise HTTPException(
                503,
                "FAA navigation service could not be read; current procedure coverage is unverified",
            ) from None
        except ValueError:
            raise HTTPException(
                502,
                "FAA navigation service returned invalid data; no procedure coverage is claimed",
            ) from None


class LegacyProcedure(WireModel):
    name: str
    type: str
    runway: str | None
    initial_altitude: float | None
    waypoints: list[str]


class LegacyProcedures(WireModel):
    airport: dict[str, Any] | None
    airport_identifier: str
    sids: list[LegacyProcedure]
    stars: list[LegacyProcedure]
    approaches: list[LegacyProcedure]
    navigation: NavigationResult
    note: str


def build_navigation_router(service=None):
    router = APIRouter(prefix="/api", tags=["Sourced navigation"])
    source = service or NavigationService()

    @router.get("/navigation/{airport}", response_model=NavigationResult)
    async def read_navigation(
        airport: str = Path(pattern=r"^[A-Za-z0-9]{3,4}$"),
        page: int = Query(default=1, ge=1, le=1000),
        limit: int = Query(default=25, ge=1, le=50),
        procedure_type: Literal["SID", "STAR", "APPROACH"] | None = None,
        runway: str | None = Query(
            default=None, min_length=1, max_length=5, pattern=r"^[A-Za-z0-9]+$"
        ),
        query: str | None = Query(default=None, max_length=100),
    ):
        return await source.read(
            airport,
            page=page,
            limit=limit,
            procedure_type=procedure_type,
            runway=runway,
            query=query,
        )

    @router.get("/procedures/{airport}", response_model=LegacyProcedures)
    async def legacy_procedures(value: NavigationResult = Depends(read_navigation)):
        from aviation.airports import AirportDatabase
        from app.services.nav_database import _airport_dict

        airport = AirportDatabase().get_airport_coordinates(value.airport)

        def selected(kind):
            return [
                {
                    "name": p.record.identifier,
                    "type": p.record.procedure_type,
                    "runway": p.record.runway,
                    "initial_altitude": p.record.initial_altitude_ft,
                    "waypoints": [leg.fix for leg in p.record.legs],
                }
                for p in value.procedures
                if p.record.procedure_type == kind
            ]

        return {
            "airport": _airport_dict(airport) if airport else None,
            "airport_identifier": value.airport,
            "sids": selected("SID"),
            "stars": selected("STAR"),
            "approaches": selected("APPROACH"),
            "navigation": value,
            "note": "This is one sourced page, not a complete procedure database. Pagination, cycle verification, raw constraints and guidance limitations are in navigation. No flight plan is activated.",
        }

    return router
