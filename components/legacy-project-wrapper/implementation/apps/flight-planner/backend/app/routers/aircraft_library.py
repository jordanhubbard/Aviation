"""Authenticated aircraft document API, discoverable through the planning gateway."""

from __future__ import annotations

from contextlib import asynccontextmanager
import os
import secrets
from typing import Annotated, Any, Literal

from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, Request, UploadFile
from fastapi.responses import FileResponse, Response
from fastapi.exceptions import RequestValidationError
from fastapi.exception_handlers import request_validation_exception_handler
from fastapi.routing import APIRoute
from fastapi.security import HTTPBearer
from pydantic import BaseModel, ConfigDict, Field, StrictBool
from starlette.concurrency import run_in_threadpool

from ..services.aircraft_library import pdf
from ..services.aircraft_library import ocr_reviews
from ..services.aircraft_library import transcriptions
from ..services.aircraft_library.models import Models, ModelUnavailable, ask
from ..services.aircraft_library.store import BlankReviewConflict, Store, metadata
from ..services.aircraft_library.worker import Worker
from ..services.aircraft_library.discovery import Search, validate_url


class PrivateRoute(APIRoute):
    def get_route_handler(self):
        handler = super().get_route_handler()

        async def guarded(request: Request):
            private_headers = {
                "Cache-Control": "private, no-store",
                "X-Content-Type-Options": "nosniff",
            }
            expected = os.environ.get("AIRCRAFT_LIBRARY_TOKEN", "")
            if len(expected) < 32:
                raise HTTPException(
                    503, "Aircraft library access is not configured", headers=private_headers
                )
            supplied = request.headers.get("authorization", "")
            if not secrets.compare_digest(supplied.encode(), ("Bearer " + expected).encode()):
                raise HTTPException(
                    401,
                    "Aircraft library credential required",
                    headers={**private_headers, "WWW-Authenticate": "Bearer"},
                )
            limit = (
                pdf.MAX_PDF_BYTES + 1_000_000
                if request.url.path.endswith("/documents") and request.method == "POST"
                else 1_000_000
            )
            body = bytearray()
            async for chunk in request.stream():
                if len(body) + len(chunk) > limit:
                    raise HTTPException(
                        413, "Aircraft library request is too large", headers=private_headers
                    )
                body.extend(chunk)
            # Authenticate and bound the body before multipart parsing/spooling.
            request._body = bytes(body)
            try:
                response = await handler(request)
            except RequestValidationError as error:
                response = await request_validation_exception_handler(request, error)
            except ocr_reviews.OCRConflict as error:
                raise HTTPException(409, str(error), headers=private_headers) from error
            except ValueError as error:
                raise HTTPException(422, str(error), headers=private_headers) from error
            except ModelUnavailable as error:
                raise HTTPException(503, str(error), headers=private_headers) from error
            except HTTPException as error:
                error.headers = {**(error.headers or {}), **private_headers}
                raise
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


class BlankVerification(BaseModel):
    page: int
    kind: Literal["rendered_pure_white", "operator_attested"]
    source_sha256: str
    renderer: str | None = None
    scale: float | None = None
    width: int | None = None
    height: int | None = None
    review_id: str | None = None
    reviewer: str | None = None
    recorded_at: str | None = None


class Extraction(BaseModel):
    status: Literal["indexed", "partial"]
    page_count: int
    incomplete_pages: list[int]
    extractor: str
    characters: int
    encryption: str | None = None
    blank_pages: list[BlankVerification] = Field(default_factory=list)
    supplemental_ocr_reviews: list[str] = Field(default_factory=list)
    page_transcription_reviews: list[str] = Field(default_factory=list)


class BlankPageCandidate(BaseModel):
    page: int
    label: str
    method: Literal["text", "ocr", "missing", "blank"]
    error: str | None
    reviewable: bool
    verification: BlankVerification | None


class BlankPageList(BaseModel):
    extraction_status: Literal["stored", "indexed", "partial", "failed"]
    document_id: str
    source_sha256: str
    index_identity: str
    page_count: int
    items: list[BlankPageCandidate]
    total: int
    limit: int
    offset: int
    next_offset: int | None


class BlankReviewRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    expected_sha256: str = Field(pattern=r"^[a-f0-9]{64}$")
    expected_index_identity: str = Field(pattern=r"^[a-f0-9]{64}$")
    pages: list[Annotated[int, Field(strict=True, ge=1, le=pdf.MAX_PAGES)]] = Field(
        min_length=1, max_length=100
    )
    reviewer: str = Field(min_length=1, max_length=200)
    attest_no_text_or_graphics: StrictBool


class BlankReviewSummary(BaseModel):
    review_id: str
    pages: list[int]
    reviewer: str
    recorded_at: str
    integrity_sha256: str


class BlankReviewRecord(BlankReviewSummary):
    document_id: str
    source_sha256: str
    source_metadata: DocumentMetadata
    before_index_identity: str
    after_index_identity: str
    page_labels: dict[str, str]
    attest_no_text_or_graphics: Literal[True]
    extraction_before: Extraction
    extraction_after: Extraction


class BlankReviewList(BaseModel):
    document_id: str
    items: list[BlankReviewSummary]
    total: int
    limit: int
    offset: int
    next_offset: int | None


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
    method: Literal["text", "ocr", "missing", "blank"]
    error: str | None


class OCRProvenance(BaseModel):
    review_id: str
    preview_id: str
    fragment_id: str
    reviewer: str
    reviewed_at: str
    integrity_sha256: str
    source_sha256: str
    source_metadata: DocumentMetadata
    engine: str
    engine_version: str
    mode: Literal["normal", "sparse", "table", "words"]
    confidence: float
    bbox: list[int]
    image_url: str


class OCRIdentityRequest(BaseModel):
    model_config = ConfigDict(extra="forbid", strict=True)
    expected_sha256: str = Field(pattern=r"^[a-f0-9]{64}$")
    expected_index_identity: str = Field(pattern=r"^[a-f0-9]{64}$")


class OCRPreviewRequest(OCRIdentityRequest):
    pages: list[int] = Field(min_length=1, max_length=10)
    mode: Literal["normal", "sparse", "table", "words"] = "normal"


class OCRSelection(BaseModel):
    model_config = ConfigDict(extra="forbid", strict=True)
    page: int = Field(ge=1, le=1500)
    fragment_id: str = Field(min_length=1, max_length=100)


class OCRApplyRequest(OCRIdentityRequest):
    preview_id: str = Field(min_length=1, max_length=100)
    preview_integrity_sha256: str = Field(pattern=r"^[a-f0-9]{64}$")
    selections: list[OCRSelection] = Field(min_length=1, max_length=100)
    reviewer: str = Field(min_length=1, max_length=200)
    attest_matches_image: StrictBool


class OCRContext(BaseModel):
    document_id: str
    source_sha256: str
    index_identity: str
    source_metadata: DocumentMetadata
    page_count: int
    modes: list[Literal["normal", "sparse", "table", "words"]]
    max_pages: int


class OCRFragment(BaseModel):
    id: str
    text: str
    offset: int
    bbox: list[int]
    confidence: float


class OCRPreprocessing(BaseModel):
    method: Literal["straight-rules-v1"]
    dark_threshold: Literal[100]
    horizontal_min_run: int = Field(ge=120)
    vertical_min_run: int = Field(ge=80)


class OCRPreviewPage(BaseModel):
    page: int
    label: str
    width: int
    height: int
    scale: float | None = None
    image_sha256: str
    tsv_sha256: str | None = None
    ocr_input_sha256: str | None = Field(default=None, pattern=r"^[a-f0-9]{64}$")
    ocr_preprocessing: OCRPreprocessing | None = None
    fragments: list[OCRFragment]
    error: str | None


