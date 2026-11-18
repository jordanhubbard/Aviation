"""Durable source-pinned supplemental OCR previews; no automatic source mutation."""

from __future__ import annotations

import json
import re
import uuid

from . import ocr, pdf
from .store import now


class OCRConflict(ValueError):
    """Source changed or another document operation owns the review boundary."""


class VerifiedOCR(dict):
    """Internal provenance capability, constructed only after ledger verification.

    JSON clients/model output cannot confer this type by setting a boolean flag.
    Wire serialization intentionally remains an ordinary provenance object.
    """


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


def _selected(candidate, selections):
    if not isinstance(selections, list) or not 1 <= len(selections) <= 100:
        raise ValueError("Select 1 to 100 OCR fragments")
    wanted = set()
    for selection in selections:
        if (
            not isinstance(selection, dict)
            or set(selection) != {"page", "fragment_id"}
            or type(selection["page"]) is not int
            or not isinstance(selection["fragment_id"], str)
        ):
            raise ValueError("Select OCR fragment IDs, never replacement text")
        key = (selection["page"], selection["fragment_id"])
        if key in wanted:
            raise ValueError("Duplicate OCR fragment selection")
        wanted.add(key)
    chosen = []
    for page in candidate["pages"]:
        for fragment in page["fragments"]:
            if (page["page"], fragment["id"]) in wanted:
                if page.get("error") or not fragment["text"].strip():
                    raise ValueError("Cannot apply unreadable OCR fragments")
                chosen.append({"page": page["page"], "label": page["label"], **fragment})
    if len(chosen) != len(wanted):
        raise ValueError("Selected OCR fragments are absent from this preview")
    return chosen


def _apply_candidate(store, connection, identifier, values):
    row = _pin(store, connection, identifier, values)
    candidate = _preview(connection, identifier, values["preview_id"])
    if (
        candidate["integrity_sha256"] != values["preview_integrity_sha256"]
        or candidate["source_sha256"] != row["sha256"]
        or candidate["index_identity"] != values["expected_index_identity"]
        or candidate["source_metadata"] != json.loads(row["metadata"])
    ):
        raise OCRConflict("Preview no longer matches the source; request a fresh preview")
    if connection.execute(
        "SELECT 1 FROM ocr_reviews WHERE preview_id=?", (values["preview_id"],)
    ).fetchone():
        raise OCRConflict("This OCR preview has already been applied")
    return row, candidate, _selected(candidate, values["selections"])


def queue_apply(store, identifier, values):
    _identities(values)
    if (
        set(values)
        != {
            "preview_id",
            "preview_integrity_sha256",
            "expected_sha256",
            "expected_index_identity",
            "selections",
            "reviewer",
            "attest_matches_image",
        }
        or not isinstance(values["preview_id"], str)
        or not isinstance(values["preview_integrity_sha256"], str)
        or not re.fullmatch(r"[a-f0-9]{64}", values["preview_integrity_sha256"])
        or not isinstance(values["reviewer"], str)
        or not 1 <= len(values["reviewer"].strip()) <= 200
        or values["attest_matches_image"] is not True
    ):
        raise ValueError(
            "OCR application requires fragment IDs, a named reviewer and image attestation"
        )
    job_id = "job_" + uuid.uuid4().hex
    with store.connection() as connection:
        connection.execute("BEGIN IMMEDIATE")
        row, _, _ = _apply_candidate(store, connection, identifier, values)
        _exclusive(connection, identifier)
        request = {
            **values,
            "document_id": identifier,
            "source_metadata": json.loads(row["metadata"]),
        }
        connection.execute(
            "INSERT INTO jobs VALUES (?,?,'queued',?,NULL,NULL,?,?,NULL)",
            (job_id, "ocr_apply", json.dumps(request), now(), now()),
        )
    return store.job(job_id)


def _review(connection, identifier, review_id):
    row = connection.execute(
        "SELECT value,integrity_sha256 FROM ocr_reviews WHERE id=? AND document_id=?",
        (review_id, identifier),
    ).fetchone()
    if row is None:
        raise ValueError("OCR review not found")
    if ocr.digest(row["value"].encode()) != row["integrity_sha256"]:
        raise ValueError("Retained OCR review integrity check failed")
    return {**json.loads(row["value"]), "integrity_sha256": row["integrity_sha256"]}


