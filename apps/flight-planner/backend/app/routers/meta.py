from __future__ import annotations

import os
from datetime import datetime, timezone
from typing import Any, Optional

from fastapi import APIRouter


router = APIRouter()


def _env(*keys: str) -> Optional[str]:
    for k in keys:
        v = os.environ.get(k)
        if v:
            return str(v)
    return None


@router.get(
    "/meta",
    summary="Build metadata",
    description="Returns best-effort build/repository metadata for this running service.",
)
def meta() -> dict[str, Any]:
    return {
        "repo_url": _env("REPO_URL", "GITHUB_REPOSITORY_URL", "SOURCE_REPO_URL"),
        "revision": _env("GIT_SHA", "GITHUB_SHA", "SOURCE_REVISION"),
        "build_time_utc": _env("BUILD_TIME_UTC"),
        "server_time_utc": datetime.now(timezone.utc).isoformat(),
    }
