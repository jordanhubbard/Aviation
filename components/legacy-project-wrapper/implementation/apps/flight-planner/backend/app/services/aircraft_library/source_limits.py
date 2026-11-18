"""Explicit original-image-only policy; original/searchable text is never edited."""

from __future__ import annotations

import json
import re
import uuid

from . import ocr, ocr_reviews
from .store import now
from .transcriptions import _image, _plain

MAX_REVIEWS = 500
CHANNEL = "source_limit_reviews"
REASONS = {
    "restrict": "layout_relationships_unavailable",
    "release": "original_text_reviewed",
}


def _valid_decision(action, reason):
    return (
        isinstance(action, str)
        and action in REASONS
        and isinstance(reason, str)
        and reason
        in (
            (REASONS["restrict"], "native_text_inaccurate")
            if action == "restrict"
            else (REASONS["release"],)
        )
    )


class VerifiedSourceLimit(dict):
    """Capability granted only after validating the immutable image/review ledger."""


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
            "action",
            "reason",
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
        or not _valid_decision(values["action"], values["reason"])
        or not _plain(values["reviewer"])
        or not 1 <= len(values["reviewer"].strip()) <= 200
        or values["attest_matches_image"] is not True
    ):
        raise ValueError(
            "Source review requires an exact page image, named reviewer and attestation"
        )


def events(connection, identifier):
    document = ocr_reviews._document(connection, identifier, require_extraction=False)
    extraction = json.loads(document["extraction"] or "{}")
    if not isinstance(extraction, dict):
        raise ValueError("Invalid source-limit extraction anchor")
    anchor = extraction.get(CHANNEL, [])
    if (
        not isinstance(anchor, list)
        or len(anchor) > MAX_REVIEWS
        or any(not isinstance(value, str) for value in anchor)
        or len(set(anchor)) != len(anchor)
    ):
        raise ValueError("Invalid source-limit review anchor")
    if not connection.execute(
        "SELECT 1 FROM sqlite_master WHERE type='table' AND name='page_source_limits'"
    ).fetchone():
        if anchor:
            raise ValueError("Missing source-limit ledger")
        return []
    rows = connection.execute(
        "SELECT * FROM page_source_limits WHERE document_id=? ORDER BY rowid LIMIT ?",
        (identifier, MAX_REVIEWS + 1),
    ).fetchall()
    if [r["id"] for r in rows] != anchor:
        raise ValueError("Source-limit ledger does not match its document anchor")
    if not rows:
        return []
    if len(rows) > MAX_REVIEWS:
        raise ValueError("Invalid source-limit ledger size")
    result, previous, states = [], {}, {}
    for row in rows:
        if ocr.digest(row["value"].encode()) != row["integrity_sha256"]:
            raise ValueError("Source-limit ledger integrity check failed")
        item = json.loads(row["value"])
        if isinstance(item, dict):
            _inputs(
                {
                    "expected_sha256": item.get("source_sha256"),
                    "expected_index_identity": item.get("before_index_identity"),
                    **{
                        key: item.get(key)
                        for key in (
                            "preview_id",
                            "preview_integrity_sha256",
                            "page",
                            "image_sha256",
                            "action",
                            "reason",
                            "reviewer",
                            "attest_matches_image",
                        )
                    },
                }
            )
        if (
            not isinstance(item, dict)
            or any(
                item.get(k) != row[k]
                for k in ("id", "document_id", "preview_id", "page", "action", "job_id")
            )
            or not _valid_decision(item.get("action"), item.get("reason"))
            or item.get("source_sha256") != document["sha256"]
            or item.get("previous_review_id") != previous.get(item["page"])
            or item.get("attest_matches_image") is not True
            or item.get("action") == states.get(item.get("page"), "release")
        ):
            raise ValueError("Source-limit ledger mapping mismatch")
        candidate, _ = _image(
            connection, identifier, item["preview_id"], item["page"], item["image_sha256"]
        )
        if (
            candidate["source_sha256"] != item["source_sha256"]
            or candidate["source_metadata"] != item["source_metadata"]
            or candidate["integrity_sha256"] != item["preview_integrity_sha256"]
        ):
            raise ValueError("Source-limit original preview mismatch")
        previous[item["page"]] = item["id"]
        states[item["page"]] = item["action"]
        result.append(
            {
                **item,
                "integrity_sha256": row["integrity_sha256"],
                "image_url": f"/api/aircraft-library/documents/{identifier}/ocr-previews/{item['preview_id']}/pages/{item['page']}.png",
            }
        )
    return result


