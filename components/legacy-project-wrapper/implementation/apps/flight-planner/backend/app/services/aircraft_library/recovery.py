"""Explicit, inference-free admission of a validated prefix from a private snapshot."""

from __future__ import annotations

from contextlib import closing
import copy
import hashlib
import json
from pathlib import Path
import sqlite3

from .models import distillation_context, distillation_plan, validated_prefix, validate_answer
from .store import now


class _Snapshot:
    def __init__(self, connection):
        self.connection = connection

    def get(self, identifier):
        row = self.connection.execute(
            "SELECT * FROM documents WHERE id=?", (identifier,)
        ).fetchone()
        if row is None:
            raise ValueError("Snapshot document not found")
        value = dict(row)
        for key in ("metadata", "extraction"):
            value[key] = json.loads(value[key]) if value[key] else None
        value["artifacts"] = {
            r["kind"]: json.loads(r["value"])
            for r in self.connection.execute(
                "SELECT kind,value FROM artifacts WHERE document_id=?", (identifier,)
            )
        }
        return value

    def passages(self, identifiers):
        from .ocr_reviews import enrich_passages

        rows = [
            dict(r)
            for r in self.connection.execute(
                "SELECT rowid AS passage_id,* FROM passages WHERE document_id=? ORDER BY rowid",
                (identifiers[0],),
            )
        ]
        return enrich_passages(self.connection, rows, source_order=True)


def _passage_key(passage):
    native = tuple(
        passage[key] for key in ("document_id", "page", "label", "offset", "text", "method")
    )
    return native + (
        (json.dumps(passage["ocr_review"], sort_keys=True),) if passage.get("ocr_review") else ()
    )


def recover_distillation(store, models, identifier, snapshot_path):
    """Require exact source identity, remap only identical passages, then compare-and-swap."""
    path = Path(snapshot_path).resolve(strict=True)
    # Never open the live database as its own recovery candidate.
    if path.samefile(store.db):
        raise ValueError("Recovery requires a separate read-only snapshot")
    wal = Path(str(path) + "-wal")
    if wal.exists() and wal.stat().st_size:
        raise ValueError("Recovery requires a standalone SQLite backup without a WAL sidecar")
    with path.open("rb") as stream:
        snapshot_digest = hashlib.file_digest(stream, "sha256").hexdigest()
    with closing(sqlite3.connect(path.as_uri() + "?mode=ro&immutable=1", uri=True)) as connection:
        connection.row_factory = sqlite3.Row
        connection.execute("PRAGMA query_only=ON")
        connection.execute("BEGIN")
        source = _Snapshot(connection)
        old, roots, _, fingerprint = distillation_context(source, models, identifier)
        saved = old["artifacts"].get("distillation", {})
        if (
            saved.get("status") not in {"partial", "complete"}
            or saved.get("evidence_identity") != fingerprint
        ):
            raise ValueError("Snapshot distillation evidence identity does not match configuration")
        old_plan = distillation_plan(roots, saved.get("batch_plan"))
        prefix = validated_prefix(saved, old_plan)
        if not prefix or len(prefix) != len(saved.get("sections", [])):
            raise ValueError("Snapshot prefix did not fully validate")
        identity = store.index_identity(identifier)
        current, current_roots, _, current_fingerprint = distillation_context(
            store, models, identifier
        )
        if (
            old["sha256"] != current["sha256"]
            or old["metadata"] != current["metadata"]
            or old["extraction"] != current["extraction"]
        ):
            raise ValueError("Snapshot original, metadata or extraction differs")
        original = store.original(identifier)
        with original.open("rb") as stream:
            if hashlib.file_digest(stream, "sha256").hexdigest() != old["sha256"]:
                raise ValueError("Current original bytes do not match snapshot identity")
        old_passages = [p for batch in roots for p in batch]
        current_passages = [p for batch in current_roots for p in batch]
        if [_passage_key(p) for p in old_passages] != [_passage_key(p) for p in current_passages]:
            raise ValueError("Snapshot passage text, order or provenance differs")
        remap = {
            old_p["passage_id"]: new_p["passage_id"]
            for old_p, new_p in zip(old_passages, current_passages)
        }
        plan = distillation_plan(
            current_roots, [[remap[p["passage_id"]] for p in batch] for batch in old_plan]
        )
        recovered = []
        for section, batch in zip(prefix, plan):
            candidate = copy.deepcopy(section)
            for claim in candidate["claims"]:
                for citation in claim["citations"]:
                    citation["passage_id"] = remap[citation["passage_id"]]
            recovered.append(
                {"pages": sorted({p["page"] for p in batch}), **validate_answer(candidate, batch)}
            )
        previous = current["artifacts"].get("distillation")
        if previous and previous.get("evidence_identity") == current_fingerprint:
            current_plan = distillation_plan(current_roots, previous.get("batch_plan"))
            current_prefix = validated_prefix(previous, current_plan)

            # Retain current work whenever it covers at least as much exact evidence.
            def covered(batches, count):
                return sum(len(b) for b in batches[:count])

            if covered(current_plan, len(current_prefix)) >= covered(plan, len(recovered)):
                return {
                    "status": "unchanged",
                    "completed_batches": len(current_prefix),
                    "model_calls": 0,
                }
        value = {
            **saved,
            "status": "partial",
            "generated_at": now(),
            "completed_batches": len(recovered),
            "total_batches": len(plan),
            "unresolved_batches": len(plan) - len(recovered),
            "sections": recovered,
            "evidence_identity": current_fingerprint,
            "batch_plan": [[p["passage_id"] for p in batch] for batch in plan],
            "document_extraction": current["extraction"],
            "recovery": {
                "snapshot_sha256": snapshot_digest,
                "source_evidence_identity": fingerprint,
                "recovered_at": now(),
                "recovered_batches": len(recovered),
                "recovered_claims": sum(len(s["claims"]) for s in recovered),
            },
        }
        store.artifact(
            identifier,
            "distillation",
            value,
            expected_metadata=current["metadata"],
            expected_index_identity=identity,
            expected_previous=previous,
        )
        return {"status": "recovered", **value["recovery"], "model_calls": 0}


