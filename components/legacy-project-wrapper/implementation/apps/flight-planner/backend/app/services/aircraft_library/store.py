"""Durable originals, acquisitions, page index, jobs and derived artifacts."""

from __future__ import annotations

from contextlib import contextmanager
from datetime import datetime, timezone
import hashlib
import json
import os
from pathlib import Path
import re
import sqlite3
import tempfile
import threading
import uuid

from . import pdf

_UNSET = object()


def now():
    return datetime.now(timezone.utc).isoformat()


def icao(value: str):
    value = value.strip().upper()
    if not re.fullmatch(r"[A-Z0-9]{2,4}", value):
        raise ValueError("ICAO type designator must contain 2 to 4 letters/digits")
    return value


def tail(value: str):
    value = value.strip().upper()
    if not re.fullmatch(r"[A-Z0-9][A-Z0-9-]{0,11}", value):
        raise ValueError("Invalid aircraft registration")
    return value


def metadata(value: dict) -> dict:
    allowed = {
        "icao",
        "title",
        "kind",
        "manufacturer",
        "model",
        "variant",
        "revision",
        "serial_applicability",
        "tails",
        "scope",
        "notes",
    }
    if set(value) - allowed:
        raise ValueError("Unknown aircraft document metadata")
    result = {key: str(value.get(key) or "").strip() for key in allowed - {"tails"}}
    if any(len(v) > 2000 for v in result.values()):
        raise ValueError("Document metadata is too long")
    result["icao"] = icao(result["icao"])
    tails = value.get("tails") or []
    if (
        not isinstance(tails, list)
        or len(tails) > 100
        or any(not isinstance(t, str) for t in tails)
    ):
        raise ValueError("Provide up to 100 aircraft registrations")
    result["tails"] = sorted({tail(t) for t in tails})
    result["scope"] = result["scope"] or ("aircraft" if tails else "type")
    if result["scope"] not in {"type", "aircraft"} or (result["scope"] == "aircraft" and not tails):
        raise ValueError("Aircraft-specific documents require at least one registration")
    result["kind"] = result["kind"].upper() or "OTHER"
    if result["kind"] not in {"POH", "AFM", "PIM", "MAINTENANCE", "SUPPLEMENT", "OTHER"}:
        raise ValueError("Unknown document kind")
    return result


class LeaseLost(RuntimeError):
    """A reclaimed worker must not publish work into its successor's run."""


