from __future__ import annotations

from fastapi import APIRouter, Request

router = APIRouter()


@router.get("/health")
def health(request: Request) -> dict:
    """Health check endpoint.

    Also includes startup configuration issues (e.g. missing API keys).
    """

    issues = getattr(request.app.state, "startup_config_issues", [])
    return {"status": "ok", "startup_issues": issues}
