"""Typed private OCR operations through a caller-owned authenticated transport.

Transport paths are relative to /api/aircraft-library. The transport must enforce
the library Bearer credential, no-store responses, bounded bodies and no redirects.
No credential, provider or model is inferred from a PDF. Jobs are never polled here.
"""

from typing import Any, Literal, Protocol, TypedDict
import re


class OCRIdentity(TypedDict):
    expected_sha256: str
    expected_index_identity: str


class OCRSelection(TypedDict):
    page: int
    fragment_id: str


class OCRPreviewRequest(OCRIdentity):
    pages: list[int]
    mode: Literal["normal", "sparse"]


class OCRApplyRequest(OCRIdentity):
    preview_id: str
    preview_integrity_sha256: str
    selections: list[OCRSelection]
    reviewer: str
    attest_matches_image: Literal[True]


class OCRFragment(TypedDict):
    id: str
    text: str
    offset: int
    bbox: list[int]
    confidence: float


class OCRContext(TypedDict):
    document_id: str
    source_sha256: str
    index_identity: str
    source_metadata: dict[str, Any]
    page_count: int
    modes: list[Literal["normal", "sparse"]]
    max_pages: int


class OCRPage(TypedDict):
    page: int
    label: str
    width: int
    height: int
    fragments: list[OCRFragment]
    error: str | None
    image_sha256: str


class OCRPreview(TypedDict):
    id: str
    document_id: str
    source_sha256: str
    source_metadata: dict[str, Any]
    index_identity: str
    integrity_sha256: str
    source_current: bool
    engine_version: str
    mode: Literal["normal", "sparse"]
    approved: Literal[False]
    status: Literal["preview", "partial"]
    pages: list[OCRPage]


class OCRReviewedFragment(OCRFragment):
    page: int
    label: str
    passage_id: int


class OCRReview(TypedDict):
    id: str
    document_id: str
    preview_id: str
    source_sha256: str
    reviewer: str
    created_at: str
    active: bool
    source_current: bool
    fragments: list[OCRReviewedFragment]


class OCRJob(TypedDict):
    id: str
    state: Literal["queued", "running", "completed", "failed"]
    error: str | None
    result: dict[str, Any] | None


class OCRHistory(TypedDict):
    items: list[dict[str, str]]
    next_offset: int | None


class LibraryTransport(Protocol):
    def __call__(
        self, path: str, *, method: str = "GET", json: Any = None, binary: bool = False
    ) -> Any: ...


def _id(value: str) -> str:
    if not isinstance(value, str) or not re.fullmatch(r"[a-zA-Z0-9_]{1,100}", value):
        raise ValueError("Invalid library identifier")
    return value


class AircraftLibraryOCRClient:
    def __init__(self, transport: LibraryTransport):
        self._request = transport

    def context(self, document: str) -> OCRContext:
        return self._request(f"/documents/{_id(document)}/ocr")

    def queue_preview(self, document: str, value: OCRPreviewRequest) -> OCRJob:
        return self._request(f"/documents/{_id(document)}/ocr-previews", method="POST", json=value)

    def preview(self, document: str, preview: str) -> OCRPreview:
        return self._request(f"/documents/{_id(document)}/ocr-previews/{_id(preview)}")

    def image(self, document: str, preview: str, page: int) -> bytes:
        if type(page) is not int or not 1 <= page <= 1500:
            raise ValueError("Invalid physical page")
        return self._request(
            f"/documents/{_id(document)}/ocr-previews/{_id(preview)}/pages/{page}.png", binary=True
        )

    def apply(self, document: str, value: OCRApplyRequest) -> OCRJob:
        return self._request(f"/documents/{_id(document)}/ocr-reviews", method="POST", json=value)

    def review(self, document: str, review: str) -> OCRReview:
        return self._request(f"/documents/{_id(document)}/ocr-reviews/{_id(review)}")

    def embed(self, document: str, review: str, value: OCRIdentity) -> OCRJob:
        return self._request(
            f"/documents/{_id(document)}/ocr-reviews/{_id(review)}/embeddings",
            method="POST",
            json=value,
        )

    def history(
        self, document: str, kind: Literal["ocr-previews", "ocr-reviews"], offset: int = 0
    ) -> OCRHistory:
        if (
            kind not in {"ocr-previews", "ocr-reviews"}
            or type(offset) is not int
            or not 0 <= offset <= 1_000_000
        ):
            raise ValueError("Invalid OCR history page")
        return self._request(f"/documents/{_id(document)}/{kind}?limit=20&offset={offset}")

    def job(self, job: str) -> OCRJob:
        return self._request(f"/jobs/{_id(job)}")
