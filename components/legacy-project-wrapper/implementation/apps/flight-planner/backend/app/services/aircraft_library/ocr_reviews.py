"""Durable source-pinned supplemental OCR previews; no automatic source mutation."""

from __future__ import annotations

import json
import re
import uuid

from . import ocr, pdf
from .store import now


class OCRConflict(ValueError):
    """Source changed or another document operation owns the review boundary."""


def _document(connection, identifier, *, require_extraction=True):
    row = connection.execute("SELECT * FROM documents WHERE id=?", (identifier,)).fetchone()
    if row is None:
        raise ValueError("Document not found")
    if require_extraction and (
        row["status"] not in {"indexed", "partial"} or not row["extraction"]
    ):
        raise ValueError("Supplemental OCR requires an existing extraction")
    return row


def _identities(values):
    if not isinstance(values, dict) or any(
        not isinstance(values.get(key), str) or not re.fullmatch(r"[a-f0-9]{64}", values[key])
        for key in ("expected_sha256", "expected_index_identity")
    ):
        raise ValueError("OCR requires the exact source and index identities")


def _pin(store, connection, identifier, request):
    row = _document(connection, identifier)
    if (
        row["sha256"] != request["expected_sha256"]
        or store.index_identity(identifier, connection=connection)
        != request["expected_index_identity"]
        or (
            "source_metadata" in request
            and json.loads(row["metadata"]) != request["source_metadata"]
        )
    ):
        raise OCRConflict("Source, metadata or index changed; request a fresh OCR preview")
    return row


def _exclusive(connection, identifier, *, own_job=""):
    if connection.execute(
        "SELECT 1 FROM jobs WHERE state IN ('queued','running') "
        "AND json_extract(request,'$.document_id')=? AND id!=? LIMIT 1",
        (identifier, own_job),
    ).fetchone():
        raise OCRConflict("Document work is queued or running; wait before requesting OCR")


def _original(store, row):
    path = store.objects / (row["sha256"] + ".pdf")
    try:
        with path.open("rb") as stream:
            data = stream.read(pdf.MAX_PDF_BYTES + 1)
    except OSError as error:
        raise ValueError("Retained original is unavailable; OCR was not saved") from error
    if len(data) > pdf.MAX_PDF_BYTES or ocr.digest(data) != row["sha256"]:
        raise ValueError("Retained original integrity check failed; OCR was not saved")
    return path


def context(store, identifier):
    with store.connection() as connection:
        connection.execute("BEGIN")
        row = _document(connection, identifier)
        return {
            "document_id": identifier,
            "source_sha256": row["sha256"],
            "index_identity": store.index_identity(identifier, connection=connection),
            "source_metadata": json.loads(row["metadata"]),
            "page_count": json.loads(row["extraction"])["page_count"],
            "modes": list(ocr.MODES),
            "max_pages": ocr.MAX_PAGES,
        }


def queue_preview(store, identifier, values):
    _identities(values)
    if set(values) - {"pages", "mode", "expected_sha256", "expected_index_identity"}:
        raise ValueError("Unknown OCR preview fields")
    pages = ocr.selection(values.get("pages"), values.get("mode", "normal"))
    job_id = "job_" + uuid.uuid4().hex
    with store.connection() as connection:
        connection.execute("BEGIN IMMEDIATE")
        row = _pin(store, connection, identifier, values)
        if pages[-1] > json.loads(row["extraction"])["page_count"]:
            raise ValueError("Selected physical page is outside the document")
        _exclusive(connection, identifier)
        request = {
            **values,
            "pages": pages,
            "mode": values.get("mode", "normal"),
            "document_id": identifier,
            "source_metadata": json.loads(row["metadata"]),
        }
        connection.execute(
            "INSERT INTO jobs VALUES (?,?,'queued',?,NULL,NULL,?,?,NULL)",
            (job_id, "ocr_preview", json.dumps(request), now(), now()),
        )
    return store.job(job_id)


def _owned(store, connection, job):
    lease = getattr(store._scope, "lease", None)
    if not lease or lease[0] != job["id"]:
        raise OCRConflict("OCR publication requires exclusive worker ownership")
    store._check_lease(connection)
    _exclusive(connection, job["request"]["document_id"], own_job=job["id"])