class Store:
    def __init__(self, root: str | Path):
        self.root = Path(root)
        self.root.mkdir(parents=True, exist_ok=True, mode=0o700)
        self.objects = self.root / "originals"
        self.objects.mkdir(exist_ok=True, mode=0o700)
        self.db = self.root / "library.sqlite3"
        self._scope = threading.local()
        with self.connection() as connection:
            version = connection.execute("PRAGMA user_version").fetchone()[0]
            if version not in {0, 1}:
                raise ValueError(
                    "Unsupported aircraft library schema version; database left unchanged"
                )
            connection.executescript("""
                PRAGMA journal_mode=WAL;
                CREATE TABLE IF NOT EXISTS documents (
                    id TEXT PRIMARY KEY, sha256 TEXT NOT NULL, icao TEXT NOT NULL,
                    metadata TEXT NOT NULL, created_at TEXT NOT NULL,
                    status TEXT NOT NULL, extraction TEXT, error TEXT,
                    UNIQUE(sha256, icao, metadata)
                );
                CREATE INDEX IF NOT EXISTS documents_icao ON documents(icao);
                CREATE TABLE IF NOT EXISTS acquisitions (
                    id INTEGER PRIMARY KEY, document_id TEXT NOT NULL REFERENCES documents(id),
                    filename TEXT, url TEXT, retrieved_at TEXT NOT NULL, provenance TEXT NOT NULL
                );
                CREATE TABLE IF NOT EXISTS metadata_history (
                    id INTEGER PRIMARY KEY, document_id TEXT NOT NULL REFERENCES documents(id),
                    metadata TEXT NOT NULL, recorded_at TEXT NOT NULL
                );
                CREATE TABLE IF NOT EXISTS pages (
                    document_id TEXT NOT NULL REFERENCES documents(id), page INTEGER NOT NULL,
                    label TEXT NOT NULL, text TEXT NOT NULL, method TEXT NOT NULL, error TEXT,
                    PRIMARY KEY(document_id, page)
                );
                CREATE VIRTUAL TABLE IF NOT EXISTS passages USING fts5(
                    document_id UNINDEXED, page UNINDEXED, label UNINDEXED,
                    offset UNINDEXED, text, method UNINDEXED, tokenize='unicode61'
                );
                CREATE TABLE IF NOT EXISTS artifacts (
                    document_id TEXT NOT NULL REFERENCES documents(id), kind TEXT NOT NULL,
                    value TEXT NOT NULL, created_at TEXT NOT NULL,
                    PRIMARY KEY(document_id, kind)
                );
                CREATE TABLE IF NOT EXISTS vectors (
                    passage_id INTEGER NOT NULL, model TEXT NOT NULL, vector TEXT NOT NULL,
                    PRIMARY KEY(passage_id, model)
                );
                CREATE TABLE IF NOT EXISTS jobs (
                    id TEXT PRIMARY KEY, kind TEXT NOT NULL, state TEXT NOT NULL,
                    request TEXT NOT NULL, result TEXT, error TEXT,
                    created_at TEXT NOT NULL, updated_at TEXT NOT NULL, worker TEXT
                );
                CREATE TABLE IF NOT EXISTS job_checkpoints (
                    job_id TEXT PRIMARY KEY REFERENCES jobs(id), value TEXT NOT NULL
                );
                PRAGMA user_version=1;
            """)
            if "worker" not in {r[1] for r in connection.execute("PRAGMA table_info(jobs)")}:
                connection.execute("ALTER TABLE jobs ADD COLUMN worker TEXT")
        os.chmod(self.db, 0o600)

    @contextmanager
    def connection(self):
        connection = sqlite3.connect(self.db, timeout=30)
        connection.row_factory = sqlite3.Row
        connection.execute("PRAGMA foreign_keys=ON")
        try:
            with connection:
                self._check_lease(connection)
                yield connection
                # A write transaction holds SQLite's writer lock through this check.
                # A lease reclaimed during extraction/inference rolls back the write.
                self._check_lease(connection)
        finally:
            connection.close()

    def _check_lease(self, connection):
        lease = getattr(self._scope, "lease", None)
        if lease:
            row = connection.execute(
                "SELECT state,worker FROM jobs WHERE id=?", (lease[0],)
            ).fetchone()
            if row is None or row["state"] != "running" or row["worker"] != lease[1]:
                raise LeaseLost("Library job lease was reclaimed")

    @contextmanager
    def job_scope(self, identifier, owner):
        previous = getattr(self._scope, "lease", None)
        self._scope.lease = (identifier, owner)
        try:
            yield
        finally:
            self._scope.lease = previous

    def checkpoint(self, identifier, value=None, *, connection=None):
        if connection is None:
            with self.connection() as connection:
                return self.checkpoint(identifier, value, connection=connection)
        if value is not None:
            connection.execute(
                "INSERT OR REPLACE INTO job_checkpoints VALUES (?,?)",
                (identifier, json.dumps(value)),
            )
        row = connection.execute(
            "SELECT value FROM job_checkpoints WHERE job_id=?", (identifier,)
        ).fetchone()
        return json.loads(row[0]) if row else {}

    def index_identity(self, identifier, *, connection=None):
        if connection is None:
            with self.connection() as connection:
                return self.index_identity(identifier, connection=connection)
        document = connection.execute(
            "SELECT sha256,metadata,status,extraction FROM documents WHERE id=?", (identifier,)
        ).fetchone()
        passages = connection.execute(
            "SELECT rowid,* FROM passages WHERE document_id=? ORDER BY rowid", (identifier,)
        ).fetchall()
        value = [list(document) if document else None, [list(p) for p in passages]]
        return hashlib.sha256(json.dumps(value, separators=(",", ":")).encode()).hexdigest()

    def ingest(
        self,
        data: bytes,
        values: dict,
        *,
        filename="document.pdf",
        url=None,
        provenance: dict | None = None,
        extract: bool = True,
    ):
        meta = metadata(values)
        if not data.startswith(b"%PDF-") or len(data) > pdf.MAX_PDF_BYTES:
            raise ValueError("Expected a PDF of at most 100 MiB")
        digest = hashlib.sha256(data).hexdigest()
        original = self.objects / (digest + ".pdf")
        if not original.exists():
            with tempfile.NamedTemporaryFile(dir=self.objects, delete=False) as temporary:
                path = Path(temporary.name)
                try:
                    temporary.write(data)
                    temporary.flush()
                    os.fsync(temporary.fileno())
                    os.chmod(path, 0o600)
                    os.replace(path, original)
                finally:
                    path.unlink(missing_ok=True)
        encoded = json.dumps(meta, sort_keys=True)
        with self.connection() as connection:
            existing = connection.execute(
                "SELECT id FROM documents WHERE sha256=? AND icao=? AND metadata=?",
                (digest, meta["icao"], encoded),
            ).fetchone()
            identifier = existing["id"] if existing else "doc_" + uuid.uuid4().hex
            if not existing:
                connection.execute(
                    "INSERT INTO documents VALUES (?,?,?,?,?,'stored',NULL,NULL)",
                    (identifier, digest, meta["icao"], encoded, now()),
                )
            connection.execute(
                "INSERT INTO acquisitions(document_id,filename,url,retrieved_at,provenance) VALUES (?,?,?,?,?)",
                (
                    identifier,
                    Path(filename).name[:255],
                    url,
                    now(),
                    json.dumps(provenance or {"method": "upload", "rights": "not_verified"}),
                ),
            )
        # Store the original first, including when parsing fails.
        if extract and (not existing or self.get(identifier)["status"] in {"stored", "failed"}):
            self.index(identifier)
        return self.get(identifier)

    def get(self, identifier: str):
        with self.connection() as connection:
            row = connection.execute("SELECT * FROM documents WHERE id=?", (identifier,)).fetchone()
            if row is None:
                return None
            value = dict(row)
            value["metadata"] = json.loads(value["metadata"])
            value["extraction"] = json.loads(value["extraction"]) if value["extraction"] else None
            value["sources"] = [
                dict(r)
                for r in connection.execute(
                    "SELECT filename,url,retrieved_at,provenance FROM acquisitions WHERE document_id=? ORDER BY id",
                    (identifier,),
                )
            ]
            for source in value["sources"]:
                source["provenance"] = json.loads(source["provenance"])
            value["artifacts"] = {
                r["kind"]: json.loads(r["value"])
                for r in connection.execute(
                    "SELECT kind,value FROM artifacts WHERE document_id=?", (identifier,)
                )
            }
            value["original_url"] = f"/api/aircraft-library/documents/{identifier}/original"
            return value

    def select(
        self, code: str, *, registration=None, variant=None, revision=None, document_ids=None
    ):
        code = icao(code)
        registration = tail(registration) if registration else None
        with self.connection() as connection:
            rows = connection.execute(
                "SELECT id,metadata FROM documents WHERE icao=? ORDER BY created_at DESC", (code,)
            ).fetchall()
        identifiers = []
        for row in rows:
            m = json.loads(row["metadata"])
            if m["scope"] == "aircraft" and registration not in m["tails"]:
                continue
            if variant is not None and m["variant"] != variant:
                continue
            if revision is not None and m["revision"] != revision:
                continue
            if document_ids is not None and row["id"] not in document_ids:
                continue
            identifiers.append(row["id"])
        return identifiers

    def list(self, code: str, **filters):
        return [self.get(identifier) for identifier in self.select(code, **filters)]

    def original(self, identifier: str):
        doc = self.get(identifier)
        return self.objects / (doc["sha256"] + ".pdf") if doc else None

    def update_metadata(self, identifier: str, values: dict):
        values = metadata(values)
        with self.connection() as connection:
            row = connection.execute(
                "SELECT metadata FROM documents WHERE id=?", (identifier,)
            ).fetchone()
            if row is None:
                raise ValueError("Document not found")
            connection.execute(
                "INSERT INTO metadata_history(document_id,metadata,recorded_at) VALUES (?,?,?)",
                (identifier, row["metadata"], now()),
            )
            connection.execute(
                "UPDATE documents SET icao=?,metadata=? WHERE id=?",
                (values["icao"], json.dumps(values, sort_keys=True), identifier),
            )
            # A previous generated answer must not claim the newly edited applicability.
            connection.execute(
                "DELETE FROM artifacts WHERE document_id=? AND kind='distillation'", (identifier,)
            )
        return self.get(identifier)

    def index(self, identifier: str, *, ocr=True, checkpoint_job=None):
        original = self.original(identifier)
        if original is None:
            raise ValueError("Document not found")
        try:
            result = pdf.extract_file(original, ocr=ocr)
            with self.connection() as connection:
                connection.execute(
                    "DELETE FROM vectors WHERE passage_id IN (SELECT rowid FROM passages WHERE document_id=?)",
                    (identifier,),
                )
                connection.execute("DELETE FROM passages WHERE document_id=?", (identifier,))
                connection.execute("DELETE FROM pages WHERE document_id=?", (identifier,))
                connection.execute("DELETE FROM artifacts WHERE document_id=?", (identifier,))
                connection.executemany(
                    "INSERT INTO pages VALUES (?,?,?,?,?,?)",
                    [
                        (identifier, p["page"], p["label"], p["text"], p["method"], p["error"])
                        for p in result["pages"]
                    ],
                )
                connection.executemany(
                    "INSERT INTO passages VALUES (?,?,?,?,?,?)",
                    [
                        (identifier, p["page"], p["label"], p["offset"], p["text"], p["method"])
                        for p in pdf.chunks(result["pages"])
                    ],
                )
                info = {key: value for key, value in result.items() if key != "pages"}
                connection.execute(
                    "UPDATE documents SET status=?,extraction=?,error=NULL WHERE id=?",
                    (result["status"], json.dumps(info), identifier),
                )
                if checkpoint_job:
                    self.checkpoint(
                        checkpoint_job,
                        {"index_identity": self.index_identity(identifier, connection=connection)},
                        connection=connection,
                    )
            self.distill_index(identifier)
        except pdf.PDFError as error:
            with self.connection() as connection:
                connection.execute(
                    "UPDATE documents SET status='failed',error=? WHERE id=?",
                    (str(error), identifier),
                )
        return self.get(identifier)

    def page(self, identifier: str, number: int):
        with self.connection() as connection:
            row = connection.execute(
                "SELECT * FROM pages WHERE document_id=? AND page=?", (identifier, number)
            ).fetchone()
            return dict(row) if row else None

    def distill_index(self, identifier: str):
        """An honest extractive section index, also available without an LLM."""
        topics = {
            "limitations": ["limitation", "airspeed", "weight limit"],
            "normal_procedures": ["normal procedure", "checklist"],
            "emergency_procedures": ["emergency", "engine failure"],
            "performance": ["performance", "takeoff", "landing distance", "rate of climb"],
            "systems": ["system", "electrical", "fuel system"],
            "maintenance": ["maintenance", "inspection", "servicing", "lubrication"],
            "supplements": ["supplement"],
        }
        with self.connection() as connection:
            pages = connection.execute(
                "SELECT page,label,text,method,error FROM pages WHERE document_id=? ORDER BY page",
                (identifier,),
            ).fetchall()
        sections = {}
        for name, terms in topics.items():
            matches = []
            for p in pages:
                if any(term in p["text"].lower() for term in terms):
                    matches.append(
                        {
                            "page": p["page"],
                            "label": p["label"],
                            "excerpt": p["text"][:1200],
                            "method": p["method"],
                            "incomplete": p["error"] is not None,
                        }
                    )
            sections[name] = {"status": "found" if matches else "not_found", "pages": matches}
        value = {
            "kind": "extractive_section_index",
            "generated_at": now(),
            "sections": sections,
            "note": "Keyword index of extracted pages; not an LLM summary or verified performance dataset.",
        }
        self.artifact(identifier, "section_index", value)
        return value

    def artifact(
        self,
        identifier: str,
        kind: str,
        value: dict,
        *,
        expected_metadata=None,
        expected_index_identity=None,
        expected_previous=_UNSET,
    ):
        with self.connection() as connection:
            connection.execute("BEGIN IMMEDIATE")
            if (
                expected_index_identity is not None
                and self.index_identity(identifier, connection=connection)
                != expected_index_identity
            ):
                raise ValueError("Document extraction changed during generation; retry")
            if expected_previous is not _UNSET:
                previous = connection.execute(
                    "SELECT value FROM artifacts WHERE document_id=? AND kind=?", (identifier, kind)
                ).fetchone()
                if (json.loads(previous[0]) if previous else None) != expected_previous:
                    raise ValueError("Document artifact changed during recovery; retry")
            if expected_metadata is not None:
                row = connection.execute(
                    "SELECT metadata FROM documents WHERE id=?", (identifier,)
                ).fetchone()
                if row is None or json.loads(row["metadata"]) != expected_metadata:
                    raise ValueError(
                        "Document metadata changed during generation; retry with current applicability"
                    )
            connection.execute(
                "INSERT OR REPLACE INTO artifacts VALUES (?,?,?,?)",
                (identifier, kind, json.dumps(value), now()),
            )

    def search(self, code: str, query: str, *, limit=12, **filters):
        identifiers = self.select(code, **filters)
        terms = list(dict.fromkeys(re.findall(r"[\w-]{2,}", query, flags=re.UNICODE)))[:32]
        if not identifiers or not terms:
            return []
        expression = " OR ".join('"' + term.replace('"', '""') + '"' for term in terms)
        placeholders = ",".join("?" for _ in identifiers)
        with self.connection() as connection:
            rows = connection.execute(
                f"SELECT rowid AS passage_id,document_id,page,label,offset,text,method,bm25(passages) AS rank FROM passages WHERE passages MATCH ? AND document_id IN ({placeholders}) ORDER BY rank LIMIT ?",
                (expression, *identifiers, min(max(limit, 1), 50)),
            ).fetchall()
        return [dict(row) for row in rows]

    def passages(self, identifiers: list[str]):
        if not identifiers:
            return []
        placeholders = ",".join("?" for _ in identifiers)
        with self.connection() as connection:
            return [
                dict(r)
                for r in connection.execute(
                    f"SELECT rowid AS passage_id,* FROM passages WHERE document_id IN ({placeholders})",
                    identifiers,
                )
            ]

    def create_job(self, kind: str, request: dict):
        identifier = "job_" + uuid.uuid4().hex
        with self.connection() as connection:
            connection.execute("BEGIN IMMEDIATE")
            existing = None
            if kind in {"index", "embed", "distill"} and set(request) == {"document_id"}:
                existing = connection.execute(
                    "SELECT id FROM jobs WHERE kind=? AND state IN ('queued','running') "
                    "AND json_extract(request,'$.document_id')=? ORDER BY created_at LIMIT 1",
                    (kind, request["document_id"]),
                ).fetchone()
            if existing:
                identifier = existing["id"]
            else:
                connection.execute(
                    "INSERT INTO jobs VALUES (?,?,'queued',?,NULL,NULL,?,?,NULL)",
                    (identifier, kind, json.dumps(request), now(), now()),
                )
        return self.job(identifier)

    @staticmethod
    def _job_subject(connection, request):
        identifier = request.get("document_id")
        if identifier:
            row = connection.execute(
                "SELECT icao,metadata FROM documents WHERE id=?", (identifier,)
            ).fetchone()
            if row:
                meta = json.loads(row["metadata"])
                return {
                    "document_id": identifier,
                    "icao": row["icao"],
                    "title": meta["title"] or meta["model"] or "Untitled manual",
                }
        meta = request.get("metadata")
        if isinstance(meta, dict) and meta.get("icao"):
            return {
                "document_id": None,
                "icao": meta["icao"],
                "title": meta.get("title") or "Public manual acquisition",
            }
        return None

    def jobs(self, limit=20, offset=0):
        if type(limit) is not int or not 1 <= limit <= 100:
            raise ValueError("List between 1 and 100 library jobs")
        if type(offset) is not int or not 0 <= offset <= 1_000_000:
            raise ValueError("Library job offset is out of range")
        with self.connection() as connection:
            connection.execute("BEGIN")
            total = connection.execute("SELECT COUNT(*) FROM jobs").fetchone()[0]
            rows = connection.execute(
                "SELECT id,kind,state,request,error,created_at,updated_at, "
                "CASE WHEN result IS NULL OR json_type(result)='null' THEN 0 ELSE 1 END AS has_result "
                "FROM jobs ORDER BY CASE state WHEN 'running' THEN 0 WHEN 'queued' THEN 1 ELSE 2 END, "
                "CASE WHEN state IN ('queued','running') THEN created_at END, updated_at DESC LIMIT ? OFFSET ?",
                (limit, offset),
            ).fetchall()
            results = []
            for row in rows:
                value = dict(row)
                value["subject"] = self._job_subject(connection, json.loads(value.pop("request")))
                value["has_result"] = bool(value["has_result"])
                results.append(value)
        return {
            "jobs": results,
            "total": total,
            "limit": limit,
            "offset": offset,
            "next_offset": offset + len(results) if offset + len(results) < total else None,
        }

    def claim_job(self, owner: str):
        from datetime import timedelta

        cutoff = (datetime.now(timezone.utc) - timedelta(minutes=5)).isoformat()
        with self.connection() as connection:
            connection.execute("BEGIN IMMEDIATE")
            row = connection.execute(
                "SELECT id FROM jobs WHERE state='queued' OR (state='running' AND updated_at<?) ORDER BY created_at LIMIT 1",
                (cutoff,),
            ).fetchone()
            if row is None:
                return None
            connection.execute(
                "UPDATE jobs SET state='running',worker=?,updated_at=? WHERE id=?",
                (owner, now(), row["id"]),
            )
        return self.job(row["id"])

    def heartbeat(self, identifier: str, owner: str):
        with self.connection() as connection:
            connection.execute(
                "UPDATE jobs SET updated_at=? WHERE id=? AND worker=? AND state='running'",
                (now(), identifier, owner),
            )

    def types(self):
        with self.connection() as connection:
            return [
                dict(row)
                for row in connection.execute(
                    "SELECT icao,COUNT(*) AS documents FROM documents GROUP BY icao ORDER BY icao"
                )
            ]

    def job(self, identifier: str):
        with self.connection() as connection:
            row = connection.execute("SELECT * FROM jobs WHERE id=?", (identifier,)).fetchone()
            if row is None:
                return None
            result = dict(row)
            for key in ("request", "result"):
                result[key] = json.loads(result[key]) if result[key] else None
            result["subject"] = self._job_subject(connection, result["request"])
            result["has_result"] = result["result"] is not None
        return result

    def finish_job(
        self, identifier: str, result: dict | None = None, error: str | None = None, *, owner=None
    ):
        with self.connection() as connection:
            cursor = connection.execute(
                "UPDATE jobs SET state=?,result=?,error=?,updated_at=? WHERE id=?"
                + (" AND worker=? AND state='running'" if owner is not None else ""),
                ("failed" if error else "completed", json.dumps(result), error, now(), identifier)
                + ((owner,) if owner is not None else ()),
            )
            return cursor.rowcount == 1
