"""Explicit source-bound blank scan review; never rewrites readable evidence."""

from __future__ import annotations

import hashlib
import json
import re
import uuid

from . import pdf
from .store import BlankReviewConflict, now


def _bounds(limit, offset, maximum=100):
    if (
        type(limit) is not int
        or not 1 <= limit <= maximum
        or type(offset) is not int
        or not 0 <= offset <= 1_000_000
    ):
        raise ValueError("Invalid blank-page pagination")


def _document(connection, identifier):
    row = connection.execute("SELECT * FROM documents WHERE id=?", (identifier,)).fetchone()
    if row is None:
        raise ValueError("Document not found")
    return row


def candidates(store, identifier, *, limit=100, offset=0):
    _bounds(limit, offset)
    with store.connection() as connection:
        connection.execute("BEGIN")
        document = _document(connection, identifier)
        extraction = json.loads(document["extraction"]) if document["extraction"] else {}
        blank = {v["page"]: v for v in extraction.get("blank_pages", [])}
        indexed = {
            int(p[0])
            for p in connection.execute(
                "SELECT DISTINCT page FROM passages WHERE document_id=?", (identifier,)
            )
        }
        rows = connection.execute(
            "SELECT page,label,text,method,error FROM pages WHERE document_id=? AND (method IN ('missing','blank') OR error IS NOT NULL) ORDER BY page",
            (identifier,),
        ).fetchall()
        items = [
            {
                "page": r["page"],
                "label": r["label"],
                "method": r["method"],
                "error": r["error"],
                "reviewable": r["method"] != "blank"
                and not r["text"].strip()
                and r["page"] not in indexed,
                "verification": blank.get(r["page"]) if r["method"] == "blank" else None,
            }
            for r in rows[offset : offset + limit]
        ]
        return {
            "document_id": identifier,
            "source_sha256": document["sha256"],
            "index_identity": store.index_identity(identifier, connection=connection),
            "page_count": extraction.get("page_count", 0),
            "extraction_status": document["status"],
            "items": items,
            "total": len(rows),
            "limit": limit,
            "offset": offset,
            "next_offset": offset + len(items) if offset + len(items) < len(rows) else None,
        }