def generate_preview(store, job, *, cancelled=None):
    request = job["request"]
    identifier = request["document_id"]
    with store.connection() as connection:
        connection.execute("BEGIN")
        _owned(store, connection, job)
        row = _pin(store, connection, identifier, request)
        existing = connection.execute(
            "SELECT id FROM ocr_previews WHERE job_id=?", (job["id"],)
        ).fetchone()
        if existing:
            # An interrupted completion resumes the already committed immutable preview.
            retained = _preview(connection, identifier, existing["id"])
            return {
                "preview_id": existing["id"],
                "document_id": identifier,
                "status": retained["status"],
            }
        path = _original(store, row)
    candidate, images = ocr.extract_selected(
        path,
        request["pages"],
        mode=request["mode"],
        cancelled=cancelled,
    )
    if candidate["source_sha256"] != request["expected_sha256"]:
        raise OCRConflict("Original changed during OCR; preview was not saved")
    preview_id = "ocr_preview_" + uuid.uuid4().hex
    timestamp = now()
    candidate.update(
        {
            "id": preview_id,
            "document_id": identifier,
            "job_id": job["id"],
            "index_identity": request["expected_index_identity"],
            "source_metadata": request["source_metadata"],
            "created_at": timestamp,
        }
    )
    value = ocr.encoded(candidate)
    if len(value) > ocr.MAX_CANDIDATE_BYTES:
        raise ocr.OCRError("OCR preview exceeds candidate size limit")
    with store.connection() as connection:
        connection.execute("BEGIN IMMEDIATE")
        _owned(store, connection, job)
        row = _pin(store, connection, identifier, request)
        _original(store, row)
        connection.execute(
            "INSERT INTO ocr_previews VALUES (?,?,?,?,?,?)",
            (preview_id, identifier, job["id"], value.decode(), ocr.digest(value), timestamp),
        )
        total = 0
        for page in candidate["pages"]:
            image = images[page["page"]]
            total += len(image)
            if total > ocr.MAX_IMAGE_BYTES or ocr.digest(image) != page["image_sha256"]:
                raise ocr.OCRError("OCR image integrity or size limit failure")
            connection.execute(
                "INSERT INTO ocr_preview_images VALUES (?,?,?,?)",
                (preview_id, page["page"], image, page["image_sha256"]),
            )
        store.checkpoint(job["id"], {"preview_id": preview_id}, connection=connection)
    return {"preview_id": preview_id, "document_id": identifier, "status": candidate["status"]}


def _preview(connection, identifier, preview_id):
    row = connection.execute(
        "SELECT value,integrity_sha256 FROM ocr_previews WHERE id=? AND document_id=?",
        (preview_id, identifier),
    ).fetchone()
    if row is None:
        raise ValueError("OCR preview not found")
    if ocr.digest(row["value"].encode()) != row["integrity_sha256"]:
        raise ValueError("Retained OCR preview integrity check failed")
    return {**json.loads(row["value"]), "integrity_sha256": row["integrity_sha256"]}


def preview(store, identifier, preview_id):
    with store.connection() as connection:
        connection.execute("BEGIN")
        result = _preview(connection, identifier, preview_id)
        row = _document(connection, identifier, require_extraction=False)
        result["source_current"] = (
            row["sha256"] == result["source_sha256"]
            and json.loads(row["metadata"]) == result["source_metadata"]
            and store.index_identity(identifier, connection=connection) == result["index_identity"]
        )
        return result


def preview_image(store, identifier, preview_id, page):
    if type(page) is not int or not 1 <= page <= 1500:
        raise ValueError("Invalid OCR image page")
    with store.connection() as connection:
        connection.execute("BEGIN")
        candidate = _preview(connection, identifier, preview_id)
        source = next((p for p in candidate["pages"] if p["page"] == page), None)
        row = connection.execute(
            "SELECT image,sha256 FROM ocr_preview_images WHERE preview_id=? AND page=?",
            (preview_id, page),
        ).fetchone()
        if not source or row is None:
            raise ValueError("OCR page image not found")
        if row["sha256"] != source["image_sha256"] or ocr.digest(row["image"]) != row["sha256"]:
            raise ValueError("Retained OCR page image integrity check failed")
        return row["image"]
