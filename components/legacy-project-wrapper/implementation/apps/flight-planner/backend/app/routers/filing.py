"""Private Flight Service API; capabilities never imply verified vendor access."""

import os
from pathlib import Path
import secrets
from typing import Annotated, Any, Literal

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from fastapi.exceptions import RequestValidationError
from fastapi.exception_handlers import request_validation_exception_handler
from fastapi.routing import APIRoute
from fastapi.security import HTTPBearer

from pydantic import StrictInt, StrictBool

from ..services.filing.provider import AccessDenied, Client, Configuration, Unavailable
from ..services.filing.schema import Action, Plan, Strict, Validation, validate
from ..services.filing.store import Conflict, Invalid, Missing, Store
from ..services.filing.workflow import Workflow

PRIVATE = {"Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff"}


class PrivateRoute(APIRoute):
    def get_route_handler(self):
        handler = super().get_route_handler()

        async def guarded(request):
            expected = os.environ.get("FLIGHT_SERVICE_TOKEN", "")
            if len(expected) < 32:
                raise HTTPException(
                    503, "Private Flight Service access is not configured", headers=PRIVATE
                )
            supplied = request.headers.get("authorization", "")
            if not secrets.compare_digest(supplied.encode(), ("Bearer " + expected).encode()):
                raise HTTPException(
                    401,
                    "Flight Service credential required",
                    headers={**PRIVATE, "WWW-Authenticate": "Bearer"},
                )
            body = bytearray()
            async for chunk in request.stream():
                if len(body) + len(chunk) > 262_144:
                    raise HTTPException(413, "Flight Service request is too large", headers=PRIVATE)
                body.extend(chunk)
            request._body = bytes(body)
            try:
                response = await handler(request)
            except RequestValidationError as error:
                response = await request_validation_exception_handler(request, error)
            except HTTPException as error:
                error.headers = {**(error.headers or {}), **PRIVATE}
                raise
            except (Conflict, Missing, Invalid, AccessDenied, Unavailable) as error:
                status = (
                    409
                    if isinstance(error, Conflict)
                    else (
                        404
                        if isinstance(error, Missing)
                        else (
                            422
                            if isinstance(error, Invalid)
                            else 403 if isinstance(error, AccessDenied) else 503
                        )
                    )
                )
                raise HTTPException(status, str(error), headers=PRIVATE) from None
            except Exception:
                # Storage/transport internals may contain private paths or pilot
                # input. Return a bounded private error instead of those details.
                raise HTTPException(
                    503,
                    "Flight Service request could not be completed; inspect existing operation receipts before retrying an action",
                    headers=PRIVATE,
                ) from None
            response.headers.update(PRIVATE)
            return response

        return guarded


def workflow(request: Request):
    installed = getattr(request.app.state, "filing_workflow", None)
    if installed is not None:
        return installed
    root = os.environ.get("FLIGHT_SERVICE_DIR") or str(
        Path(os.environ.get("DATA_DIR", "data")) / "flight-service"
    )
    return Workflow(Store(root), Client())


Service = Annotated[Workflow, Depends(workflow)]


class DraftInput(Strict):
    account: str
    plan: Plan


class DraftUpdate(DraftInput):
    revision: StrictInt


class DraftRecord(DraftUpdate):
    id: str
    deleted: int
    created: str
    updated: str


class Prepare(Strict):
    draft_id: str
    revision: StrictInt
    action: Action
    filing_id: str | None = None
    inputs: dict[str, str] = {}


class Review(Strict):
    confirmation_token: str
    expires_at: str
    action: Action
    environment: str
    draft_revision: int
    plan: Plan
    provider_state: str | None
    version_stamp: str | None
    provider_fields: dict[str, str]
    warnings: list[str]
    provider_mutation_sent: Literal[False]
    changed_fields: list[str]


class Execute(Strict):
    confirmation_token: str
    idempotency_key: str
    action: Action
    environment: Literal["lab", "production"]


class Operation(Strict):
    id: str
    draft_id: str
    filing_id: str | None
    action: Action
    environment: str
    status: Literal["unknown", "accepted", "rejected", "resolved"]
    response: dict[str, Any] | None
    source: dict[str, Any] | None
    created: str
    updated: str
    reconcile_after: float


def operation(value):
    return {key: value[key] for key in Operation.model_fields}


class Reconcile(Strict):
    resolution: Literal["applied", "not_applied"]
    reference: str
    operator_attestation: StrictBool
    provider_id: str | None = None


class Filing(Strict):
    id: str
    draft_id: str
    account: str
    provider_id: str
    environment: str
    revision: StrictInt
    submitted: Plan
    snapshot: dict[str, Any] | None
    source: dict[str, Any] | None
    updated: str


class AccountCheck(Strict):
    account: str


class AccountResult(Strict):
    read_access: Literal["verified", "rejected"]
    filing_authorization: Literal["not_established"]
    response: dict[str, Any]
    source: dict[str, Any]


class Audit(Strict):
    sequence: int
    scope: str
    event: str
    details: dict[str, Any]
    recorded_at: str


class Deleted(Strict):
    deleted: Literal[True]