class OCRPreview(BaseModel):
    id: str
    document_id: str
    job_id: str
    created_at: str
    source_sha256: str
    source_metadata: DocumentMetadata
    index_identity: str
    integrity_sha256: str
    source_current: bool
    page_count: int
    mode: Literal["normal", "sparse", "table", "words"]
    engine: str
    engine_version: str
    renderer: str
    renderer_version: str | None = None
    status: Literal["preview", "partial"]
    approved: Literal[False]
    pages: list[OCRPreviewPage]


class OCRReviewedFragment(OCRFragment):
    page: int
    label: str
    passage_id: int


class OCRReview(BaseModel):
    id: str
    document_id: str
    preview_id: str
    preview_integrity_sha256: str
    job_id: str
    source_sha256: str
    source_metadata: DocumentMetadata
    reviewer: str
    attest_matches_image: Literal[True]
    created_at: str
    before_index_identity: str
    after_index_identity: str
    integrity_sha256: str
    fragments: list[OCRReviewedFragment]
    engine: str
    engine_version: str
    mode: Literal["normal", "sparse", "table", "words"]
    active: bool
    source_current: bool


class OCRHistoryItem(BaseModel):
    id: str
    created_at: str
    integrity_sha256: str


class OCRHistory(BaseModel):
    items: list[OCRHistoryItem]
    next_offset: int | None


class TranscriptionRequest(OCRIdentityRequest):
    preview_id: str = Field(min_length=1, max_length=100)
    preview_integrity_sha256: str = Field(pattern=r"^[a-f0-9]{64}$")
    page: int = Field(ge=1, le=1500)
    image_sha256: str = Field(pattern=r"^[a-f0-9]{64}$")
    text: str = Field(min_length=8, max_length=12_000)
    reviewer: str = Field(min_length=1, max_length=200)
    attest_matches_image: StrictBool


class TranscriptionProvenance(BaseModel):
    id: str
    preview_id: str
    page: int
    image_sha256: str
    source_sha256: str
    source_metadata: DocumentMetadata
    reviewer: str
    created_at: str
    integrity_sha256: str
    image_url: str


class TranscriptionRecord(TranscriptionProvenance):
    document_id: str
    preview_integrity_sha256: str
    label: str
    offset: int
    passage_id: int
    job_id: str
    text: str
    attest_matches_image: Literal[True]
    method: Literal["operator_transcription"]
    before_index_identity: str
    after_index_identity: str
    active: bool
    source_current: bool


class Passage(BaseModel):
    passage_id: int
    document_id: str
    page: int
    label: str
    offset: int
    text: str
    method: str
    rank: float | None = None
    ocr_review: OCRProvenance | None = None
    transcription_review: TranscriptionProvenance | None = None


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
    ocr_review: OCRProvenance | None = None
    transcription_review: TranscriptionProvenance | None = None


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


class DistillationSection(BaseModel):
    model_config = ConfigDict(extra="allow")
    pages: list[int]
    insufficient_evidence: bool
    reason: str
    claims: list[Claim]


class DistillationSnapshot(BaseModel):
    model_config = ConfigDict(extra="allow")
    status: str
    sections: list[DistillationSection]
    model: str | None = None
    evidence_identity: str | None = None


class DistillationRevisionSummary(BaseModel):
    revision_id: str
    archived_at: str
    reason: str
    model: str | None
    status: str | None
    completed_batches: int | None
    source_sha256: str


class DistillationHistory(BaseModel):
    items: list[DistillationRevisionSummary]
    next_offset: int | None


