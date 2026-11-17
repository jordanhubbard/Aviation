"""Private durable filing state. Provider I/O never runs in a writer transaction."""

from contextlib import contextmanager
from datetime import datetime, timezone
import fcntl
import json
import os
import re
from pathlib import Path
import sqlite3
import uuid


class Conflict(RuntimeError):
    pass


class Missing(LookupError):
    pass


class Invalid(RuntimeError):
    pass


def encoded(value):
    return json.dumps(value, sort_keys=True, separators=(",", ":"), allow_nan=False)


def now_iso():
    return datetime.now(timezone.utc).isoformat()


def identifier(prefix):
    return prefix + "_" + uuid.uuid4().hex


class Store:
    def __init__(self, root):
        root = Path(root)
        if root.is_symlink():
            raise Invalid("Flight Service storage cannot be a symbolic link")
        root.mkdir(mode=0o700, parents=True, exist_ok=True)
        os.chmod(root, 0o700)
        self.path = root / "filing.sqlite3"
        if self.path.is_symlink():
            raise Invalid("Flight Service database cannot be a symbolic link")
        fd = os.open(self.path, os.O_CREAT | os.O_RDWR | os.O_NOFOLLOW, 0o600)
        os.close(fd)
        os.chmod(self.path, 0o600)
        with self.transaction() as db:
            version = db.execute("PRAGMA user_version").fetchone()[0]
            if version not in {0, 1}:
                raise Invalid("Unsupported Flight Service database version")
            if version == 0:
                # Do not silently adopt a nonempty unversioned database.
                if db.execute("SELECT name FROM sqlite_master WHERE type='table'").fetchone():
                    raise Invalid("Unversioned Flight Service database is not empty")
                statements = [
                    "CREATE TABLE drafts (id TEXT PRIMARY KEY, revision INTEGER NOT NULL, account TEXT NOT NULL, plan TEXT NOT NULL, deleted INTEGER NOT NULL DEFAULT 0, created TEXT NOT NULL, updated TEXT NOT NULL)",
                    "CREATE TABLE filings (id TEXT PRIMARY KEY, draft_id TEXT NOT NULL UNIQUE REFERENCES drafts(id), account TEXT NOT NULL, provider_id TEXT NOT NULL, environment TEXT NOT NULL, revision INTEGER NOT NULL, submitted TEXT NOT NULL, snapshot TEXT, source TEXT, updated TEXT NOT NULL, UNIQUE(environment,provider_id))",
                    "CREATE TABLE confirmations (token_hash TEXT PRIMARY KEY, payload TEXT NOT NULL, expires REAL NOT NULL, consumed INTEGER NOT NULL DEFAULT 0)",
                    "CREATE TABLE operations (id TEXT PRIMARY KEY, idempotency_key TEXT NOT NULL UNIQUE, identity TEXT NOT NULL, draft_id TEXT NOT NULL REFERENCES drafts(id), filing_id TEXT REFERENCES filings(id), account TEXT NOT NULL, action TEXT NOT NULL, environment TEXT NOT NULL, status TEXT NOT NULL, request TEXT NOT NULL, response TEXT, source TEXT, created TEXT NOT NULL, updated TEXT NOT NULL, reconcile_after REAL NOT NULL)",
                    "CREATE INDEX operation_targets ON operations(draft_id,filing_id,status)",
                    "CREATE TABLE audit (sequence INTEGER PRIMARY KEY, scope TEXT NOT NULL, event TEXT NOT NULL, details TEXT NOT NULL, recorded_at TEXT NOT NULL)",
                ]
                for statement in statements:
                    db.execute(statement)
                db.execute("PRAGMA user_version=1")

    @contextmanager
    def transaction(self):
        db = sqlite3.connect(self.path, timeout=10, isolation_level=None)
        db.row_factory = sqlite3.Row
        try:
            db.execute("PRAGMA foreign_keys=ON")
            db.execute("PRAGMA synchronous=FULL")
            db.execute("BEGIN IMMEDIATE")
            yield db
            db.commit()
        except BaseException:
            db.rollback()
            raise
        finally:
            db.close()

    @staticmethod
    def audit(db, scope, event, details):
        db.execute(
            "INSERT INTO audit(scope,event,details,recorded_at) VALUES(?,?,?,?)",
            (scope, event, encoded(details), now_iso()),
        )

    @staticmethod
    def row(db, table, key):
        if table not in {"drafts", "filings", "operations"}:
            raise ValueError("Unknown filing collection")
        row = db.execute(f"SELECT * FROM {table} WHERE id=?", (key,)).fetchone()
        if row is None or table == "drafts" and row["deleted"]:
            raise Missing("Flight Service record not found")
        result = dict(row)
        for field in {
            "plan",
            "submitted",
            "snapshot",
            "source",
            "request",
            "response",
        } & result.keys():
            if result[field] is not None:
                result[field] = json.loads(result[field])
        return result

    def get(self, table, key):
        with self.transaction() as db:
            return self.row(db, table, key)

    def draft(self, account, plan, *, key=None, revision=None):
        if not isinstance(account, str) or not account.strip() or len(account) > 254:
            raise Invalid("A pilot Flight Service account is required")
        account = account.strip()
        moment = now_iso()
        with self.transaction() as db:
            if key is None:
                key = identifier("draft")
                db.execute(
                    "INSERT INTO drafts(id,revision,account,plan,created,updated) VALUES(?,1,?,?,?,?)",
                    (key, account, encoded(plan), moment, moment),
                )
                revision = 1
            else:
                current = self.row(db, "drafts", key)
                if type(revision) is not int or current["revision"] != revision:
                    raise Conflict("Draft changed; reload before saving")
                if current["account"] != account:
                    raise Conflict("A draft's pilot account cannot change; create a separate draft")
                revision += 1
                db.execute(
                    "UPDATE drafts SET revision=?,plan=?,updated=? WHERE id=?",
                    (revision, encoded(plan), moment, key),
                )
            self.audit(db, key, "draft_saved", {"revision": revision})
            return self.row(db, "drafts", key)

    def delete_draft(self, key, revision):
        with self.transaction() as db:
            current = self.row(db, "drafts", key)
            if type(revision) is not int or current["revision"] != revision:
                raise Conflict("Draft changed; reload before deleting")
            if (
                db.execute("SELECT 1 FROM filings WHERE draft_id=?", (key,)).fetchone()
                or db.execute(
                    "SELECT 1 FROM operations WHERE draft_id=? AND status='unknown'", (key,)
                ).fetchone()
            ):
                raise Conflict("A filed or uncertain draft must retain its lifecycle records")
            db.execute(
                "UPDATE drafts SET deleted=1,revision=revision+1,updated=? WHERE id=?",
                (now_iso(), key),
            )
            self.audit(db, key, "draft_deleted", {"revision": revision})

    def listing(self, table, *, limit=50, offset=0):
        if (
            table not in {"drafts", "filings", "operations"}
            or type(limit) is not int
            or not 1 <= limit <= 100
            or type(offset) is not int
            or offset < 0
        ):
            raise Invalid("Invalid collection or pagination")
        with self.transaction() as db:
            where = " WHERE deleted=0" if table == "drafts" else ""
            ids = db.execute(
                f"SELECT id FROM {table}{where} ORDER BY updated DESC,id LIMIT ? OFFSET ?",
                (limit, offset),
            ).fetchall()
            return [self.row(db, table, row[0]) for row in ids]

    def history(self, scope, *, after=0, limit=100):
        if type(after) is not int or after < 0 or type(limit) is not int or not 1 <= limit <= 100:
            raise Invalid("Invalid audit pagination")
        with self.transaction() as db:
            return [
                {**dict(row), "details": json.loads(row["details"])}
                for row in db.execute(
                    "SELECT * FROM audit WHERE scope=? AND sequence>? ORDER BY sequence LIMIT ?",
                    (scope, after, limit),
                )
            ]

    def backup(self, destination):
        destination = Path(destination)
        fd = os.open(destination, os.O_CREAT | os.O_EXCL | os.O_RDWR, 0o600)
        os.close(fd)
        with sqlite3.connect(self.path) as source, sqlite3.connect(destination) as target:
            source.backup(target)

    @contextmanager
    def operation_guard(self, operation_id):
        """Fence reconciliation against a live transmission, including stalled DNS.

        The kernel releases this ownership on process loss. An elapsed timeout
        alone cannot establish that a request-owning process stopped sending.
        """
        if not isinstance(operation_id, str) or not re.fullmatch(
            r"operation_[a-f0-9]{32}", operation_id
        ):
            raise Invalid("Invalid operation identifier")
        directory = self.path.parent / "operation-locks"
        if directory.is_symlink():
            raise Invalid("Operation lock directory cannot be a symbolic link")
        directory.mkdir(mode=0o700, exist_ok=True)
        descriptor = os.open(
            directory / (operation_id + ".lock"), os.O_CREAT | os.O_RDWR | os.O_NOFOLLOW, 0o600
        )
        try:
            try:
                fcntl.flock(descriptor, fcntl.LOCK_EX | fcntl.LOCK_NB)
            except BlockingIOError:
                raise Conflict(
                    "A live process still owns this provider transmission; wait for it to finish or stop its owner before reconciliation"
                ) from None
            try:
                yield
            finally:
                fcntl.flock(descriptor, fcntl.LOCK_UN)
        finally:
            os.close(descriptor)