def identity(connection, identifier):
    # No review-value hashes: the receipt itself records the resulting index identity.
    # Verify every complete ledger/image first, then bind its immutable decision IDs.
    return [
        [r["id"], r["page"], r["action"], r["image_sha256"]] for r in events(connection, identifier)
    ]


def latest(connection, identifier):
    return {r["page"]: r for r in events(connection, identifier)}


def active(connection, identifier):
    return [
        {**r, "active": True, "current": True}
        for r in latest(connection, identifier).values()
        if r["action"] == "restrict"
    ]


def _candidate(store, connection, identifier, values):
    row = ocr_reviews._pin(store, connection, identifier, values)
    candidate, _ = _image(
        connection, identifier, values["preview_id"], values["page"], values["image_sha256"]
    )
    if (
        candidate["integrity_sha256"] != values["preview_integrity_sha256"]
        or candidate["source_sha256"] != row["sha256"]
        or candidate["index_identity"] != values["expected_index_identity"]
        or candidate["source_metadata"] != json.loads(row["metadata"])
    ):
        raise ocr_reviews.OCRConflict("Source review preview is stale; prepare a fresh image")
    ocr_reviews._original(store, row)
    reviews = events(connection, identifier)
    if len(reviews) >= MAX_REVIEWS:
        raise ValueError("Source-limit review capacity reached")
    current = next((r for r in reversed(reviews) if r["page"] == values["page"]), None)
    if (
        current
        and current["action"] == values["action"]
        or not current
        and values["action"] == "release"
    ):
        raise ocr_reviews.OCRConflict("Page already has the requested source-use state")
    return row, current


def queue_review(store, identifier, values):
    _inputs(values)
    job_id = "job_" + uuid.uuid4().hex
    with store.connection() as connection:
        connection.execute("BEGIN IMMEDIATE")
        row, current = _candidate(store, connection, identifier, values)
        ocr_reviews._exclusive(connection, identifier)
        request = {
            **values,
            "document_id": identifier,
            "source_metadata": json.loads(row["metadata"]),
            "previous_review_id": current["id"] if current else None,
        }
        connection.execute(
            "INSERT INTO jobs VALUES (?,?,'queued',?,NULL,NULL,?,?,NULL)",
            (job_id, "source_limit_review", json.dumps(request), now(), now()),
        )
    return store.job(job_id)


