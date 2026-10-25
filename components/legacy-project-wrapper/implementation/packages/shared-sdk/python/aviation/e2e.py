"""Shared Python verifier for the Aviation remote E2E run protocol."""
from __future__ import annotations

import hashlib
import hmac
import re
import time
from collections.abc import Mapping
from pathlib import Path

RUN_ID_PATTERN = re.compile(r"^e2e_[0-9a-f]{32}$")
APP_ID_PATTERN = re.compile(r"^[a-z0-9-]+$")
MAX_AGE_MS = 15 * 60 * 1000


def isolated_run_directory(root: str | Path, run_id: str) -> Path:
    """Resolve a run-owned directory without permitting traversal or a production path."""
    if not RUN_ID_PATTERN.fullmatch(run_id):
        raise ValueError("invalid E2E run ID")
    return Path(root).resolve() / run_id


def isolated_sqlite_path(root: str | Path, run_id: str) -> Path:
    """Return the sole SQLite file allowed for an isolated run."""
    return isolated_run_directory(root, run_id).with_suffix(".db")


def verify_e2e_headers(app_id: str, headers: Mapping[str, str], secret: str | None,
                       now_ms: int | None = None) -> str | None:
    """Return the run ID, return None for normal traffic, or reject a bad test credential."""
    run = headers.get("x-aviation-test-run")
    expiry = headers.get("x-aviation-test-expires")
    signature = headers.get("x-aviation-test-signature")
    if not any((run, expiry, signature)):
        return None
    if (not secret or len(secret) < 32 or not APP_ID_PATTERN.fullmatch(app_id)
            or not run or not RUN_ID_PATTERN.fullmatch(run)
            or not expiry or not re.fullmatch(r"\d{13}", expiry)
            or not signature or not re.fullmatch(r"[0-9a-f]{64}", signature)):
        raise ValueError("invalid E2E credentials")
    now = int(time.time() * 1000) if now_ms is None else now_ms
    expires_at = int(expiry)
    if expires_at < now or expires_at > now + MAX_AGE_MS:
        raise ValueError("expired E2E credentials")
    expected = hmac.new(secret.encode(), f"{app_id}\n{run}\n{expiry}".encode(), hashlib.sha256).hexdigest()
    if not hmac.compare_digest(expected, signature):
        raise ValueError("invalid E2E signature")
    return run
