"""Original-pinned, explicitly reviewed performance datasets. No LLM execution."""

from __future__ import annotations

from contextlib import contextmanager
from datetime import datetime, timezone
from decimal import Decimal
import hashlib
import json
import math
import os
import sqlite3

from ..schemas.aircraft_performance import (
    DatasetDraft,
    Calculation,
    Review,
    Retirement,
    METRIC_UNITS,
    LinearCorrection,
)
from .aircraft_library.models import numbers, original_quote
from .aircraft_library.store import icao
from .performance_tables import interpolate


def now():
    return datetime.now(timezone.utc).isoformat()


def canonical(value):
    return json.dumps(value, sort_keys=True, separators=(",", ":"), allow_nan=False)


def identity(content, metadata):
    return hashlib.sha256(
        canonical({"content": content, "source_metadata": metadata}).encode()
    ).hexdigest()


class Registry:
    def __init__(self, library):
        self.library = library
        self.path = library.root / "performance.sqlite3"
        with self.connection() as connection:
            version = connection.execute("PRAGMA user_version").fetchone()[0]
            if version not in (0, 1):
                raise ValueError("Unsupported aircraft-performance database schema")
            connection.execute("""CREATE TABLE IF NOT EXISTS datasets (
                id TEXT PRIMARY KEY, content_sha256 TEXT NOT NULL,
                source_document_id TEXT NOT NULL, icao TEXT NOT NULL,
                content TEXT NOT NULL, source_metadata TEXT NOT NULL,
                created_at TEXT NOT NULL, reviewed_at TEXT, reviewer TEXT,
                retired_at TEXT, retirement_reason TEXT
            )""")
            connection.execute(
                "CREATE INDEX IF NOT EXISTS performance_icao ON datasets(icao,created_at)"
            )
            connection.execute("PRAGMA user_version=1")
        os.chmod(self.path, 0o600)

    @contextmanager
    def connection(self):
        connection = sqlite3.connect(self.path, timeout=30)
        connection.row_factory = sqlite3.Row
        try:
            with connection:
                yield connection
        finally:
            connection.close()

    def _source(self, content, metadata, *, normalize=False):
        document = self.library.get(content.source_document_id)
        if document is None or document["sha256"] != content.source_sha256:
            raise ValueError(
                "The pinned original manual is unavailable or has a different identity"
            )
        if document["metadata"] != metadata:
            raise ValueError(
                "Source metadata/applicability changed; create and review a new dataset"
            )
        for field, expected in (
            ("icao", content.icao),
            ("variant", content.variant),
            ("revision", content.source_revision),
        ):
            if not expected.strip() or metadata.get(field) != expected:
                raise ValueError(
                    "Dataset ICAO, variant and revision must exactly match reviewed document metadata"
                )
        original = self.library.original(document["id"])
        if original is None or not original.is_file():
            raise ValueError("The pinned original manual is unavailable")
        try:
            with original.open("rb") as source:
                digest = hashlib.file_digest(source, "sha256").hexdigest()
        except OSError as error:
            raise ValueError("The pinned original manual is unavailable") from error
        if digest != content.source_sha256:
            raise ValueError("Original manual integrity check failed")
        if metadata.get("kind") not in {"POH", "AFM", "PIM", "SUPPLEMENT"}:
            raise ValueError("Performance datasets require an operating-manual source")
        warnings = []
        if metadata.get("kind") == "PIM":
            warnings.append(
                "Information-manual reference only; not a substitute for the aircraft's current approved POH/AFM"
            )
        if document["status"] != "indexed":
            warnings.append(
                "The source document has incomplete extraction; only cited recovered pages support this dataset"
            )

        def quoted(citations):
            text = []
            for citation in citations:
                page = self.library.page(document["id"], citation.page)
                resolved = (
                    original_quote(page["text"], citation.quote)
                    if page and not page["error"]
                    else None
                )
                if resolved is None or (not normalize and resolved != citation.quote):
                    raise ValueError("Cited page evidence is missing or changed")
                if normalize:
                    citation.quote = resolved
                if page["method"] == "ocr":
                    warnings.append(
                        "Cited OCR text requires visual verification against the pinned original"
                    )
                text.append(resolved)
            return numbers(" ".join(text))

        for table in content.tables:
            if table.interpolation_axes:
                quoted(table.interpolation_citations)
            if table.combination_citations:
                quoted(table.combination_citations)
            # The same bounded kernel rejects incomplete/duplicate grids before review.
            interpolate(
                [p.model_dump() for p in table.points], table.axes, table.points[0].coordinates
            )
            for point in table.points:
                supported = quoted(point.citations)
                given = {Decimal(str(n)) for n in (*point.coordinates.values(), point.value)}
                if not given.issubset(supported):
                    raise ValueError(
                        "A transcribed value/coordinate is absent from its original page quotations"
                    )
            for correction in table.corrections:
                required = {Decimal(str(correction.percent))}
                if isinstance(correction, LinearCorrection):
                    required.add(Decimal(str(correction.per_units)))
                if not required.issubset(quoted(correction.citations)):
                    raise ValueError(
                        "Correction percentage/divisor is absent from its original page quotations"
                    )
        return document, sorted(set(warnings))

    def create(self, draft: DatasetDraft):
        content = draft.model_copy(deep=True)
        document = self.library.get(content.source_document_id)
        if document is None:
            raise ValueError("Source document not found")
        metadata = document["metadata"]
        self._source(content, metadata, normalize=True)
        payload = content.model_dump(mode="json")
        digest = identity(payload, metadata)
        identifier = "perf_" + digest
        with self.connection() as connection:
            connection.execute(
                "INSERT OR IGNORE INTO datasets(id,content_sha256,source_document_id,icao,content,source_metadata,created_at) VALUES (?,?,?,?,?,?,?)",
                (
                    identifier,
                    digest,
                    content.source_document_id,
                    content.icao,
                    canonical(payload),
                    canonical(metadata),
                    now(),
                ),
            )
        return self.get(identifier)

    def _stored(self, identifier):
        with self.connection() as connection:
            row = connection.execute("SELECT * FROM datasets WHERE id=?", (identifier,)).fetchone()
        if row is None:
            raise ValueError("Performance dataset not found")
        record = dict(row)
        record["content"], record["source_metadata"] = json.loads(record["content"]), json.loads(
            record["source_metadata"]
        )
        source_document_id, code = record.pop("source_document_id"), record.pop("icao")
        if (
            source_document_id != record["content"]["source_document_id"]
            or code != record["content"]["icao"]
        ):
            raise ValueError("Performance dataset index integrity check failed")
        digest = identity(record["content"], record["source_metadata"])
        if record["id"] != "perf_" + digest or record["content_sha256"] != digest:
            raise ValueError("Performance dataset integrity check failed")
        DatasetDraft.model_validate(record["content"])
        return record

    def get(self, identifier):
        record = self._stored(identifier)
        reason = None
        try:
            self._source(DatasetDraft.model_validate(record["content"]), record["source_metadata"])
        except (ValueError, OSError) as error:
            reason = (
                str(error) if isinstance(error, ValueError) else "Pinned original is unavailable"
            )
        state = (
            "retired"
            if record["retired_at"]
            else "stale" if reason else "reviewed" if record["reviewed_at"] else "draft"
        )
        return {
            **record,
            "state": state,
            "usable": state == "reviewed",
            "unavailable_reason": reason,
        }

    def list(self, code, *, registration=None, variant=None, revision=None, offset=0, limit=25):
        if not 0 <= offset <= 100000 or not 1 <= limit <= 100:
            raise ValueError("Invalid performance catalog page")
        code = icao(code)
        documents = set(
            self.library.select(code, registration=registration, variant=variant, revision=revision)
        )
        with self.connection() as connection:
            identifiers = [
                r["id"]
                for r in connection.execute(
                    "SELECT id,source_document_id FROM datasets WHERE icao=? ORDER BY created_at DESC,id",
                    (code,),
                )
                if r["source_document_id"] in documents
            ]
        summaries = []
        for identifier in identifiers[offset : offset + limit]:
            record = self.get(identifier)
            content = record["content"]
            summaries.append(
                {
                    **{
                        key: record[key]
                        for key in (
                            "id",
                            "content_sha256",
                            "created_at",
                            "reviewed_at",
                            "reviewer",
                            "retired_at",
                            "retirement_reason",
                            "state",
                            "usable",
                            "unavailable_reason",
                        )
                    },
                    **{
                        key: content[key]
                        for key in (
                            "title",
                            "icao",
                            "variant",
                            "source_revision",
                            "configuration",
                            "source_document_id",
                            "source_sha256",
                        )
                    },
                    "table_ids": [table["id"] for table in content["tables"]],
                    "metrics": sorted({table["metric"] for table in content["tables"]}),
                }
            )
        return {"datasets": summaries, "total": len(identifiers), "offset": offset, "limit": limit}

    def review(self, identifier, review: Review):
        record = self._stored(identifier)
        if record["content_sha256"] != review.expected_content_sha256:
            raise ValueError("Dataset content changed before review")
        self._source(DatasetDraft.model_validate(record["content"]), record["source_metadata"])
        with self.connection() as connection:
            connection.execute("BEGIN IMMEDIATE")
            current = connection.execute(
                "SELECT * FROM datasets WHERE id=?", (identifier,)
            ).fetchone()
            if current["retired_at"]:
                raise ValueError("Retired datasets cannot be reviewed")
            if current["reviewed_at"] and current["reviewer"] != review.reviewer:
                raise ValueError("Review records are immutable; create a new dataset revision")
            connection.execute(
                "UPDATE datasets SET reviewer=?,reviewed_at=COALESCE(reviewed_at,?) WHERE id=?",
                (review.reviewer, now(), identifier),
            )
        return self.get(identifier)

    def retire(self, identifier, request: Retirement):
        record = self._stored(identifier)
        if request.expected_content_sha256 != record["content_sha256"]:
            raise ValueError("Dataset content changed before retirement")
        with self.connection() as connection:
            connection.execute(
                "UPDATE datasets SET retired_at=COALESCE(retired_at,?), retirement_reason=COALESCE(retirement_reason,?) WHERE id=?",
                (now(), request.reason, identifier),
            )
        return self.get(identifier)

    def calculate(self, identifier, request: Calculation):
        record = self._stored(identifier)
        if not record["reviewed_at"] or record["retired_at"]:
            raise ValueError("Only reviewed, non-retired datasets can be calculated")
        content = DatasetDraft.model_validate(record["content"])
        document, warnings = self._source(content, record["source_metadata"])
        selected = self.library.select(
            request.icao,
            registration=request.registration,
            variant=request.variant,
            revision=content.source_revision,
        )
        if (
            document["id"] not in selected
            or request.variant != content.variant
            or request.configuration != content.configuration
        ):
            raise ValueError(
                "Requested type/tail/variant/configuration does not match this source dataset"
            )
        table = next((t for t in content.tables if t.id == request.table_id), None)
        if table is None:
            raise ValueError("Performance table not found in this dataset")
        expected = set(table.axes) | table.fixed_conditions.keys()
        if request.conditions.keys() != expected:
            raise ValueError(
                "Provide exactly every table axis and fixed condition; no conditions are assumed"
            )
        changed = {
            key for key, value in table.fixed_conditions.items() if request.conditions[key] != value
        }
        if len(changed) > 1 and not table.combination_citations:
            raise ValueError(
                "Combined corrections require explicit reviewed order and original-page evidence"
            )
        steps = []
        for variable in sorted(changed):
            matching = []
            target = request.conditions[variable]
            for rule in table.corrections:
                if rule.variable != variable:
                    continue
                if isinstance(rule, LinearCorrection):
                    if type(target) in (int, float) and rule.minimum <= target <= rule.maximum:
                        factor = (
                            1
                            + (1 if rule.direction == "increase" else -1)
                            * rule.percent
                            / 100
                            * abs(target - rule.reference)
                            / rule.per_units
                        )
                        matching.append((rule, factor))
                elif target == rule.match_value:
                    matching.append(
                        (rule, 1 + (1 if rule.direction == "increase" else -1) * rule.percent / 100)
                    )
            if len(matching) != 1:
                raise ValueError(
                    "A changed fixed condition has no unique cited correction covering it"
                )
            rule, factor = matching[0]
            if not math.isfinite(factor) or factor <= 0:
                raise ValueError("A correction produced a non-positive or non-finite factor")
            steps.append(
                {"rule": rule.model_dump(mode="json"), "requested_value": target, "factor": factor}
            )
        if table.correction_order:
            steps.sort(key=lambda step: table.correction_order.index(step["rule"]["name"]))
        for axis in table.axes:
            if axis not in table.interpolation_axes and request.conditions[axis] not in {
                p.coordinates[axis] for p in table.points
            }:
                raise ValueError(
                    "This axis is not reviewed for interpolation; request an exact source coordinate"
                )
        value, contributions = interpolate(
            [p.model_dump() for p in table.points],
            table.axes,
            {axis: request.conditions[axis] for axis in table.axes},
        )
        base = value
        for step in steps:
            value *= step["factor"]
        if not math.isfinite(value):
            raise ValueError("Corrected result is not finite")
        current = self._stored(identifier)
        final_document = self.library.get(document["id"])
        if (
            current["retired_at"]
            or final_document is None
            or final_document["metadata"] != record["source_metadata"]
        ):
            raise ValueError(
                "Source applicability or dataset availability changed during calculation"
            )
        source = {
            "document_id": document["id"],
            "sha256": document["sha256"],
            "original_url": document["original_url"],
            "revision": content.source_revision,
            "metadata": record["source_metadata"],
        }
        return {
            "dataset_id": identifier,
            "content_sha256": record["content_sha256"],
            "table_id": table.id,
            "metric": table.metric,
            "units": METRIC_UNITS[table.metric],
            "value": value,
            "uncorrected_value": base,
            "conditions": request.conditions,
            "variant": content.variant,
            "configuration": content.configuration,
            "registration": request.registration,
            "source": source,
            "source_table": table.source_table,
            "contributions": contributions,
            "corrections": steps,
            "notes": table.notes,
            "reviewer": record["reviewer"],
            "reviewed_at": record["reviewed_at"],
            "calculated_at": now(),
            "interpolation_axes": table.interpolation_axes,
            "interpolation_citations": [
                c.model_dump(mode="json") for c in table.interpolation_citations
            ],
            "combination_citations": [
                c.model_dump(mode="json") for c in table.combination_citations
            ],
            "method": "Only explicitly reviewed axis interpolation inside the cited grid and declared corrections",
            "warnings": warnings,
            "approved_for_flight": False,
            "limitations": "Operator-reviewed source transcription, not manufacturer or aircraft dispatch approval. Applies only to the supplied source revision, configuration and conditions; no extrapolation or unstated corrections.",
        }
