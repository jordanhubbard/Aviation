"""Durable, shared NMS feed reservations and atomic snapshots; no startup threads."""

from contextlib import contextmanager
from datetime import datetime, timezone
import hashlib
import json
import os
from pathlib import Path
import sqlite3
import time
import tempfile
import uuid

from .nms_client import NMSUnavailable, ORIGINS

CLASSES = ("DOMESTIC", "FDC", "INTERNATIONAL", "MILITARY", "LOCAL_MILITARY")
DAY = 86400
LEASE = 1800


def instant(value):
    if not isinstance(value, str) or len(value) > 64:
        raise ValueError("Invalid NOTAM UTC timestamp")
    try:
        parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
        if parsed.utcoffset() is None:
            raise ValueError()
        return parsed.timestamp()
    except ValueError:
        raise ValueError("Invalid NOTAM UTC timestamp") from None


def utc(value):
    return datetime.fromtimestamp(value, timezone.utc).isoformat().replace("+00:00", "Z")


def normalize(feature):
    """Keep raw source fields; do not infer schedule, geographic or vertical coverage."""
    try:
        if feature.get("type") != "Feature":
            raise ValueError()
        n = feature["properties"]["coreNOTAMData"]["notam"]
        if not isinstance(n, dict):
            raise ValueError()
        for name in ["id", "location", "classification"]:
            if not isinstance(n.get(name), str) or not n[name].strip():
                raise ValueError()
        if len(n["id"]) > 128 or (
            n.get("text") is not None
            and (not isinstance(n["text"], str) or len(n["text"]) > 1024 * 1024)
        ):
            raise ValueError()
        if (n.get("type") is not None and not isinstance(n["type"], str)) or (
            n.get("icaoLocation") is not None and not isinstance(n["icaoLocation"], str)
        ):
            raise ValueError()
        if (
            n.get("cancelationDate")
            and n.get("cancellationDate")
            and n["cancelationDate"] != n["cancellationDate"]
        ):
            raise ValueError()
        start = None if n.get("effectiveStart") in (None, "") else instant(n["effectiveStart"])
        modified = instant(n["lastUpdated"])
        end_raw = n.get("effectiveEnd")
        permanent = isinstance(end_raw, str) and end_raw.upper() == "PERM"
        end = None if permanent or end_raw in (None, "") else instant(end_raw)
        cancelled = n.get("cancelationDate", n.get("cancellationDate"))
        cancel = None if cancelled in (None, "") else instant(cancelled)
        if end is not None and start is not None and end < start:
            raise ValueError()
        return {
            "id": n["id"],
            "location": n["location"].strip().upper(),
            "icao_location": str(n.get("icaoLocation") or "").strip().upper(),
            "text": n.get("text") or None,
            "missing_fields": (["text"] if not n.get("text") else [])
            + (["effective_start"] if start is None else [])
            + (["type"] if n.get("type") not in {"N", "R", "C"} else [])
            + (["effective_end"] if end is None and not permanent else []),
            "classification": n["classification"],
            "type": n.get("type"),
            "effective_start": start,
            "effective_end": end,
            "permanent": permanent,
            "cancelled_at": cancel,
            "last_updated": modified,
            "estimated": str(n.get("estimated", "")).lower() == "true",
            "schedule": n.get("schedule"),
            "feature": feature,
        }
    except (ValueError, TypeError, KeyError, AttributeError):
        raise NMSUnavailable("NMS collection contains an invalid NOTAM record") from None


def activity(record, now):
    if record["type"] == "C" or (
        record["cancelled_at"] is not None and record["cancelled_at"] <= now
    ):
        return "cancelled"
    if record["effective_end"] is not None and record["effective_end"] <= now:
        return "expired"
    if record["effective_start"] is not None and record["effective_start"] > now:
        return "scheduled"
    if record["effective_start"] is None or not record["text"]:
        return "source_incomplete"
    if record["effective_end"] is None and not record["permanent"]:
        return "unknown_end"
    if record["type"] not in {"N", "R"}:
        return "unknown_type"
    if record["schedule"]:
        return "schedule_requires_review"
    return "effective"


