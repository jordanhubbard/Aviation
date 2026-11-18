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
