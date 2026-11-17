"""Authenticated aircraft document API, discoverable through the planning gateway."""

from __future__ import annotations

from contextlib import asynccontextmanager
import os
import secrets
from typing import Any, Literal

from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, Request, UploadFile
from fastapi.responses import FileResponse
from fastapi.routing import APIRoute
from fastapi.security import HTTPBearer
from pydantic import BaseModel, Field
from starlette.concurrency import run_in_threadpool

from ..services.aircraft_library import pdf
from ..services.aircraft_library.models import Models, ModelUnavailable, ask
from ..services.aircraft_library.store import Store, metadata
from ..services.aircraft_library.worker import Worker
from ..services.aircraft_library.discovery import Search, validate_url


class PrivateRoute(APIRoute):
    def get_route_handler(self):
        handler = super().get_route_handler()

        async def guarded(request: Request):
            expected = os.environ.get("AIRCRAFT_LIBRARY_TOKEN", "")
            if len(expected) < 32:
                raise HTTPException(503, "Aircraft library access is not configured")
            supplied = request.headers.get("authorization", "")
            if not secrets.compare_digest(supplied.encode(), ("Bearer " + expected).encode()):
                raise HTTPException(
                    401,
                    "Aircraft library credential required",
                    headers={"WWW-Authenticate": "Bearer"},
                )
            limit = (
                pdf.MAX_PDF_BYTES + 1_000_000
                if request.url.path.endswith("/documents") and request.method == "POST"
                else 1_000_000
            )
            body = bytearray()
            async for chunk in request.stream():
                if len(body) + len(chunk) > limit:
                    raise HTTPException(413, "Aircraft library request is too large")
                body.extend(chunk)
            # Authenticate and bound the body before multipart parsing/spooling.
            request._body = bytes(body)
            try:
                response = await handler(request)
            except ValueError as error:
                raise HTTPException(422, str(error)) from error
            except ModelUnavailable as error:
                raise HTTPException(503, str(error)) from error
            response.headers["Cache-Control"] = "private, no-store"
            response.headers["X-Content-Type-Options"] = "nosniff"
            return response

        return guarded


class DocumentMetadata(BaseModel):
    icao: str = Field(min_length=2, max_length=4)
    title: str = Field(default="", max_length=500)
    kind: str = "POH"
    manufacturer: str = Field(default="", max_length=200)
    model: str = Field(default="", max_length=200)
    variant: str = Field(default="", max_length=200)
    revision: str = Field(default="", max_length=200)
    serial_applicability: str = Field(default="", max_length=2000)
    tails: list[str] = Field(default_factory=list, max_length=100)
    scope: str = ""
    notes: str = Field(default="", max_length=2000)


class DiscoveryRequest(BaseModel):
    metadata: DocumentMetadata
    maximum: int = Field(default=30, ge=1, le=200)


class Question(BaseModel):
    icao: str
    question: str = Field(min_length=1, max_length=4000)
    registration: str | None = None
    variant: str | None = None
    revision: str | None = None
    document_ids: list[str] | None = Field(default=None, max_length=100)


class AcquisitionRequest(BaseModel):
    metadata: DocumentMetadata
    urls: list[str] = Field(min_length=1, max_length=200)


class AcquisitionSource(BaseModel):
    filename: str
    url: str | None
    retrieved_at: str
    provenance: dict[str, Any]


class Extraction(BaseModel):
    status: Literal["indexed", "partial"]
    page_count: int
    incomplete_pages: list[int]
    extractor: str
    characters: int
    encryption: str | None = None


class DocumentRecord(BaseModel):
    id: str
    sha256: str
    icao: str
    metadata: DocumentMetadata
    created_at: str
    status: Literal["stored", "indexed", "partial", "failed"]
    extraction: Extraction | None
    error: str | None
    sources: list[AcquisitionSource]
    artifacts: dict[str, Any]
    original_url: str