class NMSCache:
    def __init__(self, root, environment, *, clock=time.time, read_only=False):
        if environment not in ORIGINS:
            raise ValueError("Select an explicit NMS environment")
        self.root = Path(root)
        self.path = self.root / "notams.sqlite3"
        self.environment, self.clock, self.read_only = environment, clock, read_only
        if read_only:
            with self.connection() as db:
                if db.execute("PRAGMA user_version").fetchone()[0] != 1:
                    raise ValueError("Unsupported NMS cache schema")
                row = db.execute("SELECT value FROM state WHERE id=1").fetchone()
                state = json.loads(row[0]) if row else None
                if not isinstance(state, dict) or state.get("environment") != environment:
                    raise ValueError("NMS cache metadata or environment is invalid")
            return
        self.root.mkdir(parents=True, exist_ok=True, mode=0o700)
        with self.connection() as db:
            version = db.execute("PRAGMA user_version").fetchone()[0]
            if version not in (0, 1):
                raise ValueError("Unsupported NMS cache schema")
            db.execute(
                "CREATE TABLE IF NOT EXISTS state (id INTEGER PRIMARY KEY CHECK(id=1), value TEXT NOT NULL)"
            )
            for table in ("current", "building"):
                db.execute(
                    f"CREATE TABLE IF NOT EXISTS {table} (id TEXT PRIMARY KEY, modified REAL NOT NULL, value TEXT NOT NULL)"
                )
            db.execute(
                "CREATE TABLE IF NOT EXISTS originals (cycle REAL, classification TEXT, sha256 TEXT, retrieved REAL, PRIMARY KEY(cycle,classification,sha256))"
            )
            db.execute(
                "CREATE INDEX IF NOT EXISTS current_location ON current(json_extract(value,'$.location'))"
            )
            db.execute(
                "CREATE INDEX IF NOT EXISTS current_icao_location ON current(json_extract(value,'$.icao_location'))"
            )
            db.execute("PRAGMA user_version=1")
            row = db.execute("SELECT value FROM state WHERE id=1").fetchone()
            if not row:
                state = dict(
                    environment=environment,
                    full_started=None,
                    attempted=[],
                    completed=[],
                    published=None,
                    watermark=None,
                    next_request=0,
                    next_delta=0,
                    owner=None,
                    lease_until=0,
                    last_error=None,
                    last_attempt=None,
                )
                self._save(db, state)
            elif json.loads(row[0])["environment"] != environment:
                raise ValueError("An NMS cache cannot mix provider environments")
        self.path.chmod(0o600)

    @contextmanager
    def connection(self):
        db = (
            sqlite3.connect(self.path.resolve().as_uri() + "?mode=ro", uri=True, timeout=10)
            if self.read_only
            else sqlite3.connect(self.path, timeout=10)
        )
        try:
            db.execute("BEGIN" if self.read_only else "BEGIN IMMEDIATE")
            yield db
            db.commit()
        except BaseException:
            db.rollback()
            raise
        finally:
            db.close()

    def _state(self, db):
        return json.loads(db.execute("SELECT value FROM state WHERE id=1").fetchone()[0])

    def _save(self, db, state):
        db.execute("INSERT OR REPLACE INTO state VALUES (1,?)", (json.dumps(state),))

    def bootstrap_initial(self, features, raw, retrieved_at, *, coverage_since):
        """Reserve and stage a retained all-class response; publication needs catch-up."""
        now = self.clock()
        digest = hashlib.sha256(raw).hexdigest()
        if type(retrieved_at) not in (int, float) or not 0 <= now - retrieved_at < DAY - 1800:
            raise NMSUnavailable("Retained initial-load retrieval time is not recent")
        if not 0 <= now - coverage_since < DAY - 300 or coverage_since > retrieved_at:
            raise NMSUnavailable("Initial-load generation time is outside catch-up coverage")
        with self.connection() as db:
            s = self._state(db)
            if now < s["lease_until"]:
                raise NMSUnavailable("NMS synchronization is already active")
            replay = s["full_started"] == retrieved_at and not s["completed"] and s["last_error"]
            if s["full_started"] is not None and not replay and now - s["full_started"] < DAY:
                raise NMSUnavailable("An NMS full-load reservation already exists")
            if replay and not db.execute("SELECT 1 FROM originals WHERE cycle=? AND classification='AIXM_ALL' AND sha256=?", (retrieved_at, digest)).fetchone():
                raise NMSUnavailable("No matching retained initial-load receipt")
            ticket = dict(owner=uuid.uuid4().hex, kind="full", classification="AIXM_ALL", started=retrieved_at, full_started=retrieved_at)
            s.update(full_started=retrieved_at, attempted=list(CLASSES), completed=[], owner=ticket["owner"], lease_until=now + LEASE, last_attempt=now, bootstrap_since=coverage_since)
            self._save(db, s)
        try:
            self.archive_for(ticket, raw)
            with self.connection() as db:
                s = self._state(db)
                if s["owner"] != ticket["owner"] or self.clock() >= s["lease_until"]:
                    raise NMSUnavailable("Initial-load ownership expired")
                db.execute("DELETE FROM building")
                count = 0
                for feature in features:
                    row = normalize(feature)
                    encoded = json.dumps(row, allow_nan=False)
                    if db.execute("SELECT 1 FROM building WHERE id=?", (row["id"],)).fetchone():
                        raise NMSUnavailable("Duplicate initial-load identity")
                    db.execute("INSERT INTO building VALUES (?,?,?)", (row["id"], row["last_updated"], encoded))
                    count += 1
                if not count:
                    raise NMSUnavailable("Initial-load coverage is missing")
                s.update(completed=list(CLASSES), owner=None, lease_until=0, last_error=None)
                self._save(db, s)
        except BaseException:
            with self.connection() as db:
                s = self._state(db)
                if s["owner"] == ticket["owner"]:
                    s.update(owner=None, lease_until=0, last_error="Retained initial-load staging failed")
                    self._save(db, s)
            raise

    def reserve(self):
        """Persist a lease/cadence reservation BEFORE performing any network request."""
        now = self.clock()
        with self.connection() as db:
            s = self._state(db)
            if now < max(s["next_request"], s["lease_until"]):
                return None
            if s["full_started"] is None or now - s["full_started"] >= DAY:
                s.update(full_started=now, attempted=[], completed=[])
                db.execute("DELETE FROM building")
            missing = [c for c in CLASSES if c not in s["attempted"]]
            if missing:
                kind, classification = "full", missing[0]
                s["attempted"].append(classification)
                since = None
            elif set(s["completed"]) == set(CLASSES) and s["published"] != s["full_started"] and now >= s["next_delta"]:
                kind, classification, since = "catchup", None, s.get("bootstrap_since", s["full_started"] - 60)
            elif (
                s["watermark"] is not None
                and now >= s["next_delta"]
                and now - s["watermark"] + 60 < DAY
            ):
                kind, classification, since = "delta", None, s["watermark"] - 60
            else:
                return None
            # Never query outside the provider's 24-hour delta lookback.
            if since is not None and now - since >= DAY:
                return None
            ticket = dict(
                owner=uuid.uuid4().hex,
                kind=kind,
                classification=classification,
                since=since,
                started=now,
                full_started=s["full_started"],
            )
            s.update(
                owner=ticket["owner"],
                lease_until=now + LEASE,
                last_attempt=now,
                next_request=now + (180 if self.environment == "production" else 1.05),
            )
            if kind != "full":
                s["next_delta"] = now + 180
            self._save(db, s)
            return ticket

    def archive(self, raw):
        """Retain original bulk bytes, independently of parse/admission success."""
        digest = hashlib.sha256(raw).hexdigest()
        directory = self.root / "originals"
        directory.mkdir(mode=0o700, exist_ok=True)
        path = directory / (digest + ".bin")
        if path.exists():
            if hashlib.sha256(path.read_bytes()).hexdigest() != digest:
                raise NMSUnavailable("Retained NMS original failed its integrity check")
            return digest
        fd, temporary = tempfile.mkstemp(prefix="nms-", dir=directory)
        try:
            with os.fdopen(fd, "wb") as f:
                f.write(raw)
                f.flush()
                os.fsync(f.fileno())
            os.replace(temporary, path)
        finally:
            if os.path.exists(temporary):
                os.unlink(temporary)
        return digest

    def archive_for(self, ticket, raw):
        digest = self.archive(raw)
        with self.connection() as db:
            state = self._state(db)
            if state["owner"] != ticket["owner"] or self.clock() >= state["lease_until"]:
                raise NMSUnavailable("NMS synchronization lease is no longer current")
            db.execute(
                "INSERT OR IGNORE INTO originals VALUES (?,?,?,?)",
                (ticket["full_started"], ticket["classification"], digest, ticket["started"]),
            )
        return digest

    def replay_full(self, classification, digest):
        """Admit a previously fetched original after a parser repair, with no FAA pull."""
        from .nms_client import decode_features

        if (
            classification not in CLASSES
            or len(digest) != 64
            or any(c not in "0123456789abcdef" for c in digest)
        ):
            raise ValueError("Invalid retained NMS original identity")
        with self.connection() as db:
            s = self._state(db)
            if s["lease_until"] > self.clock():
                raise NMSUnavailable("NMS synchronization is already active")
            receipt = db.execute(
                "SELECT retrieved FROM originals WHERE cycle=? AND classification=? AND sha256=?",
                (s["full_started"], classification, digest),
            ).fetchone()
            if (
                not receipt
                or classification in s["completed"]
                or classification not in s["attempted"]
            ):
                raise NMSUnavailable("No failed full-load receipt matches this retained original")
            ticket = dict(
                owner=uuid.uuid4().hex,
                kind="full",
                classification=classification,
                since=None,
                started=receipt[0],
                full_started=s["full_started"],
            )
            s.update(owner=ticket["owner"], lease_until=self.clock() + LEASE)
            self._save(db, s)
        try:
            raw = (self.root / "originals" / (digest + ".bin")).read_bytes()
            if hashlib.sha256(raw).hexdigest() != digest:
                raise NMSUnavailable("Retained NMS original failed its integrity check")
            self.finish(ticket, decode_features(raw))
        except Exception as error:
            self.finish(ticket, error=error)
            raise NMSUnavailable("Retained NMS original was not admitted") from None

    def finish(self, ticket, features=None, *, error=None):
        rows = [] if error else [normalize(f) for f in features]
        # Reject inconsistent duplicate versions rather than silently choosing one.
        versions = {}
        for row in rows:
            key = row["id"], row["last_updated"]
            encoded = json.dumps(row, sort_keys=True, allow_nan=False)
            if key in versions and versions[key] != encoded:
                raise NMSUnavailable("NMS collection contains conflicting record versions")
            versions[key] = encoded
        now = self.clock()
        with self.connection() as db:
            s = self._state(db)
            if s["owner"] != ticket["owner"] or now >= s["lease_until"]:
                raise NMSUnavailable("NMS synchronization lease is no longer current")
            s.update(owner=None, lease_until=0)
            s["next_request"] = max(s["next_request"], now + 1.05)
            if error:
                status = getattr(error, "status", None)
                s["last_error"] = (
                    f"NMS provider unavailable (HTTP {status})"
                    if type(status) is int and 100 <= status <= 599
                    else "NMS synchronization failed"
                )
                retry = getattr(error, "retry_after", None)
                if retry is not None:
                    s["next_request"] = max(s["next_request"], now + retry)
            else:
                table = "current" if ticket["kind"] == "delta" else "building"
                for row in rows:
                    encoded = json.dumps(row, sort_keys=True, allow_nan=False)
                    existing = db.execute(
                        f"SELECT modified,value FROM {table} WHERE id=?", (row["id"],)
                    ).fetchone()
                    if (
                        existing
                        and existing[0] == row["last_updated"]
                        and json.dumps(
                            json.loads(existing[1])["feature"], sort_keys=True, allow_nan=False
                        )
                        != json.dumps(row["feature"], sort_keys=True, allow_nan=False)
                    ):
                        old = json.loads(existing[1])
                        def comparable(value):
                            result = {k: v for k, v in value.items() if k != "feature"}
                            if isinstance(result.get("text"), str):
                                result["text"] = result["text"].strip(" \t\r\n")
                            return result
                        upgrade = old["feature"].get("source_format") == "AIXM" and row["feature"].get("source_format") is None
                        if not upgrade or comparable(old) != comparable(row):
                            raise NMSUnavailable(
                                "NMS cache conflicts with an overlapping record version"
                            )
                    if not existing or existing[0] <= row["last_updated"]:
                        db.execute(
                            f"INSERT OR REPLACE INTO {table} VALUES (?,?,?)",
                            (row["id"], row["last_updated"], encoded),
                        )
                if ticket["kind"] == "full":
                    s["completed"].append(ticket["classification"])
                else:
                    if ticket["kind"] == "catchup":
                        db.execute("DELETE FROM current")
                        db.execute("INSERT INTO current SELECT * FROM building")
                        s["published"] = s["full_started"]
                        s.pop("bootstrap_since", None)
                    s["watermark"] = ticket["started"]
                s["last_error"] = None
            self._save(db, s)

    def sync_once(self, client):
        if client.environment != self.environment:
            raise ValueError("NMS client and cache environments differ")
        ticket = self.reserve()
        if ticket is None:
            return False
        try:
            params = (
                {"classification": ticket["classification"]}
                if ticket["kind"] == "full"
                else {"lastUpdatedDate": utc(ticket["since"])}
            )
            features = client.features(params, archive=lambda raw: self.archive_for(ticket, raw))
            self.finish(ticket, features)
        except Exception as error:
            self.finish(ticket, error=error)
            raise NMSUnavailable(
                "NMS synchronization failed; cached coverage has not advanced"
            ) from None
        return True

    def synchronization_status(self):
        """Small metadata read for the worker; never scan the NOTAM collection."""
        now = self.clock()
        with self.connection() as db:
            s = self._state(db)
        full_due = now if s["full_started"] is None else s["full_started"] + DAY
        can_build = any(c not in s["attempted"] for c in CLASSES) or (
            set(s["completed"]) == set(CLASSES) and s["published"] != s["full_started"]
        )
        if can_build:
            due = now
        elif s["watermark"] is not None and now - s["watermark"] + 60 < DAY:
            due = min(full_due, s["next_delta"])
        else:
            due = full_due
        due = max(due, s["next_request"], s["lease_until"])
        fresh = (
            s["watermark"] is not None and 0 <= now - s["watermark"] <= 240 and not s["last_error"]
        )
        return dict(
            status=(
                ("synchronized" if fresh else "stale")
                if s["published"] is not None
                else "initializing"
            ),
            complete_snapshot=s["published"] is not None,
            synchronized_at=utc(s["watermark"]) if s["watermark"] is not None else None,
            retry_in_seconds=max(0, due - now),
        )

    def query(self, locations=(), *, include_inactive=False, offset=0, limit=100):
        if not 0 <= offset <= 250000 or not 1 <= limit <= 200:
            raise ValueError("Invalid NOTAM page bounds")
        if len(locations) > 100 or any(
            not isinstance(v, str) or not 2 <= len(v) <= 8 or not v.isalnum() for v in locations
        ):
            raise ValueError("Provide bounded airport/location identifiers")
        want, now = {v.upper() for v in locations}, self.clock()
        requested = sorted(want)
        with self.connection() as db:
            s = self._state(db)
            if want:
                placeholders = ",".join("?" for _ in want)
                pairs = db.execute(
                    f"SELECT DISTINCT json_extract(value,'$.location'), json_extract(value,'$.icao_location') FROM current WHERE json_extract(value,'$.location') IN ({placeholders}) OR json_extract(value,'$.icao_location') IN ({placeholders})",
                    [*sorted(want), *sorted(want)],
                ).fetchall()
                for pair in pairs:
                    want.update(v for v in pair if v)
                if len(want) > 400:
                    raise NMSUnavailable("NMS source location aliases are too ambiguous")
            clauses, parameters = [], []
            if want:
                placeholders = ",".join("?" for _ in want)
                clauses.append(
                    f"(json_extract(value,'$.location') IN ({placeholders}) OR json_extract(value,'$.icao_location') IN ({placeholders}))"
                )
                parameters.extend([*sorted(want), *sorted(want)])
            if not include_inactive:
                clauses.extend(
                    [
                        "(json_extract(value,'$.type') IS NULL OR json_extract(value,'$.type') != 'C')",
                        "(json_extract(value,'$.cancelled_at') IS NULL OR json_extract(value,'$.cancelled_at') > ?)",
                        "(json_extract(value,'$.effective_end') IS NULL OR json_extract(value,'$.effective_end') > ?)",
                    ]
                )
                parameters.extend([now, now])
            where = " WHERE " + " AND ".join(clauses) if clauses else ""
            total, incomplete = db.execute(
                "SELECT COUNT(*), COALESCE(SUM(CASE WHEN json_extract(value,'$.type') IS NULL OR json_extract(value,'$.type') NOT IN ('N','R','C') OR json_extract(value,'$.effective_start') IS NULL OR json_extract(value,'$.text') IS NULL OR (json_extract(value,'$.effective_end') IS NULL AND json_extract(value,'$.permanent')=0) THEN 1 ELSE 0 END),0) FROM current"
                + where,
                parameters,
            ).fetchone()
            values = db.execute(
                "SELECT value FROM current" + where + " ORDER BY id LIMIT ? OFFSET ?",
                [*parameters, limit, offset],
            ).fetchall()
        found = []
        for (value,) in values:
            row = normalize(json.loads(value)["feature"])
            row["activity"] = activity(row, now)
            found.append(row)
        fresh = (
            s["watermark"] is not None and 0 <= now - s["watermark"] <= 240 and not s["last_error"]
        )
        return dict(
            status=(
                (("partial" if incomplete else "available") if fresh else "stale")
                if s["published"] is not None
                else "unavailable"
            ),
            snapshot_id=self._snapshot(s),
            requested_locations=requested,
            matched_locations=sorted(want),
            incomplete_records=incomplete,
            environment=self.environment,
            production_data=self.environment == "production",
            complete_snapshot=s["published"] is not None,
            synchronized_at=utc(s["watermark"]) if s["watermark"] is not None else None,
            full_load_at=utc(s["published"]) if s["published"] is not None else None,
            next_request_at=utc(max(s["next_request"], s["lease_until"])),
            building_classes=s["completed"],
            last_error=s["last_error"],
            source="FAA NMS",
            limitations=[
                "NMS is not authoritative for all non-US NOTAMs.",
                "Schedules and vertical/geographic applicability require original-source review.",
            ]
            + (
                []
                if self.environment == "production"
                else ["Non-production feed: may include test NOTAMs."]
            ),
            total=total,
            offset=offset,
            limit=limit,
            notams=found,
        )

    def _snapshot(self, state):
        if state["published"] is None:
            return None
        return hashlib.sha256(
            json.dumps([self.environment, state["published"], state["watermark"]]).encode()
        ).hexdigest()

    def detail(self, identifier):
        if not isinstance(identifier, str) or not 1 <= len(identifier) <= 128:
            raise ValueError("Invalid NMS notice identity")
        with self.connection() as db:
            state = self._state(db)
            value = db.execute("SELECT value FROM current WHERE id=?", (identifier,)).fetchone()
        if not value:
            return None
        row = normalize(json.loads(value[0])["feature"])
        row["activity"] = activity(row, self.clock())
        row["snapshot_id"] = self._snapshot(state)
        return row
