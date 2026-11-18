"""Explicit, image-pinned operator text; never a machine OCR result."""

from __future__ import annotations

import json
import re
import unicodedata
import uuid

from . import ocr, ocr_reviews
from .store import now

MAX_TEXT = 12_000
MAX_ACTIVE = 500
METHOD = "operator_transcription"
CHANNEL = "page_transcription_reviews"


class VerifiedTranscription(dict):
    """Internal capability created only after verifying the retained ledger."""


def _plain(value):
    return isinstance(value, str) and not any(
        unicodedata.category(c) in {"Cc", "Cf", "Cs"} and c not in "\n\r\t" for c in value
    )


def _inputs(values):
    ocr_reviews._identities(values)
    if (
        set(values)
        != {
            "expected_sha256",
            "expected_index_identity",
            "preview_id",
            "preview_integrity_sha256",
            "page",
            "image_sha256",
            "text",
            "reviewer",
            "attest_matches_image",
        }
        or not isinstance(values["preview_id"], str)
        or not 1 <= len(values["preview_id"]) <= 100
        or any(
            not isinstance(values[k], str) or not re.fullmatch(r"[a-f0-9]{64}", values[k])
            for k in ("preview_integrity_sha256", "image_sha256")
        )
        or type(values["page"]) is not int
        or not 1 <= values["page"] <= 1500
        or not _plain(values["text"])
        or not 8 <= len(values["text"]) <= MAX_TEXT
        or not values["text"].strip()
        or not _plain(values["reviewer"])
        or not 1 <= len(values["reviewer"].strip()) <= 200
        or values["attest_matches_image"] is not True
    ):
        raise ValueError(
            "Transcription requires literal page text, a reviewer and image attestation"
        )


def _image(connection, identifier, preview_id, page, expected):
    candidate = ocr_reviews._preview(connection, identifier, preview_id)
    source = next((p for p in candidate["pages"] if p["page"] == page), None)
    image = connection.execute(
        "SELECT image,sha256 FROM ocr_preview_images WHERE preview_id=? AND page=?",
        (preview_id, page),
    ).fetchone()
    if (
        source is None
        or image is None
        or source["image_sha256"] != expected
        or image["sha256"] != expected
        or ocr.digest(image["image"]) != expected
    ):
        raise ValueError("Transcription original page image integrity check failed")
    return candidate, source


def _active(row):
    extraction = json.loads(row["extraction"] or "{}")
    active = extraction.get(CHANNEL, []) if isinstance(extraction, dict) else None
    if (
        not isinstance(active, list)
        or len(active) > MAX_ACTIVE
        or any(not isinstance(value, str) for value in active)
        or len(set(active)) != len(active)
    ):
        raise ValueError("Invalid active page transcription ledger")
    return active


def _record(connection, identifier, review_id):
    row = connection.execute(
        "SELECT * FROM page_transcriptions WHERE id=? AND document_id=?",
        (review_id, identifier),
    ).fetchone()
    if row is None:
        raise ValueError("Page transcription not found")
    if ocr.digest(row["value"].encode()) != row["integrity_sha256"]:
        raise ValueError("Page transcription ledger integrity check failed")
    result = json.loads(row["value"])
    if not isinstance(result, dict) or any(
        result.get(k) != row[k]
        for k in ("id", "document_id", "preview_id", "page", "passage_id", "job_id")
    ):
        raise ValueError("Page transcription ledger mapping mismatch")
    return {**result, "integrity_sha256": row["integrity_sha256"]}


def _candidate(store, connection, identifier, values):
    row = ocr_reviews._pin(store, connection, identifier, values)
    candidate, page = _image(
        connection, identifier, values["preview_id"], values["page"], values["image_sha256"]
    )
    if (
        candidate["integrity_sha256"] != values["preview_integrity_sha256"]
        or candidate["source_sha256"] != row["sha256"]
        or candidate["index_identity"] != values["expected_index_identity"]
        or candidate["source_metadata"] != json.loads(row["metadata"])
    ):
        raise ocr_reviews.OCRConflict("Transcription preview is stale; request a fresh preview")
    ocr_reviews._original(store, row)
    active = _active(row)
    if len(active) >= MAX_ACTIVE:
        raise ValueError("Document transcription limit reached")
    for review_id in active:
        saved = _record(connection, identifier, review_id)
        if saved["page"] == values["page"] and saved["text"] == values["text"]:
            raise ocr_reviews.OCRConflict("This page transcription is already active")
    return row, candidate, page


