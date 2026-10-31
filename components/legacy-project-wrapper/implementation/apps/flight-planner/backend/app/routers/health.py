from __future__ import annotations

from fastapi import APIRouter, Request
from aviation.health import create_health_report

router = APIRouter()


@router.get("/health")
def health(request: Request) -> dict:
    """Health check endpoint.

    Also includes startup configuration issues (e.g. missing API keys).
    """

    issues = getattr(request.app.state, "startup_config_issues", [])
    return create_health_report(details={"startup_issues": issues})