class HistoricalDistillation(BaseModel):
    document_id: str
    revision_id: str
    archived_at: str
    reason: str
    source_sha256: str
    source_metadata: DocumentMetadata
    index_identity: str
    artifact: DistillationSnapshot
    historical: Literal[True]
    eligible_for_resume: Literal[False]


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

    @router.post(
        "/documents/{document_id}/transcriptions",
        response_model=JobRecord,
        status_code=202,
        operation_id="aircraft_library_transcription_apply",
    )
    def transcription_apply(
        document_id: str, body: TranscriptionRequest, current: Store = Depends(library)
    ):
        required(current, document_id)
        return transcriptions.queue_apply(current, document_id, body.model_dump())

    @router.get(
        "/documents/{document_id}/transcriptions",
        response_model=OCRHistory,
        operation_id="aircraft_library_transcription_history",
    )
    def transcription_history(
        document_id: str,
        limit: int = Query(default=20, ge=1, le=100),
        offset: int = Query(default=0, ge=0, le=1_000_000),
        current: Store = Depends(library),
    ):
        required(current, document_id)
        return transcriptions.records(current, document_id, limit=limit, offset=offset)

    @router.get(
        "/documents/{document_id}/transcriptions/{review_id}",
        response_model=TranscriptionRecord,
        operation_id="aircraft_library_transcription_detail",
    )
    def transcription_detail(document_id: str, review_id: str, current: Store = Depends(library)):
        required(current, document_id)
        return transcriptions.review(current, document_id, review_id)

    @router.post(
        "/documents/{document_id}/transcriptions/{review_id}/embeddings",
        response_model=JobRecord,
        status_code=202,
        operation_id="aircraft_library_transcription_embed",
    )
    def transcription_embed(
        document_id: str,
        review_id: str,
        body: OCRIdentityRequest,
        current: Store = Depends(library),
    ):
        required(current, document_id)
        if not state["models"].capabilities()["embeddings"]:
            raise HTTPException(503, "Embedding provider is not configured; transcription retained")
        return transcriptions.queue_embedding(current, document_id, review_id, body.model_dump())

    @router.get(
        "/documents/{document_id}/ocr",
        response_model=OCRContext,
        operation_id="aircraft_library_ocr_context",
    )
    def ocr_context(document_id: str, current: Store = Depends(library)):
        required(current, document_id)
        return ocr_reviews.context(current, document_id)

    @router.post(
        "/documents/{document_id}/ocr-previews",
        response_model=JobRecord,
        status_code=202,
        operation_id="aircraft_library_ocr_preview_create",
    )
    def ocr_create(document_id: str, body: OCRPreviewRequest, current: Store = Depends(library)):
        required(current, document_id)
        return ocr_reviews.queue_preview(current, document_id, body.model_dump())

    @router.get(
        "/documents/{document_id}/ocr-previews",
        response_model=OCRHistory,
        operation_id="aircraft_library_ocr_preview_history",
    )
    def ocr_previews(
        document_id: str,
        limit: int = Query(20, ge=1, le=100),
        offset: int = Query(0, ge=0, le=1_000_000),
        current: Store = Depends(library),
    ):
        required(current, document_id)
        return ocr_reviews.records(current, document_id, limit=limit, offset=offset)

    @router.get(
        "/documents/{document_id}/ocr-previews/{preview_id}",
        response_model=OCRPreview,
        operation_id="aircraft_library_ocr_preview_detail",
    )
    def ocr_preview(document_id: str, preview_id: str, current: Store = Depends(library)):
        required(current, document_id)
        return ocr_reviews.preview(current, document_id, preview_id)

    @router.get(
        "/documents/{document_id}/ocr-previews/{preview_id}/pages/{page}.png",
        response_class=Response,
        operation_id="aircraft_library_ocr_preview_image",
        responses={
            200: {"content": {"image/png": {"schema": {"type": "string", "format": "binary"}}}}
        },
    )
    def ocr_image(document_id: str, preview_id: str, page: int, current: Store = Depends(library)):
        required(current, document_id)
        return Response(
            ocr_reviews.preview_image(current, document_id, preview_id, page),
            media_type="image/png",
            headers={"Content-Disposition": f'inline; filename="ocr-page-{page}.png"'},
        )

    @router.post(
        "/documents/{document_id}/ocr-reviews",
        response_model=JobRecord,
        status_code=202,
        operation_id="aircraft_library_ocr_apply",
    )
    def ocr_apply(document_id: str, body: OCRApplyRequest, current: Store = Depends(library)):
        required(current, document_id)
        return ocr_reviews.queue_apply(current, document_id, body.model_dump())

    @router.get(
        "/documents/{document_id}/ocr-reviews",
        response_model=OCRHistory,
        operation_id="aircraft_library_ocr_review_history",
    )
    def ocr_reviews_list(
        document_id: str,
        limit: int = Query(20, ge=1, le=100),
        offset: int = Query(0, ge=0, le=1_000_000),
        current: Store = Depends(library),
    ):
        required(current, document_id)
        return ocr_reviews.records(current, document_id, kind="reviews", limit=limit, offset=offset)

    @router.get(
        "/documents/{document_id}/ocr-reviews/{review_id}",
        response_model=OCRReview,
        operation_id="aircraft_library_ocr_review_detail",
    )
    def ocr_review(document_id: str, review_id: str, current: Store = Depends(library)):
        required(current, document_id)
        return ocr_reviews.review(current, document_id, review_id)

    @router.post(
        "/documents/{document_id}/ocr-reviews/{review_id}/embeddings",
        response_model=JobRecord,
        status_code=202,
        operation_id="aircraft_library_ocr_review_embed",
    )
    def ocr_embed(
        document_id: str,
        review_id: str,
        body: OCRIdentityRequest,
        current: Store = Depends(library),
    ):
        required(current, document_id)
        if not state["models"].capabilities()["embeddings"]:
            raise HTTPException(
                503, "Embedding provider is not configured; OCR review remains retained"
            )
        return ocr_reviews.queue_review_embedding(
            current, document_id, review_id, body.model_dump()
        )

    @router.get("/documents/{document_id}/blank-pages", response_model=BlankPageList)
    def blank_pages(
        document_id: str,
        limit: int = Query(100, ge=1, le=100),
        offset: int = Query(0, ge=0, le=1_000_000),
        current: Store = Depends(library),
    ):
        if current.get(document_id) is None:
            raise HTTPException(404, "Document not found")
        return current.blank_pages(document_id, limit=limit, offset=offset)

    @router.post("/documents/{document_id}/blank-pages", response_model=BlankReviewRecord)
    def review_blank_pages(
        document_id: str, value: BlankReviewRequest, current: Store = Depends(library)
    ):
        if current.get(document_id) is None:
            raise HTTPException(404, "Document not found")
        try:
            return current.review_blank_pages(document_id, value.model_dump())
        except BlankReviewConflict as error:
            raise HTTPException(409, str(error)) from error

    @router.get("/documents/{document_id}/blank-page-reviews", response_model=BlankReviewList)
    def blank_page_reviews(
        document_id: str,
        limit: int = Query(20, ge=1, le=100),
        offset: int = Query(0, ge=0, le=1_000_000),
        current: Store = Depends(library),
    ):
        if current.get(document_id) is None:
            raise HTTPException(404, "Document not found")
        return current.blank_page_reviews(document_id, limit=limit, offset=offset)

    @router.get(
        "/documents/{document_id}/blank-page-reviews/{review_id}", response_model=BlankReviewRecord
    )
    def blank_page_review(document_id: str, review_id: str, current: Store = Depends(library)):
        value = current.blank_page_review(document_id, review_id)
        if value is None:
            raise HTTPException(404, "Blank-page review not found")
        return value

    @router.get(
        "/documents/{document_id}/distillations",
        response_model=DistillationHistory,
        operation_id="aircraft_library_distillation_history",
    )
    def distillation_history(
        document_id: str,
        limit: int = Query(default=20, ge=1, le=100),
        offset: int = Query(default=0, ge=0, le=1_000_000),
        current: Store = Depends(library),
    ):
        required(current, document_id)
        return current.distillations(document_id, limit=limit, offset=offset)

    @router.get(
        "/documents/{document_id}/distillations/{revision_id}",
        response_model=HistoricalDistillation,
        response_model_exclude_unset=True,
        operation_id="aircraft_library_historical_distillation",
    )
    def historical_distillation(
        document_id: str, revision_id: str, current: Store = Depends(library)
    ):
        required(current, document_id)
        value = current.historical_distillation(document_id, revision_id)
        if value is None:
            raise HTTPException(404, "Historical distillation not found")
        return value

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