def review(store, identifier, values):
    if not isinstance(values, dict):
        raise ValueError("Invalid blank-page review")
    pages = values.get("pages")
    reviewer = values.get("reviewer")
    if (
        not isinstance(pages, list)
        or not 1 <= len(pages) <= 100
        or any(type(p) is not int or p < 1 or p > pdf.MAX_PAGES for p in pages)
        or len(set(pages)) != len(pages)
        or not isinstance(reviewer, str)
        or not 1 <= len(reviewer.strip()) <= 200
        or values.get("attest_no_text_or_graphics") is not True
        or any(
            not isinstance(values.get(k), str) or not re.fullmatch("[a-f0-9]{64}", values[k])
            for k in ["expected_sha256", "expected_index_identity"]
        )
    ):
        raise ValueError(
            "Select 1–100 distinct pages, a named reviewer, source identities and explicit blank-page attestation"
        )
    pages = sorted(pages)
    with store.connection() as connection:
        connection.execute("BEGIN IMMEDIATE")
        document = _document(connection, identifier)
        before = store.index_identity(identifier, connection=connection)
        if (
            document["sha256"] != values["expected_sha256"]
            or before != values["expected_index_identity"]
        ):
            raise BlankReviewConflict("Source or extraction changed; reload the blank-page review")
        if connection.execute(
            "SELECT 1 FROM jobs WHERE state IN ('queued','running') AND json_extract(request,'$.document_id')=? LIMIT 1",
            (identifier,),
        ).fetchone():
            raise BlankReviewConflict(
                "Document work is queued or running; review only after it finishes"
            )
        original = store.objects / (document["sha256"] + ".pdf")
        try:
            with original.open("rb") as stream:
                data = stream.read(pdf.MAX_PDF_BYTES + 1)
        except OSError as error:
            raise ValueError(
                "Retained original is unavailable; blank review was not saved"
            ) from error
        if len(data) > pdf.MAX_PDF_BYTES or hashlib.sha256(data).hexdigest() != document["sha256"]:
            raise ValueError("Retained original integrity check failed; blank review was not saved")
        placeholders = ",".join("?" for _ in pages)
        rows = connection.execute(
            f"SELECT * FROM pages WHERE document_id=? AND page IN ({placeholders}) ORDER BY page",
            (identifier, *pages),
        ).fetchall()
        has_passages = connection.execute(
            f"SELECT 1 FROM passages WHERE document_id=? AND page IN ({placeholders}) LIMIT 1",
            (identifier, *pages),
        ).fetchone()
        if (
            len(rows) != len(pages)
            or has_passages
            or any(
                r["text"].strip()
                or r["method"] == "blank"
                or (r["method"] != "missing" and r["error"] is None)
                for r in rows
            )
        ):
            raise ValueError(
                "Every selected page must be extracted, unresolved and contain no readable text or indexed passages"
            )
        if document["status"] not in {"indexed", "partial"} or not document["extraction"]:
            raise ValueError("Review requires an existing extraction")
        extraction = json.loads(document["extraction"])
        review_id = "review_" + uuid.uuid4().hex
        timestamp = now()
        verification = [
            {
                "page": p,
                "kind": "operator_attested",
                "source_sha256": document["sha256"],
                "review_id": review_id,
                "reviewer": reviewer.strip(),
                "recorded_at": timestamp,
            }
            for p in pages
        ]
        updated = {
            **extraction,
            "blank_pages": sorted(
                extraction.get("blank_pages", []) + verification, key=lambda v: v["page"]
            ),
        }
        store._archive_distillation(connection, identifier, "blank_page_review")
        connection.executemany(
            "UPDATE pages SET method='blank',error=NULL WHERE document_id=? AND page=?",
            [(identifier, p) for p in pages],
        )
        updated["incomplete_pages"] = [
            r[0]
            for r in connection.execute(
                "SELECT page FROM pages WHERE document_id=? AND (method='missing' OR error IS NOT NULL) ORDER BY page",
                (identifier,),
            )
        ]
        updated["status"] = "partial" if updated["incomplete_pages"] else "indexed"
        connection.execute(
            "UPDATE documents SET status=?,extraction=?,error=NULL WHERE id=?",
            (updated["status"], json.dumps(updated), identifier),
        )
        after = store.index_identity(identifier, connection=connection)
        value = {
            "document_id": identifier,
            "review_id": review_id,
            "source_sha256": document["sha256"],
            "source_metadata": json.loads(document["metadata"]),
            "before_index_identity": before,
            "after_index_identity": after,
            "pages": pages,
            "page_labels": {str(r["page"]): r["label"] for r in rows},
            "reviewer": reviewer.strip(),
            "attest_no_text_or_graphics": True,
            "recorded_at": timestamp,
            "extraction_before": extraction,
            "extraction_after": updated,
        }
        encoded = json.dumps(value, sort_keys=True, separators=(",", ":"), allow_nan=False)
        digest = hashlib.sha256(encoded.encode()).hexdigest()
        connection.execute(
            "INSERT INTO blank_page_reviews VALUES (?,?,?,?,?)",
            (identifier, review_id, encoded, digest, timestamp),
        )
    return {**value, "integrity_sha256": digest}


def _verified(row):
    if hashlib.sha256(row["value"].encode()).hexdigest() != row["integrity_sha256"]:
        raise ValueError("Blank-page review integrity check failed")
    value = json.loads(row["value"])
    if (
        value["document_id"] != row["document_id"]
        or value["review_id"] != row["review_id"]
        or value["recorded_at"] != row["recorded_at"]
    ):
        raise ValueError("Blank-page review identity mismatch")
    return {**value, "integrity_sha256": row["integrity_sha256"]}


def detail(store, identifier, review_id):
    with store.connection() as connection:
        row = connection.execute(
            "SELECT * FROM blank_page_reviews WHERE document_id=? AND review_id=?",
            (identifier, review_id),
        ).fetchone()
        return _verified(row) if row else None


def reviews(store, identifier, *, limit=20, offset=0):
    _bounds(limit, offset)
    with store.connection() as connection:
        connection.execute("BEGIN")
        _document(connection, identifier)
        total = connection.execute(
            "SELECT count(*) FROM blank_page_reviews WHERE document_id=?", (identifier,)
        ).fetchone()[0]
        rows = connection.execute(
            "SELECT * FROM blank_page_reviews WHERE document_id=? ORDER BY recorded_at DESC,review_id DESC LIMIT ? OFFSET ?",
            (identifier, limit, offset),
        ).fetchall()
        items = []
        for row in rows:
            record = _verified(row)
            items.append(
                {
                    k: record[k]
                    for k in ["review_id", "pages", "reviewer", "recorded_at", "integrity_sha256"]
                }
            )
        return {
            "document_id": identifier,
            "items": items,
            "total": total,
            "limit": limit,
            "offset": offset,
            "next_offset": offset + len(items) if offset + len(items) < total else None,
        }
