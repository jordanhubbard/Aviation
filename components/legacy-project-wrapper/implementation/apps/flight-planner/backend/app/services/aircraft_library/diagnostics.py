"""Explicit private validation diagnostics, independent of admitted library artifacts."""

from datetime import datetime, timezone
import hashlib
import json
import math
import os
from pathlib import Path
import sqlite3
import stat

MAX_RECORDS = 64
MAX_BYTES = 512 * 1024


def digest(value):
    return hashlib.sha256(
        json.dumps(value, sort_keys=True, separators=(",", ":"), allow_nan=False).encode()
    ).hexdigest()


def candidate(value):
    """Select only answer fields; never retain arbitrary provider properties."""
    if not isinstance(value, dict):
        return {"invalid_type": type(value).__name__}
    result = {
        key: scalar(value[key]) for key in ("insufficient_evidence", "reason") if key in value
    }
    claims = value.get("claims")
    if not isinstance(claims, list):
        result["invalid_claims_type"] = type(claims).__name__
        return result
    result["claim_count"] = len(claims)
    selected = []
    for claim in claims[:100]:
        if not isinstance(claim, dict):
            selected.append({"invalid_type": type(claim).__name__})
            continue
        row = (
            {"text": claim.get("text")}
            if isinstance(claim.get("text"), str)
            else {"invalid_text_type": type(claim.get("text")).__name__}
        )
        citations = claim.get("citations")
        if isinstance(citations, list):
            row["citation_count"] = len(citations)
            row["citations"] = [
                (
                    {k: scalar(c[k]) for k in ("passage_id", "excerpt_id", "quote") if k in c}
                    if isinstance(c, dict)
                    else {"invalid_type": type(c).__name__}
                )
                for c in citations[:100]
            ]
        else:
            row["invalid_citations_type"] = type(citations).__name__
        selected.append(row)
    result["claims"] = selected
    result["selection_complete"] = len(claims) <= 100 and all(
        not isinstance(c, dict)
        or not isinstance(c.get("citations"), list)
        or len(c["citations"]) <= 100
        for c in claims[:100]
    )
    return result


def scalar(value):
    if type(value) in {str, int, bool, type(None)}:
        return value
    if type(value) is float and math.isfinite(value):
        return value
    return {"invalid_type": type(value).__name__}


def redact(value, secrets):
    if isinstance(value, str):
        for secret in secrets:
            if secret:
                value = value.replace(secret, "[redacted]")
        return value
    if isinstance(value, list):
        return [redact(v, secrets) for v in value]
    if isinstance(value, dict):
        return {redact(k, secrets): redact(v, secrets) for k, v in value.items()}
    return value


class ValidationTrace:
    def __init__(self, root):
        self.root = Path(root)
        if not self.root.is_absolute():
            raise ValueError("Validation trace directory must be absolute")

    @staticmethod
    def private(path, *, directory=False):
        info = path.lstat()
        expected = stat.S_ISDIR if directory else stat.S_ISREG
        if (
            not expected(info.st_mode)
            or stat.S_IMODE(info.st_mode) & 0o077
            or info.st_uid != os.geteuid()
        ):
            raise ValueError(
                "Validation trace storage must be private and owned by this process user"
            )

    def write(self, value, *, secrets=()):
        original_hash = digest(value)
        payload = json.dumps(
            redact(value, secrets), sort_keys=True, separators=(",", ":"), allow_nan=False
        ).encode()
        if len(payload) > MAX_BYTES:
            return {"state": "oversize", "payload_sha256": original_hash, "bytes": len(payload)}
        self.root.mkdir(parents=True, exist_ok=True, mode=0o700)
        self.private(self.root, directory=True)
        path = self.root / "validation.sqlite3"
        descriptor = os.open(path, os.O_CREAT | os.O_RDWR | os.O_NOFOLLOW, 0o600)
        os.close(descriptor)
        self.private(path)
        connection = sqlite3.connect(path, timeout=5, isolation_level=None)
        try:
            connection.execute("PRAGMA synchronous=FULL")
            connection.execute("BEGIN IMMEDIATE")
            version = connection.execute("PRAGMA user_version").fetchone()[0]
            if version not in {0, 1}:
                raise ValueError("Unsupported validation trace database")
            if version == 0:
                if connection.execute("SELECT 1 FROM sqlite_master WHERE type='table'").fetchone():
                    raise ValueError("Unversioned validation trace database is not empty")
                connection.execute(
                    "CREATE TABLE traces (id INTEGER PRIMARY KEY, recorded_at TEXT NOT NULL, original_payload_sha256 TEXT NOT NULL, payload TEXT NOT NULL)"
                )
                connection.execute("PRAGMA user_version=1")
            if connection.execute("SELECT count(*) FROM traces").fetchone()[0] >= MAX_RECORDS:
                connection.rollback()
                return {"state": "full", "limit": MAX_RECORDS}
            cursor = connection.execute(
                "INSERT INTO traces(recorded_at,original_payload_sha256,payload) VALUES(?,?,?)",
                (datetime.now(timezone.utc).isoformat(), original_hash, payload.decode()),
            )
            connection.commit()
            return {"state": "saved", "record_id": cursor.lastrowid}
        except BaseException:
            connection.rollback()
            raise
        finally:
            connection.close()