def _verify_review_images(connection, identifier, passages):
    from .ocr_reviews import _preview

    images = {(p["ocr_review"]["preview_id"], p["page"]) for p in passages if p.get("ocr_review")}
    for preview_id, page in sorted(images):
        candidate = _preview(connection, identifier, preview_id)
        expected = next(p["image_sha256"] for p in candidate["pages"] if p["page"] == page)
        image = connection.execute(
            "SELECT image,sha256 FROM ocr_preview_images WHERE preview_id=? AND page=?",
            (preview_id, page),
        ).fetchone()
        if (
            image is None
            or image["sha256"] != expected
            or hashlib.sha256(image["image"]).hexdigest() != expected
        ):
            raise ValueError("Retained OCR page image integrity check failed")


def recover_reviewed_ocr_prefix(store, models, identifier, snapshot_path):
    """Explicitly admit unchanged leading scopes after verified additive OCR only."""
    from .ocr_reviews import VerifiedOCR

    with store.connection() as live:
        if live.execute(
            "SELECT 1 FROM jobs WHERE state IN ('queued','running') "
            "AND json_extract(request,'$.document_id')=? LIMIT 1",
            (identifier,),
        ).fetchone():
            raise ValueError("Document work is queued or running; recovery requires idle work")
    path = Path(snapshot_path).resolve(strict=True)
    if path.samefile(store.db):
        raise ValueError("Recovery requires a separate read-only snapshot")
    wal = Path(str(path) + "-wal")
    if wal.exists() and wal.stat().st_size:
        raise ValueError("Recovery requires a standalone SQLite backup without a WAL sidecar")
    with path.open("rb") as stream:
        snapshot_digest = hashlib.file_digest(stream, "sha256").hexdigest()
    with closing(sqlite3.connect(path.as_uri() + "?mode=ro&immutable=1", uri=True)) as connection:
        connection.row_factory = sqlite3.Row
        connection.execute("PRAGMA query_only=ON")
        connection.execute("BEGIN")
        source = _Snapshot(connection)
        old, old_roots, _, fingerprint = distillation_context(source, models, identifier)
        saved = old["artifacts"].get("distillation", {})
        if (
            saved.get("status") not in {"partial", "complete"}
            or saved.get("evidence_identity") != fingerprint
        ):
            raise ValueError("Snapshot distillation evidence identity does not match configuration")
        old_plan = distillation_plan(old_roots, saved.get("batch_plan"))
        prefix = validated_prefix(saved, old_plan)
        if not prefix or len(prefix) != len(saved.get("sections", [])):
            raise ValueError("Snapshot prefix did not fully validate")
        source_guard = store.recovery_identity(identifier)
        identity = store.index_identity(identifier)
        current, roots, _, current_fingerprint = distillation_context(store, models, identifier)
        if any(old[key] != current[key] for key in ("sha256", "metadata", "status")):
            raise ValueError("Snapshot original, metadata or extraction status differs")
        old_extraction, current_extraction = copy.deepcopy(old["extraction"]), copy.deepcopy(
            current["extraction"]
        )
        old_reviews = old_extraction.pop("supplemental_ocr_reviews", [])
        reviews = current_extraction.pop("supplemental_ocr_reviews", [])
        if (
            old_extraction != current_extraction
            or not isinstance(old_reviews, list)
            or not isinstance(reviews, list)
            or any(not isinstance(r, str) for r in old_reviews + reviews)
            or len(set(old_reviews)) != len(old_reviews)
            or len(set(reviews)) != len(reviews)
            or reviews[: len(old_reviews)] != old_reviews
            or len(reviews) <= len(old_reviews)
        ):
            raise ValueError("Recovery permits only appended supplemental OCR reviews")
        added = set(reviews[len(old_reviews) :])
        with store.connection() as live:
            live.execute("BEGIN")
            for table in ("pages", "blank_page_reviews"):
                order = "page" if table == "pages" else "review_id"
                query = "SELECT * FROM " + table + " WHERE document_id=? ORDER BY " + order
                if [tuple(r) for r in connection.execute(query, (identifier,))] != [
                    tuple(r) for r in live.execute(query, (identifier,))
                ]:
                    raise ValueError("Snapshot native pages or blank reviews differ")
        with store.original(identifier).open("rb") as stream:
            if hashlib.file_digest(stream, "sha256").hexdigest() != old["sha256"]:
                raise ValueError("Current original bytes do not match snapshot identity")
        old_passages = [p for batch in old_roots for p in batch]
        passages = [p for batch in roots for p in batch]
        retained, seen = [], set()
        for passage in passages:
            provenance = passage.get("ocr_review")
            if provenance and provenance.get("review_id") in added:
                if not isinstance(provenance, VerifiedOCR):
                    raise ValueError("Additional OCR lacks verified provenance")
                seen.add(provenance["review_id"])
            else:
                retained.append(passage)
        if seen != added or [_passage_key(p) for p in old_passages] != [
            _passage_key(p) for p in retained
        ]:
            raise ValueError("Native or prior OCR passage text, order or provenance differs")
        _verify_review_images(connection, identifier, old_passages)
        with store.connection() as live:
            live.execute("BEGIN")
            _verify_review_images(live, identifier, passages)
        remap = {a["passage_id"]: b["passage_id"] for a, b in zip(old_passages, retained)}
        boundaries, count = set(), 0
        for batch in roots:
            count += len(batch)
            boundaries.add(count)
        recovered, kept, cursor = [], [], 0
        for section, batch in zip(prefix, old_plan):
            end = cursor + len(batch)
            candidate_batch = passages[cursor:end]
            if [_passage_key(p) for p in batch] != [
                _passage_key(p) for p in candidate_batch
            ] or any(cursor < boundary < end for boundary in boundaries):
                break
            candidate = copy.deepcopy(section)
            for claim in candidate["claims"]:
                for citation in claim["citations"]:
                    citation["passage_id"] = remap[citation["passage_id"]]
            recovered.append(
                {
                    "pages": sorted({p["page"] for p in candidate_batch}),
                    **validate_answer(candidate, candidate_batch),
                }
            )
            kept.append(candidate_batch)
            cursor = end
        if not recovered:
            raise ValueError("No unchanged leading batch scopes remain")
        tail, offset = [], 0
        for batch in roots:
            end = offset + len(batch)
            if end > cursor:
                tail.append(batch[max(0, cursor - offset) :])
            offset = end
        plan = distillation_plan(roots, [[p["passage_id"] for p in batch] for batch in kept + tail])
        previous = current["artifacts"].get("distillation")
        if previous:
            if previous.get("evidence_identity") != current_fingerprint or previous.get(
                "status"
            ) not in {"partial", "complete"}:
                raise ValueError("Current distillation belongs to another generation or state")
            previous_plan = distillation_plan(roots, previous.get("batch_plan"))
            previous_prefix = validated_prefix(previous, previous_plan)
            if len(previous_prefix) != len(previous.get("sections", [])):
                raise ValueError("Current prefix did not fully validate")
            if sum(len(b) for b in previous_plan[: len(previous_prefix)]) >= cursor:
                return {
                    "status": "unchanged",
                    "completed_batches": len(previous_prefix),
                    "model_calls": 0,
                }
        with path.open("rb") as stream:
            if hashlib.file_digest(stream, "sha256").hexdigest() != snapshot_digest:
                raise ValueError("Snapshot changed during recovery")
        receipt = {
            "kind": "reviewed_ocr_prefix",
            "snapshot_sha256": snapshot_digest,
            "source_evidence_identity": fingerprint,
            "source_generated_at": saved.get("generated_at"),
            "source_generation_changed": True,
            "added_review_ids": sorted(added),
            "unchanged_scope_sha256": hashlib.sha256(
                json.dumps(
                    [[_passage_key(p) for p in b] for b in kept], sort_keys=True, allow_nan=False
                ).encode()
            ).hexdigest(),
            "recovered_at": now(),
            "recovered_batches": len(recovered),
            "recovered_claims": sum(len(s["claims"]) for s in recovered),
            "new_model_completions": 0,
        }
        value = {
            **saved,
            "status": "partial",
            "generated_at": now(),
            "evidence_identity": current_fingerprint,
            "completed_batches": len(recovered),
            "total_batches": len(plan),
            "unresolved_batches": len(plan) - len(recovered),
            "sections": recovered,
            "batch_plan": [[p["passage_id"] for p in batch] for batch in plan],
            "document_extraction": current["extraction"],
            "recovery": receipt,
        }
        store.artifact(
            identifier,
            "distillation",
            value,
            expected_metadata=current["metadata"],
            expected_index_identity=identity,
            expected_previous=previous,
            expected_idle=True,
            expected_recovery_identity=source_guard,
        )
        return {"status": "recovered", **receipt, "model_calls": 0}