def apply_review(store, job):
    request = job["request"]
    identifier = request["document_id"]
    with store.connection() as connection:
        connection.execute("BEGIN IMMEDIATE")
        _owned(store, connection, job)
        saved = store.checkpoint(job["id"], connection=connection)
        if saved.get("review_id"):
            retained = _review(connection, identifier, saved["review_id"])
            if (
                store.index_identity(identifier, connection=connection)
                != retained["after_index_identity"]
            ):
                raise OCRConflict(
                    "Document changed after OCR application; pending vectors were not resumed"
                )
            return retained
        row, candidate, chosen = _apply_candidate(store, connection, identifier, request)
        _original(store, row)
        # Validate every selected page image before accepting the attestation.
        for number in {fragment["page"] for fragment in chosen}:
            image = connection.execute(
                "SELECT image,sha256 FROM ocr_preview_images WHERE preview_id=? AND page=?",
                (candidate["id"], number),
            ).fetchone()
            expected = next(p["image_sha256"] for p in candidate["pages"] if p["page"] == number)
            if (
                image is None
                or image["sha256"] != expected
                or ocr.digest(image["image"]) != expected
            ):
                raise ValueError("Retained OCR page image integrity check failed")
        review_id, timestamp = "ocr_review_" + uuid.uuid4().hex, now()
        store._archive_distillation(connection, identifier, "reviewed_ocr_added")
        retained_fragments = []
        for fragment in chosen:
            cursor = connection.execute(
                "INSERT INTO passages VALUES (?,?,?,?,?,?)",
                (
                    identifier,
                    fragment["page"],
                    fragment["label"],
                    fragment["offset"],
                    fragment["text"],
                    "ocr",
                ),
            )
            retained_fragments.append({**fragment, "passage_id": cursor.lastrowid})
        extraction = json.loads(row["extraction"])
        extraction.setdefault("supplemental_ocr_reviews", []).append(review_id)
        connection.execute(
            "UPDATE documents SET extraction=? WHERE id=?", (json.dumps(extraction), identifier)
        )
        connection.execute(
            "DELETE FROM artifacts WHERE document_id=? AND kind='distillation'", (identifier,)
        )
        review = {
            "id": review_id,
            "document_id": identifier,
            "preview_id": candidate["id"],
            "preview_integrity_sha256": candidate["integrity_sha256"],
            "job_id": job["id"],
            "source_sha256": row["sha256"],
            "source_metadata": json.loads(row["metadata"]),
            "reviewer": request["reviewer"].strip(),
            "attest_matches_image": True,
            "created_at": timestamp,
            "before_index_identity": request["expected_index_identity"],
            "after_index_identity": store.index_identity(identifier, connection=connection),
            "fragments": retained_fragments,
            "engine": candidate["engine"],
            "engine_version": candidate["engine_version"],
            "mode": candidate["mode"],
        }
        value = ocr.encoded(review)
        connection.execute(
            "INSERT INTO ocr_reviews VALUES (?,?,?,?,?,?,?)",
            (
                review_id,
                identifier,
                candidate["id"],
                job["id"],
                value.decode(),
                ocr.digest(value),
                timestamp,
            ),
        )
        connection.executemany(
            "INSERT INTO ocr_passages VALUES (?,?,?,?,?)",
            [
                (f["passage_id"], identifier, review_id, f["page"], f["id"])
                for f in retained_fragments
            ],
        )
        store.checkpoint(job["id"], {"review_id": review_id}, connection=connection)
        return {**review, "integrity_sha256": ocr.digest(value)}


def review(store, identifier, review_id):
    with store.connection() as connection:
        connection.execute("BEGIN")
        result = _review(connection, identifier, review_id)
        row = _document(connection, identifier, require_extraction=False)
        result["active"] = review_id in json.loads(row["extraction"] or "{}").get(
            "supplemental_ocr_reviews", []
        )
        result["source_current"] = (
            store.index_identity(identifier, connection=connection)
            == result["after_index_identity"]
        )
        return result


def records(store, identifier, *, kind="previews", limit=20, offset=0):
    if (
        type(limit) is not int
        or not 1 <= limit <= 100
        or type(offset) is not int
        or not 0 <= offset <= 1_000_000
    ):
        raise ValueError("Invalid OCR history pagination")
    if kind not in {"previews", "reviews"}:
        raise ValueError("Invalid OCR history kind")
    with store.connection() as connection:
        _document(connection, identifier, require_extraction=False)
        rows = connection.execute(
            f"SELECT id,created_at,integrity_sha256 FROM ocr_{kind} WHERE document_id=? "
            "ORDER BY created_at DESC,id LIMIT ? OFFSET ?",
            (identifier, limit + 1, offset),
        ).fetchall()
        return {
            "items": [dict(r) for r in rows[:limit]],
            "next_offset": offset + limit if len(rows) > limit else None,
        }


def queue_review_embedding(store, identifier, review_id, values):
    _identities(values)
    if set(values) != {"expected_sha256", "expected_index_identity"}:
        raise ValueError("Unknown OCR embedding fields")
    job_id = "job_" + uuid.uuid4().hex
    with store.connection() as connection:
        connection.execute("BEGIN IMMEDIATE")
        row = _pin(store, connection, identifier, values)
        _exclusive(connection, identifier)
        saved = _review(connection, identifier, review_id)
        if saved["id"] not in json.loads(row["extraction"]).get("supplemental_ocr_reviews", []):
            raise OCRConflict("This OCR review is no longer active")
        request = {**values, "document_id": identifier, "review_id": review_id}
        connection.execute(
            "INSERT INTO jobs VALUES (?,?,'queued',?,NULL,NULL,?,?,NULL)",
            (job_id, "ocr_embed", json.dumps(request), now(), now()),
        )
    return store.job(job_id)


