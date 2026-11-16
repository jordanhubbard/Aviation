"""Private original-backed performance operations for HTTP/MCP consumers."""

import os
from fastapi import APIRouter, Depends, Query, Request
from fastapi.security import HTTPBearer
from .aircraft_library import PrivateRoute
from ..schemas.aircraft_performance import (
    DatasetDraft,
    DatasetList,
    DatasetRecord,
    Calculation,
    Review,
    Retirement,
    Result,
    Capabilities,
    AXIS_UNITS,
    METRIC_UNITS,
)
from ..services.aircraft_library.store import Store
from ..services.aircraft_performance import Registry


def install(app, *, library=None):
    state = {"registry": None}

    def registry():
        if state["registry"] is None:
            state["registry"] = Registry(
                library
                or Store(os.environ.get("AIRCRAFT_LIBRARY_DIR", "/app/data/aircraft-library"))
            )
        return state["registry"]

    router = APIRouter(
        prefix="/api/aircraft-performance",
        tags=["Sourced aircraft performance"],
        route_class=PrivateRoute,
        dependencies=[Depends(HTTPBearer(auto_error=False))],
    )

    @router.get(
        "/capabilities",
        response_model=Capabilities,
        operation_id="aircraft_performance_capabilities",
    )
    def capabilities():
        return {
            "metrics": METRIC_UNITS,
            "axes": AXIS_UNITS,
            "requires_explicit_review": True,
            "extrapolation": False,
            "model_provider_required": False,
            "privacy": "private single-operator library",
            "max_points_per_table": 400,
            "correction_scope": "Percent changes apply to this table's current metric; other-metric/additive basis rules are unavailable and must not be approximated as multipliers",
            "limitations": "Operator-reviewed source transcriptions are not manufacturer or aircraft dispatch approval",
        }

    @router.post(
        "/datasets",
        response_model=DatasetRecord,
        status_code=201,
        operation_id="aircraft_performance_create_dataset",
    )
    def create(body: DatasetDraft, current: Registry = Depends(registry)):
        return current.create(body)

    @router.get(
        "/datasets", response_model=DatasetList, operation_id="aircraft_performance_list_datasets"
    )
    def catalog(
        icao: str = Query(min_length=2, max_length=4),
        registration: str | None = None,
        variant: str | None = None,
        revision: str | None = None,
        offset: int = Query(0, ge=0, le=100000),
        limit: int = Query(25, ge=1, le=100),
        current: Registry = Depends(registry),
    ):
        return current.list(
            icao,
            registration=registration,
            variant=variant,
            revision=revision,
            offset=offset,
            limit=limit,
        )

    @router.get(
        "/datasets/{dataset_id}",
        response_model=DatasetRecord,
        operation_id="aircraft_performance_get_dataset",
    )
    def get(dataset_id: str, current: Registry = Depends(registry)):
        return current.get(dataset_id)

    @router.post(
        "/datasets/{dataset_id}/review",
        response_model=DatasetRecord,
        operation_id="aircraft_performance_review_dataset",
    )
    def review(dataset_id: str, body: Review, current: Registry = Depends(registry)):
        return current.review(dataset_id, body)

    @router.post(
        "/datasets/{dataset_id}/retire",
        response_model=DatasetRecord,
        operation_id="aircraft_performance_retire_dataset",
    )
    def retire(dataset_id: str, body: Retirement, current: Registry = Depends(registry)):
        return current.retire(dataset_id, body)

    @router.post(
        "/datasets/{dataset_id}/calculate",
        response_model=Result,
        operation_id="aircraft_performance_calculate",
    )
    def calculate(dataset_id: str, body: Calculation, current: Registry = Depends(registry)):
        return current.calculate(dataset_id, body)

    @app.middleware("http")
    async def private_responses(request: Request, call_next):
        response = await call_next(request)
        if request.url.path.startswith("/api/aircraft-performance/"):
            response.headers["Cache-Control"] = "private, no-store"
            response.headers["X-Content-Type-Options"] = "nosniff"
        return response

    app.include_router(router)