def queue_apply(store, identifier, values):
    _inputs(values)
    job_id = "job_" + uuid.uuid4().hex
    with store.connection() as connection:
        connection.execute("BEGIN IMMEDIATE")
        row, _, _ = _candidate(store, connection, identifier, values)
        ocr_reviews._exclusive(connection, identifier)
        request = {
            **values,
            "document_id": identifier,
            "source_metadata": json.loads(row["metadata"]),
        }
        connection.execute(
            "INSERT INTO jobs VALUES (?,?,'queued',?,NULL,NULL,?,?,NULL)",
            (job_id, "transcription_apply", json.dumps(request), now(), now()),
        )
    return store.job(job_id)


def apply_review(store, job):
    request = job["request"]
    identifier = request["document_id"]
    with store.connection() as connection:
        connection.execute("BEGIN IMMEDIATE")
        ocr_reviews._owned(store, connection, job)
        saved = store.checkpoint(job["id"], connection=connection)
        if saved.get("transcription_id"):
            result = _record(connection, identifier, saved["transcription_id"])
            if (
                store.index_identity(identifier, connection=connection)
                != result["after_index_identity"]
            ):
                raise ocr_reviews.OCRConflict("Source changed after transcription application")
            _verify(connection, identifier, result)
            return result
        row, candidate, page = _candidate(store, connection, identifier, request)
        review_id, timestamp = "transcription_" + uuid.uuid4().hex, now()
        store._archive_distillation(connection, identifier, "reviewed_page_transcription_added")
        cursor = connection.execute(
            "INSERT INTO passages VALUES (?,?,?,?,?,?)",
            (identifier, request["page"], page["label"], 0, request["text"], METHOD),
        )
        extraction = json.loads(row["extraction"])
        extraction.setdefault(CHANNEL, []).append(review_id)
        connection.execute(
            "UPDATE documents SET extraction=? WHERE id=?", (json.dumps(extraction), identifier)
        )
        connection.execute(
            "DELETE FROM artifacts WHERE document_id=? AND kind='distillation'", (identifier,)
        )
        result = {
            "id": review_id,
            "document_id": identifier,
            "preview_id": candidate["id"],
            "preview_integrity_sha256": candidate["integrity_sha256"],
            "page": request["page"],
            "label": page["label"],
            "offset": 0,
            "image_sha256": request["image_sha256"],
            "passage_id": cursor.lastrowid,
            "job_id": job["id"],
            "source_sha256": row["sha256"],
            "source_metadata": json.loads(row["metadata"]),
            "text": request["text"],
            "reviewer": request["reviewer"].strip(),
            "attest_matches_image": True,
            "method": METHOD,
            "created_at": timestamp,
            "before_index_identity": request["expected_index_identity"],
            "after_index_identity": store.index_identity(identifier, connection=connection),
        }
        value = ocr.encoded(result)
        connection.execute(
            "INSERT INTO page_transcriptions VALUES (?,?,?,?,?,?,?,?,?)",
            (
                review_id,
                identifier,
                candidate["id"],
                request["page"],
                cursor.lastrowid,
                job["id"],
                value.decode(),
                ocr.digest(value),
                timestamp,
            ),
        )
        store.checkpoint(job["id"], {"transcription_id": review_id}, connection=connection)
        return {**result, "integrity_sha256": ocr.digest(value)}


def _verify(connection, identifier, result, *, images=None):
    image_key = (result["preview_id"], result["page"], result["image_sha256"])
    if images is not None and image_key in images:
        candidate, page = images[image_key]
    else:
        candidate, page = _image(connection, identifier, *image_key)
        if images is not None:
            images[image_key] = (candidate, page)
    if (
        candidate["integrity_sha256"] != result["preview_integrity_sha256"]
        or candidate["source_sha256"] != result["source_sha256"]
        or candidate["source_metadata"] != result["source_metadata"]
        or candidate["index_identity"] != result["before_index_identity"]
        or result.get("attest_matches_image") is not True
        or result.get("method") != METHOD
        or not _plain(result.get("text"))
        or not 8 <= len(result["text"]) <= MAX_TEXT
        or not result["text"].strip()
        or not _plain(result.get("reviewer"))
        or not 1 <= len(result["reviewer"].strip()) <= 200
    ):
        raise ValueError("Page transcription provenance mismatch")
    passage = connection.execute(
        "SELECT rowid,* FROM passages WHERE rowid=? AND document_id=?",
        (result["passage_id"], identifier),
    ).fetchone()
    if (
        passage is None
        or any(passage[k] != result[k] for k in ("page", "label", "offset", "text", "method"))
        or page["label"] != result["label"]
    ):
        raise ValueError("Page transcription passage mismatch")


def review(store, identifier, review_id):
    with store.connection() as connection:
        connection.execute("BEGIN")
        result = _record(connection, identifier, review_id)
        row = ocr_reviews._document(connection, identifier, require_extraction=False)
        active = review_id in _active(row)
        if active:
            _verify(connection, identifier, result)
        return {
            **result,
            "active": active,
            "source_current": store.index_identity(identifier, connection=connection)
            == result["after_index_identity"],
            "image_url": f"/api/aircraft-library/documents/{identifier}/ocr-previews/{result['preview_id']}/pages/{result['page']}.png",
        }