class DocumentList(BaseModel):
    documents: list[DocumentRecord]


class JobSubject(BaseModel):
    document_id: str | None
    icao: str
    title: str


class JobSummary(BaseModel):
    id: str
    kind: str
    state: Literal["queued", "running", "completed", "failed"]
    error: str | None
    created_at: str
    updated_at: str
    subject: JobSubject | None = None
    has_result: bool = False


class JobRecord(JobSummary):
    request: dict[str, Any]
    result: dict[str, Any] | None


class JobList(BaseModel):
    jobs: list[JobSummary]
    total: int
    limit: int
    offset: int
    next_offset: int | None


class UploadResult(BaseModel):
    document: DocumentRecord
    job: JobRecord


class DocumentPage(BaseModel):
    document_id: str
    page: int
    label: str
    text: str
    method: Literal["text", "ocr", "missing"]
    error: str | None


class Passage(BaseModel):
    passage_id: int
    document_id: str
    page: int
    label: str
    offset: int
    text: str
    method: str
    rank: float | None = None


class SearchResult(BaseModel):
    passages: list[Passage]


class Citation(BaseModel):
    document_id: str
    page: int
    label: str
    passage_id: int
    quote: str
    method: str
    original_url: str


class Claim(BaseModel):
    text: str
    citations: list[Citation]


class Answer(BaseModel):
    insufficient_evidence: bool
    reason: str
    claims: list[Claim]
    model: str | None = None
    generated_at: str | None = None
    warnings: list[str] = Field(default_factory=list)
    retrieval: Literal["no_evidence", "full_text", "hybrid"]
    documents: list[dict[str, Any]] = Field(default_factory=list)
    applicability: str | None = None


