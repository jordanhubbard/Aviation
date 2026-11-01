"""Shared Python verifier for the Aviation remote E2E run protocol."""
from __future__ import annotations

import hashlib
import hmac
import re
import time
from collections.abc import Mapping
from pathlib import Path
from typing import Any

RUN_ID_PATTERN = re.compile(r"^e2e_[0-9a-f]{32}$")
APP_ID_PATTERN = re.compile(r"^[a-z0-9-]+$")
MAX_AGE_MS = 15 * 60 * 1000
MAX_SAFE_INTEGER = 9_007_199_254_740_991
E2E_HEADERS = {
    "run": "x-aviation-test-run",
    "expires": "x-aviation-test-expires",
    "signature": "x-aviation-test-signature",
}


class E2EContractError(ValueError):
    """Stable fail-closed error emitted for an invalid remote-E2E contract value."""

    def __init__(self, code: str, message: str) -> None:
        super().__init__(message)
        self.code = code


def parse_e2e_run_id(value: object) -> str:
    """Return a valid run identity or reject traversal and non-canonical values."""
    if not isinstance(value, str) or not RUN_ID_PATTERN.fullmatch(value):
        raise E2EContractError("e2e-run-id-invalid", "invalid E2E run ID")
    return value


def isolated_run_directory(root: str | Path, run_id: str) -> Path:
    """Resolve a run-owned directory without permitting traversal or a production path."""
    return Path(root).resolve() / parse_e2e_run_id(run_id)


def isolated_sqlite_path(root: str | Path, run_id: str) -> Path:
    """Return the sole SQLite file allowed for an isolated run."""
    return isolated_run_directory(root, run_id).with_suffix(".db")


def tag_test_record(run_id: str, record: Mapping[str, Any]) -> dict[str, Any]:
    """Add immutable run tags to a fixture before it reaches test storage."""
    run_id = parse_e2e_run_id(run_id)
    if "is_test_data" in record or "test_run_id" in record:
        raise E2EContractError(
            "e2e-record-fields-present", "record already has test isolation fields"
        )
    return {**record, "is_test_data": True, "test_run_id": run_id}


def assert_test_record_for_run(value: object, run_id: str) -> None:
    """Reject production records and records tagged for a different E2E run."""
    run_id = parse_e2e_run_id(run_id)
    if (
        not isinstance(value, Mapping)
        or value.get("is_test_data") is not True
        or value.get("test_run_id") != run_id
    ):
        raise E2EContractError(
            "e2e-record-run-mismatch", "record is not tagged for this E2E run"
        )


def _validate_signing_inputs(
    app_id: str, run_id: str, secret: str | None
) -> tuple[str, str, str]:
    if not isinstance(app_id, str) or not APP_ID_PATTERN.fullmatch(app_id):
        raise E2EContractError("e2e-app-id-invalid", "invalid E2E application ID")
    parsed_run_id = parse_e2e_run_id(run_id)
    if not isinstance(secret, str) or len(secret) < 32:
        raise E2EContractError("e2e-secret-invalid", "invalid E2E secret")
    return app_id, parsed_run_id, secret


def _signature(secret: str, app_id: str, run_id: str, expires_at: int) -> str:
    return hmac.new(
        secret.encode(),
        f"{app_id}\n{run_id}\n{expires_at}".encode(),
        hashlib.sha256,
    ).hexdigest()


def sign_e2e_headers(
    app_id: str,
    run_id: str,
    secret: str,
    now_ms: int,
    ttl_ms: int = MAX_AGE_MS,
) -> dict[str, str]:
    """Create one deterministic, application-bound remote-E2E credential."""
    app_id, run_id, secret = _validate_signing_inputs(app_id, run_id, secret)
    if (
        isinstance(now_ms, bool)
        or isinstance(ttl_ms, bool)
        or not isinstance(now_ms, int)
        or not isinstance(ttl_ms, int)
        or abs(now_ms) > MAX_SAFE_INTEGER
        or ttl_ms < 1
        or ttl_ms > MAX_AGE_MS
        or now_ms + ttl_ms > MAX_SAFE_INTEGER
    ):
        raise E2EContractError(
            "e2e-credential-lifetime-invalid", "invalid E2E credential lifetime"
        )
    expires_at = now_ms + ttl_ms
    return {
        E2E_HEADERS["run"]: run_id,
        E2E_HEADERS["expires"]: str(expires_at),
        E2E_HEADERS["signature"]: _signature(
            secret, app_id, run_id, expires_at
        ),
    }