def records(store, identifier, *, limit=20, offset=0):
    if (
        type(limit) is not int
        or not 1 <= limit <= 100
        or type(offset) is not int
        or not 0 <= offset <= 1_000_000
    ):
        raise ValueError("Invalid transcription history pagination")
    with store.connection() as connection:
        ocr_reviews._document(connection, identifier, require_extraction=False)
        rows = connection.execute(
            "SELECT id,created_at,integrity_sha256 FROM page_transcriptions WHERE document_id=? ORDER BY created_at DESC,id LIMIT ? OFFSET ?",
            (identifier, limit + 1, offset),
        ).fetchall()
        return {
            "items": [dict(r) for r in rows[:limit]],
            "next_offset": offset + limit if len(rows) > limit else None,
        }


def queue_embedding(store, identifier, review_id, values):
    ocr_reviews._identities(values)
    if set(values) != {"expected_sha256", "expected_index_identity"}:
        raise ValueError("Unknown transcription embedding fields")
    job_id = "job_" + uuid.uuid4().hex
    with store.connection() as connection:
        connection.execute("BEGIN IMMEDIATE")
        row = ocr_reviews._pin(store, connection, identifier, values)
        ocr_reviews._exclusive(connection, identifier)
        if review_id not in _active(row):
            raise ocr_reviews.OCRConflict("This transcription is no longer active")
        result = _record(connection, identifier, review_id)
        _verify(connection, identifier, result)
        ocr_reviews._original(store, row)
        request = {**values, "document_id": identifier, "transcription_id": review_id}
        connection.execute(
            "INSERT INTO jobs VALUES (?,?,'queued',?,NULL,NULL,?,?,NULL)",
            (job_id, "transcription_embed", json.dumps(request), now(), now()),
        )
    return store.job(job_id)


def embedding_review(store, job):
    request = job["request"]
    with store.connection() as connection:
        connection.execute("BEGIN")
        ocr_reviews._owned(store, connection, job)
        row = ocr_reviews._pin(store, connection, request["document_id"], request)
        if request["transcription_id"] not in _active(row):
            raise ocr_reviews.OCRConflict("This transcription is no longer active")
        result = _record(connection, request["document_id"], request["transcription_id"])
        _verify(connection, request["document_id"], result)
        ocr_reviews._original(store, row)
        return result


def enrich_passages(connection, passages, *, source_order=False):
    if not passages:
        return passages
    if not connection.execute(
        "SELECT 1 FROM sqlite_master WHERE type='table' AND name='page_transcriptions'"
    ).fetchone():
        if any(p["method"] == METHOD for p in passages):
            raise ValueError("Missing page transcription ledger")
        return passages
    expected, images, affected = {}, {}, set()
    for identifier in {p["document_id"] for p in passages}:
        row = ocr_reviews._document(connection, identifier, require_extraction=False)
        active = _active(row)
        for review_id in active:
            result = _record(connection, identifier, review_id)
            _verify(connection, identifier, result, images=images)
            if result["source_sha256"] != row["sha256"]:
                raise ValueError("Page transcription original mismatch")
            expected[(identifier, result["passage_id"])] = result
    for passage in passages:
        result = expected.get((passage["document_id"], passage["passage_id"]))
        if result is None:
            if passage["method"] == METHOD:
                raise ValueError("Missing or inactive page transcription provenance")
            continue
        if any(passage[k] != result[k] for k in ("page", "label", "offset", "text", "method")):
            raise ValueError("Page transcription source mismatch")
        passage["transcription_review"] = VerifiedTranscription(
            {
                key: result[key]
                for key in (
                    "id",
                    "preview_id",
                    "page",
                    "image_sha256",
                    "source_sha256",
                    "source_metadata",
                    "reviewer",
                    "created_at",
                    "integrity_sha256",
                )
            }
        )
        passage["transcription_review"][
            "image_url"
        ] = f"/api/aircraft-library/documents/{passage['document_id']}/ocr-previews/{result['preview_id']}/pages/{passage['page']}.png"
        affected.add(passage["document_id"])
    if source_order and affected:
        ordered, emitted = [], set()
        for passage in passages:
            identifier = passage["document_id"]
            if identifier not in affected:
                ordered.append(passage)
            elif identifier not in emitted:
                # Stable sort retains existing native/OCR order within each page.
                ordered.extend(
                    sorted(
                        (p for p in passages if p["document_id"] == identifier),
                        key=lambda p: (p["page"], p["method"] == METHOD),
                    )
                )
                emitted.add(identifier)
        return ordered
    return passages