def embedding_review(store, job):
    request = job["request"]
    with store.connection() as connection:
        connection.execute("BEGIN")
        _owned(store, connection, job)
        _pin(store, connection, request["document_id"], request)
        return _review(connection, request["document_id"], request["review_id"])


def enrich_passages(connection, passages, *, source_order=False):
    """Verify the ledger before granting whole-fragment quotation provenance.

    Snapshot readers may predate these additive tables. Unaffected source objects,
    ordering and generation fingerprints must remain byte-for-byte equivalent.
    """
    from .transcriptions import enrich_passages as transcriptions
    from .source_limits import enrich_passages as source_limits

    def enrich_transcriptions(connection, rows, **options):
        return source_limits(connection, transcriptions(connection, rows, **options))

    if (
        not passages
        or not connection.execute(
            "SELECT 1 FROM sqlite_master WHERE type='table' AND name='ocr_passages'"
        ).fetchone()
    ):
        return enrich_transcriptions(connection, passages, source_order=source_order)
    documents, reviews, candidates, expected_reviews, affected = {}, {}, {}, {}, set()
    for passage in passages:
        identifier = passage["document_id"]
        if identifier not in documents:
            row = connection.execute(
                "SELECT extraction FROM documents WHERE id=?", (identifier,)
            ).fetchone()
            documents[identifier] = json.loads(row[0] or "{}").get("supplemental_ocr_reviews", [])
            expected_reviews[identifier] = {}
            for review_id in documents[identifier]:
                retained = _review(connection, identifier, review_id)
                candidate = _preview(connection, identifier, retained["preview_id"])
                if candidate["integrity_sha256"] != retained["preview_integrity_sha256"]:
                    raise ValueError("OCR review preview integrity mismatch")
                reviews[review_id], candidates[review_id] = retained, candidate
                for fragment in retained["fragments"]:
                    mapped = connection.execute(
                        "SELECT m.review_id,m.page,m.fragment_id FROM ocr_passages m "
                        "JOIN passages p ON p.rowid=m.passage_id AND p.document_id=m.document_id "
                        "WHERE m.passage_id=? AND m.document_id=?",
                        (fragment["passage_id"], identifier),
                    ).fetchone()
                    if mapped is None or tuple(mapped) != (
                        review_id,
                        fragment["page"],
                        fragment["id"],
                    ):
                        raise ValueError("Missing or mismatched OCR passage provenance")
                    expected_reviews[identifier][fragment["passage_id"]] = review_id
        active = documents[identifier]
        if not active:
            continue
        mapping = connection.execute(
            "SELECT * FROM ocr_passages WHERE passage_id=? AND document_id=?",
            (passage["passage_id"], identifier),
        ).fetchone()
        if mapping is None:
            if passage["passage_id"] in expected_reviews[identifier]:
                raise ValueError("Missing OCR passage provenance")
            continue
        review_id = mapping["review_id"]
        if (
            review_id not in active
            or expected_reviews[identifier].get(passage["passage_id"]) != review_id
        ):
            raise ValueError("Inactive OCR passage provenance")
        retained, candidate = reviews[review_id], candidates[review_id]
        fragment = next(
            (f for f in retained["fragments"] if f["passage_id"] == passage["passage_id"]), None
        )
        if fragment is None or any(
            passage[k] != fragment[k] for k in ("page", "label", "offset", "text")
        ):
            raise ValueError("OCR passage no longer matches its reviewed fragment")
        selected = _selected(
            candidate, [{"page": fragment["page"], "fragment_id": fragment["id"]}]
        )[0]
        if (
            any(fragment[k] != selected[k] for k in selected)
            or mapping["fragment_id"] != fragment["id"]
            or passage["method"] != "ocr"
        ):
            raise ValueError("OCR review selection integrity mismatch")
        passage["ocr_review"] = VerifiedOCR(
            {
                "review_id": review_id,
                "preview_id": candidate["id"],
                "fragment_id": fragment["id"],
                "reviewer": retained["reviewer"],
                "reviewed_at": retained["created_at"],
                "integrity_sha256": retained["integrity_sha256"],
                "source_sha256": retained["source_sha256"],
                "source_metadata": retained["source_metadata"],
                "engine": retained["engine"],
                "engine_version": retained["engine_version"],
                "mode": retained["mode"],
                "confidence": fragment["confidence"],
                "bbox": fragment["bbox"],
                "image_url": f"/api/aircraft-library/documents/{identifier}/ocr-previews/{candidate['id']}/pages/{passage['page']}.png",
            }
        )
        affected.add(identifier)
    if source_order and affected:
        ordered, emitted = [], set()
        for passage in passages:
            identifier = passage["document_id"]
            if identifier not in affected:
                ordered.append(passage)
            elif identifier not in emitted:
                ordered.extend(
                    sorted(
                        (p for p in passages if p["document_id"] == identifier),
                        key=lambda p: (
                            p["page"],
                            bool(p.get("ocr_review")),
                            p["offset"],
                            p["passage_id"],
                        ),
                    )
                )
                emitted.add(identifier)
        return enrich_transcriptions(connection, ordered, source_order=source_order)
    return enrich_transcriptions(connection, passages, source_order=source_order)