def apply_review(store, job):
    request = job["request"]
    identifier = request["document_id"]
    with store.connection() as connection:
        connection.execute("BEGIN IMMEDIATE")
        ocr_reviews._owned(store, connection, job)
        checkpoint = store.checkpoint(job["id"], connection=connection)
        if checkpoint.get("source_limit_review_id"):
            saved = next(
                (
                    r
                    for r in events(connection, identifier)
                    if r["id"] == checkpoint["source_limit_review_id"]
                ),
                None,
            )
            if not saved or saved["after_index_identity"] != store.index_identity(
                identifier, connection=connection
            ):
                raise ocr_reviews.OCRConflict("Source changed after applying its limitation review")
            return saved
        row, current = _candidate(store, connection, identifier, request)
        if request["previous_review_id"] != (current["id"] if current else None):
            raise ocr_reviews.OCRConflict("Source-use decision changed before application")
        store._archive_distillation(connection, identifier, "reviewed_source_limitation")
        connection.execute(
            "DELETE FROM artifacts WHERE document_id=? AND kind='distillation'", (identifier,)
        )
        review_id = "source_limit_" + uuid.uuid4().hex
        value = {
            "id": review_id,
            "document_id": identifier,
            "job_id": job["id"],
            "preview_id": request["preview_id"],
            "page": request["page"],
            "action": request["action"],
            "reason": request["reason"],
            "source_sha256": row["sha256"],
            "source_metadata": request["source_metadata"],
            "before_index_identity": request["expected_index_identity"],
            "after_index_identity": None,
            "preview_integrity_sha256": request["preview_integrity_sha256"],
            "image_sha256": request["image_sha256"],
            "reviewer": request["reviewer"].strip(),
            "attest_matches_image": True,
            "previous_review_id": request["previous_review_id"],
            "created_at": now(),
        }
        encoded = ocr.encoded(value).decode()
        connection.execute(
            "INSERT INTO page_source_limits VALUES (?,?,?,?,?,?,?,?,?)",
            (
                review_id,
                identifier,
                request["preview_id"],
                request["page"],
                request["action"],
                job["id"],
                encoded,
                ocr.digest(encoded.encode()),
                value["created_at"],
            ),
        )
        extraction = json.loads(row["extraction"])
        extraction.setdefault(CHANNEL, []).append(review_id)
        connection.execute(
            "UPDATE documents SET extraction=? WHERE id=?", (json.dumps(extraction), identifier)
        )
        value["after_index_identity"] = store.index_identity(identifier, connection=connection)
        encoded = ocr.encoded(value).decode()
        connection.execute(
            "UPDATE page_source_limits SET value=?,integrity_sha256=? WHERE id=?",
            (encoded, ocr.digest(encoded.encode()), review_id),
        )
        store.checkpoint(job["id"], {"source_limit_review_id": review_id}, connection=connection)
        return next(r for r in events(connection, identifier) if r["id"] == review_id)


def records(store, identifier, *, limit=20, offset=0):
    if (
        type(limit) is not int
        or type(offset) is not int
        or not 1 <= limit <= 100
        or not 0 <= offset <= 1_000_000
    ):
        raise ValueError("Invalid source-limit history page")
    with store.connection() as connection:
        connection.execute("BEGIN")
        ocr_reviews._document(connection, identifier, require_extraction=False)
        rows = events(connection, identifier)
        current = {r["page"]: r["id"] for r in rows}
        items = [
            {
                **r,
                "current": current[r["page"]] == r["id"],
                "active": current[r["page"]] == r["id"] and r["action"] == "restrict",
            }
            for r in reversed(rows)
        ]
        return {
            "items": items[offset : offset + limit],
            "limit": limit,
            "offset": offset,
            "total": len(items),
            "next_offset": offset + limit if offset + limit < len(items) else None,
        }


def review(store, identifier, review_id):
    with store.connection() as connection:
        connection.execute("BEGIN")
        rows = events(connection, identifier)
        current = {r["page"]: r["id"] for r in rows}
        for row in rows:
            if row["id"] == review_id:
                return {
                    **row,
                    "current": current[row["page"]] == row["id"],
                    "active": current[row["page"]] == row["id"] and row["action"] == "restrict",
                }
    raise ValueError("Source-limit review not found")


def provenance(decision):
    return VerifiedSourceLimit(
        {
            "id": decision["id"],
            "page": decision["page"],
            "reason": decision["reason"],
            "original_image_only": decision["action"] == "restrict",
            "preview_id": decision["preview_id"],
            "image_sha256": decision["image_sha256"],
            "source_sha256": decision["source_sha256"],
            "reviewer": decision["reviewer"],
            "integrity_sha256": decision["integrity_sha256"],
            "image_url": decision["image_url"],
        }
    )


def enrich_passages(connection, passages):
    by_document = {
        identifier: latest(connection, identifier)
        for identifier in {p["document_id"] for p in passages}
    }
    for passage in passages:
        decision = by_document[passage["document_id"]].get(passage["page"])
        if decision and not passage.get("ocr_review") and not passage.get("transcription_review"):
            passage["source_limit"] = provenance(decision)
    return passages
