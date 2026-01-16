from __future__ import annotations

from fastapi import APIRouter, Request

from app.schemas.beads import BeadsErrorReport, BeadsReportResponse
from app.services.beads_reporter import beads_issue_creator


router = APIRouter()


@router.get("/beads/enabled", response_model=BeadsReportResponse)
def beads_enabled() -> BeadsReportResponse:
    enabled = beads_issue_creator.enabled()
    return BeadsReportResponse(enabled=enabled, created=False)


@router.post("/beads/report", response_model=BeadsReportResponse)
def report_beads_issue(payload: BeadsErrorReport, request: Request) -> BeadsReportResponse:
    enabled = beads_issue_creator.enabled()
    if not enabled:
        return BeadsReportResponse(enabled=False, created=False, reason="beads autoreport disabled")

    title_prefix = {
        "frontend": "[frontend]",
        "backend": "[backend]",
        "log": "[log]",
    }.get(payload.source, "[error]")

    first_line = payload.message.splitlines()[0] if payload.message else "Error"
    title = f"{title_prefix} {first_line[:100]}".strip()

    context = dict(payload.context or {})
    context.setdefault("client", request.client.host if request.client else None)
    if payload.url:
        context.setdefault("url", payload.url)
    if payload.user_agent:
        context.setdefault("user_agent", payload.user_agent)

    description = payload.message
    if context:
        description += "\n\nContext:\n" + "\n".join(
            f"- {k}: {v}" for k, v in sorted(context.items())
        )
    if payload.stack:
        description += "\n\nStack:\n" + payload.stack

    res = beads_issue_creator.create_issue(
        title=title,
        description=description,
        issue_type="bug",
        priority=2,
    )

    return BeadsReportResponse(
        enabled=True,
        created=res.created,
        issue_id=res.issue_id,
        reason=res.reason,
    )
