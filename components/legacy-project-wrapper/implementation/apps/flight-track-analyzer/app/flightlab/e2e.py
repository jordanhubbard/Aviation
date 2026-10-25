"""Python side of the shared SDK's signed, app-bound E2E run protocol."""
from __future__ import annotations

import hashlib
import hmac
import os
import re
import time

from fastapi import HTTPException, Request

APP_ID = "flight-track-analyzer"
RUN_ID = re.compile(r"^e2e_[0-9a-f]{32}$")
MAX_AGE_MS = 15 * 60 * 1000


def verified_run(request: Request) -> str | None:
    headers = request.headers
    run = headers.get("x-aviation-test-run")
    expiry = headers.get("x-aviation-test-expires")
    signature = headers.get("x-aviation-test-signature")
    if not any((run, expiry, signature)):
        return None
    secret = os.environ.get("AVIATION_E2E_SECRET", "")
    if (len(secret) < 32 or not run or not RUN_ID.fullmatch(run)
            or not expiry or not re.fullmatch(r"\d{13}", expiry)
            or not signature or not re.fullmatch(r"[0-9a-f]{64}", signature)):
        raise HTTPException(403, "invalid E2E credentials")
    now = int(time.time() * 1000)
    expires_at = int(expiry)
    if expires_at < now or expires_at > now + MAX_AGE_MS:
        raise HTTPException(403, "expired E2E credentials")
    expected = hmac.new(secret.encode(), f"{APP_ID}\n{run}\n{expiry}".encode(), hashlib.sha256).hexdigest()
    if not hmac.compare_digest(expected, signature):
        raise HTTPException(403, "invalid E2E signature")
    return run