def install(app, *, store=None, models=None, worker_enabled=True):
    state = {"store": store, "models": models, "worker": None}

    def library():
        if state["store"] is None:
            state["store"] = Store(
                os.environ.get("AIRCRAFT_LIBRARY_DIR", "/app/data/aircraft-library")
            )
        if state["models"] is None:
            state["models"] = Models()
        return state["store"]

    def start():
        if len(os.environ.get("AIRCRAFT_LIBRARY_TOKEN", "")) >= 32 and worker_enabled:
            library()
            state["worker"] = Worker(state["store"], state["models"])
            state["worker"].start()

    def close():
        if state["worker"]:
            state["worker"].close()

    @asynccontextmanager
    async def lifespan(_):
        start()
        try:
            yield
        finally:
            close()

    router = APIRouter(
        prefix="/api/aircraft-library",
        tags=["Aircraft document library"],
        route_class=PrivateRoute,
        dependencies=[Depends(HTTPBearer(auto_error=False))],
        lifespan=lifespan,
    )

    @router.get("/capabilities")
    def capabilities(current: Store = Depends(library)):
        import shutil

        return {
            **state["models"].capabilities(),
            "pdf": True,
            "ocr": bool(shutil.which("tesseract")),
            "max_pdf_bytes": pdf.MAX_PDF_BYTES,
            "max_pages": pdf.MAX_PAGES,
            "search": Search().capabilities(),
            "privacy": "private single-operator library",
            "types": current.types(),
        }

    @router.post("/documents", status_code=202, response_model=UploadResult)
    async def upload(
        file: UploadFile = File(...),
        metadata_json: str = Form(...),
        current: Store = Depends(library),
    ):
        values = metadata(DocumentMetadata.model_validate_json(metadata_json).model_dump())
        data = await file.read(pdf.MAX_PDF_BYTES + 1)
        document = await run_in_threadpool(
            current.ingest, data, values, filename=file.filename or "document.pdf", extract=False
        )
        job = current.create_job("index", {"document_id": document["id"]})
        return {"document": document, "job": job}

    @router.get("/documents", response_model=DocumentList)
    def documents(
        icao: str = Query(min_length=2, max_length=4),
        registration: str | None = None,
        variant: str | None = None,
        revision: str | None = None,
        current: Store = Depends(library),
    ):
        return {
            "documents": current.list(
                icao, registration=registration, variant=variant, revision=revision
            )
        }

    def required(current, document_id):
        document = current.get(document_id)
        if document is None:
            raise HTTPException(404, "Document not found")
        return document

    @router.get("/documents/{document_id}", response_model=DocumentRecord)
    def document(document_id: str, current: Store = Depends(library)):
        return required(current, document_id)

    @router.put("/documents/{document_id}/metadata", response_model=DocumentRecord)
    def document_metadata(
        document_id: str, body: DocumentMetadata, current: Store = Depends(library)
    ):
        required(current, document_id)
        return current.update_metadata(document_id, body.model_dump())

    @router.get("/documents/{document_id}/original")
    def original(document_id: str, current: Store = Depends(library)):
        document = required(current, document_id)
        return FileResponse(
            current.original(document_id),
            media_type="application/pdf",
            filename=f"{document['icao']}-{document['sha256'][:12]}.pdf",
            content_disposition_type="attachment",
        )

    @router.get("/documents/{document_id}/pages/{number}", response_model=DocumentPage)
    def page(document_id: str, number: int, current: Store = Depends(library)):
        required(current, document_id)
        result = current.page(document_id, number)
        if result is None:
            raise HTTPException(404, "Page not found or not yet extracted")
        return result

    @router.post("/documents/{document_id}/jobs/{kind}", status_code=202, response_model=JobRecord)
    def document_job(document_id: str, kind: str, current: Store = Depends(library)):
        required(current, document_id)
        if kind not in {"index", "distill", "embed"}:
            raise HTTPException(422, "Job must be index, distill or embed")
        if (
            kind in {"distill", "embed"}
            and not state["models"].capabilities()["llm" if kind == "distill" else "embeddings"]
        ):
            raise HTTPException(503, "Required model is not configured")
        return current.create_job(kind, {"document_id": document_id})

    @router.post("/discovery", status_code=202, response_model=JobRecord)
    def discovery(body: DiscoveryRequest, current: Store = Depends(library)):
        values = metadata(body.metadata.model_dump())
        if not Search().capabilities()["configured"]:
            raise HTTPException(503, "Configure Brave Search or SearXNG for web discovery")
        # Do not accept invalid metadata into a queue for later ambiguous failure.
        return current.create_job("discover", {"metadata": values, "maximum": body.maximum})

    @router.post("/acquisitions", status_code=202, response_model=JobRecord)
    def acquisitions(body: AcquisitionRequest, current: Store = Depends(library)):
        values = metadata(body.metadata.model_dump())
        for url in body.urls:
            validate_url(url)
        return current.create_job(
            "acquire", {"metadata": values, "urls": body.urls, "maximum": len(body.urls)}
        )

    @router.get("/jobs", response_model=JobList)
    def jobs(
        limit: int = Query(default=20, ge=1, le=100),
        offset: int = Query(default=0, ge=0, le=1_000_000),
        current: Store = Depends(library),
    ):
        return current.jobs(limit, offset)

    @router.get("/jobs/{job_id}", response_model=JobRecord)
    def job(job_id: str, current: Store = Depends(library)):
        result = current.job(job_id)
        if result is None:
            raise HTTPException(404, "Library job not found")
        return result

    @router.post("/search", response_model=SearchResult)
    def search(body: Question, current: Store = Depends(library)):
        values = body.model_dump()
        question, code = values.pop("question"), values.pop("icao")
        return {"passages": current.search(code, question, **values)}

    @router.post("/ask", response_model=Answer)
    def question(body: Question, current: Store = Depends(library)):
        values = body.model_dump()
        question, code = values.pop("question"), values.pop("icao")
        return ask(current, state["models"], code, question, **values)

    app.include_router(router)
    return state