class Capabilities(Strict):
    provider: str
    environment: Literal["lab", "production"] | None
    configured: bool
    production_approval_attested: bool
    provider_access_verified: Literal[False]
    pilot_authorization: Literal["not_checked"]
    actions: dict[str, list[Action]]
    automatic_polling: Literal[False]
    automatic_mutation_retries: Literal[False]
    private_api_configured: bool


router = APIRouter(
    prefix="/api/filing",
    tags=["Flight Service"],
    route_class=PrivateRoute,
    dependencies=[Depends(HTTPBearer(auto_error=False, scheme_name="FlightServiceBearer"))],
)


@router.post("/validate", response_model=Validation)
def validation(body: Plan):
    return validate(body)


@router.post("/drafts", response_model=DraftRecord, status_code=201)
def create_draft(body: DraftInput, service: Service):
    return service.store.draft(body.account, body.plan.model_dump(mode="json"))


@router.get("/drafts", response_model=list[DraftRecord])
def drafts(service: Service, limit: int = Query(50, ge=1, le=100), offset: int = Query(0, ge=0)):
    return service.store.listing("drafts", limit=limit, offset=offset)


@router.get("/drafts/{draft_id}", response_model=DraftRecord)
def draft(draft_id: str, service: Service):
    return service.store.get("drafts", draft_id)


@router.put("/drafts/{draft_id}", response_model=DraftRecord)
def update_draft(draft_id: str, body: DraftUpdate, service: Service):
    return service.store.draft(
        body.account, body.plan.model_dump(mode="json"), key=draft_id, revision=body.revision
    )


@router.delete("/drafts/{draft_id}", response_model=Deleted)
def delete_draft(draft_id: str, revision: int, service: Service):
    service.store.delete_draft(draft_id, revision)
    return {"deleted": True}


@router.post("/account/check", response_model=AccountResult)
def account_check(body: AccountCheck, service: Service):
    reply = service.provider.summaries(body.account)
    return {
        "read_access": "verified" if reply.body["returnStatus"] else "rejected",
        "filing_authorization": "not_established",
        "response": reply.body,
        "source": reply.source,
    }


@router.get("/filings", response_model=list[Filing])
def filings(service: Service, limit: int = Query(50, ge=1, le=100), offset: int = Query(0, ge=0)):
    return service.store.listing("filings", limit=limit, offset=offset)


@router.get("/drafts/{draft_id}/filing", response_model=Filing | None)
def draft_filing(draft_id: str, service: Service):
    with service.store.transaction() as db:
        service.store.row(db, "drafts", draft_id)
        row = db.execute("SELECT id FROM filings WHERE draft_id=?", (draft_id,)).fetchone()
        return service.store.row(db, "filings", row[0]) if row else None


@router.get("/filings/{filing_id}", response_model=Filing)
def filing(filing_id: str, service: Service):
    return service.store.get("filings", filing_id)


@router.post("/filings/{filing_id}/refresh", response_model=Filing)
def refresh(filing_id: str, service: Service):
    return service.refresh(filing_id)


@router.post("/actions/prepare", response_model=Review)
def prepare(body: Prepare, service: Service):
    return service.prepare(
        body.draft_id, body.revision, body.action, filing_id=body.filing_id, inputs=body.inputs
    )


@router.post("/actions/execute", response_model=Operation)
def execute(body: Execute, service: Service):
    return operation(
        service.execute(
            body.confirmation_token, body.idempotency_key, body.action, body.environment
        )
    )


@router.get("/operations", response_model=list[Operation])
def operations(
    service: Service, limit: int = Query(50, ge=1, le=100), offset: int = Query(0, ge=0)
):
    return [
        operation(row) for row in service.store.listing("operations", limit=limit, offset=offset)
    ]


@router.get("/operations/{operation_id}", response_model=Operation)
def receipt(operation_id: str, service: Service):
    return operation(service.store.get("operations", operation_id))


@router.post("/operations/{operation_id}/reconcile", response_model=Operation)
def reconcile(operation_id: str, body: Reconcile, service: Service):
    return operation(
        service.reconcile(
            operation_id,
            body.resolution,
            body.reference,
            operator_attestation=body.operator_attestation,
            provider_id=body.provider_id,
        )
    )


@router.get("/audit/{scope}", response_model=list[Audit])
def audit(
    scope: str, service: Service, after: int = Query(0, ge=0), limit: int = Query(100, ge=1, le=100)
):
    return service.store.history(scope, after=after, limit=limit)


def install(app):
    @app.middleware("http")
    async def private_headers(request, call_next):
        private = (
            request.url.path.startswith("/api/filing/")
            and request.url.path != "/api/filing/capabilities"
        )
        response = await call_next(request)
        if private:
            response.headers.update(PRIVATE)
        return response

    @app.get("/api/filing/capabilities", tags=["Flight Service"], response_model=Capabilities)
    def capabilities():
        result = Configuration.load().capabilities()
        result["private_api_configured"] = len(os.environ.get("FLIGHT_SERVICE_TOKEN", "")) >= 32
        return result

    app.include_router(router)