def _credential_headers(headers: Mapping[str, str]) -> dict[str, str]:
    normalized: dict[str, str] = {}
    expected = set(E2E_HEADERS.values())
    for key, value in headers.items():
        normalized_key = key.lower()
        if normalized_key not in expected:
            continue
        if normalized_key in normalized:
            raise E2EContractError(
                "e2e-header-duplicate", f"duplicate E2E header: {normalized_key}"
            )
        if isinstance(value, str):
            normalized[normalized_key] = value
    return normalized


def verify_e2e_headers(app_id: str, headers: Mapping[str, str], secret: str | None,
                       now_ms: int | None = None) -> str | None:
    """Return the run ID, return None for normal traffic, or reject a bad test credential."""
    if not isinstance(app_id, str) or not APP_ID_PATTERN.fullmatch(app_id):
        raise E2EContractError("e2e-app-id-invalid", "invalid E2E application ID")
    normalized = _credential_headers(headers)
    if not normalized:
        return None
    if not isinstance(secret, str) or len(secret) < 32:
        raise E2EContractError("e2e-secret-invalid", "invalid E2E secret")
    run = normalized.get(E2E_HEADERS["run"])
    expiry = normalized.get(E2E_HEADERS["expires"])
    supplied = normalized.get(E2E_HEADERS["signature"])
    if not run or not expiry or not supplied:
        raise E2EContractError(
            "e2e-credentials-incomplete", "incomplete E2E credentials"
        )
    run = parse_e2e_run_id(run)
    if not re.fullmatch(r"\d{13}", expiry):
        raise E2EContractError("e2e-expiration-invalid", "invalid E2E expiration")
    now = int(time.time() * 1000) if now_ms is None else now_ms
    if (
        isinstance(now, bool)
        or not isinstance(now, int)
        or abs(now) > MAX_SAFE_INTEGER
    ):
        raise E2EContractError("e2e-expiration-invalid", "invalid E2E expiration")
    expires_at = int(expiry)
    if expires_at < now:
        raise E2EContractError("e2e-credentials-expired", "expired E2E credentials")
    if expires_at > now + MAX_AGE_MS:
        raise E2EContractError(
            "e2e-credential-lifetime-invalid", "excessive E2E credential lifetime"
        )
    if not re.fullmatch(r"[0-9a-f]{64}", supplied):
        raise E2EContractError("e2e-signature-invalid", "invalid E2E signature")
    expected = _signature(secret, app_id, run, expires_at)
    if not hmac.compare_digest(expected, supplied):
        raise E2EContractError("e2e-signature-invalid", "invalid E2E signature")
    return run


def _lease_integer(value: object) -> bool:
    return (type(value) in (int, float) and 0 <= value <= MAX_SAFE_INTEGER
            and (type(value) is int or value.is_integer()))


def create_e2e_lease(app_id: str, run_id: str, now_ms: int, ttl_ms: int) -> dict[str, Any]:
    """Construct a bounded Component-owned resource lease without resource access."""
    if not isinstance(app_id, str) or not APP_ID_PATTERN.fullmatch(app_id):
        raise E2EContractError("e2e-app-id-invalid", "invalid E2E application ID")
    parse_e2e_run_id(run_id)
    if (not _lease_integer(now_ms) or not _lease_integer(ttl_ms)
        or not 1 <= ttl_ms <= MAX_AGE_MS
        or now_ms + ttl_ms > MAX_SAFE_INTEGER):
        raise E2EContractError("e2e-lease-lifetime-invalid", "invalid E2E resource lease lifetime")
    now_ms, ttl_ms = int(now_ms), int(ttl_ms)
    return tag_test_record(run_id, {"schema": "aviation/e2e-lease@1", "app_id": app_id,
                                   "issued_at_ms": now_ms, "expires_at_ms": now_ms + ttl_ms})


def classify_e2e_lease(value: object, app_id: str, now_ms: int) -> str:
    """Classify metadata, granting no ownership to malformed or foreign leases."""
    if (not isinstance(value, Mapping) or not isinstance(app_id, str)
        or not APP_ID_PATTERN.fullmatch(app_id) or not _lease_integer(now_ms)):
        return "unowned"
    issued, expires = value.get("issued_at_ms"), value.get("expires_at_ms")
    if (value.get("schema") != "aviation/e2e-lease@1" or value.get("app_id") != app_id
        or value.get("is_test_data") is not True
        or not isinstance(value.get("test_run_id"), str)
        or not RUN_ID_PATTERN.fullmatch(value["test_run_id"])
        or not _lease_integer(issued) or not _lease_integer(expires)
        or not issued <= now_ms or not issued < expires <= MAX_SAFE_INTEGER
        or expires - issued > MAX_AGE_MS):
        return "unowned"
    return "expired" if expires <= now_ms else "active"
