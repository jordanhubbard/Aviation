from __future__ import annotations

from fastapi import APIRouter, Request
from fastapi.responses import RedirectResponse

from app.schemas.issues import IssueErrorReport, IssueReportResponse
from app.services.issue_reporter import github_issue_creator

router = APIRouter()


@router.get("/issues/enabled", response_model=IssueReportResponse)
def issue_reporting_enabled() -> IssueReportResponse:
    enabled = github_issue_creator.enabled()
    return IssueReportResponse(enabled=enabled, created=False)


@router.post("/issues/report", response_model=IssueReportResponse)
def report_issue(payload: IssueErrorReport, request: Request) -> IssueReportResponse:
    enabled = github_issue_creator.enabled()
    if not enabled:
        return IssueReportResponse(
            enabled=False, created=False, reason="GitHub issue reporting disabled"
        )

    title_prefix = {
        "frontend": "[frontend]",
        "backend": "[backend]",
        "log": "[log]",
    }.get(payload.source, "[error]")

    first_line = payload.message.splitlines()[0] if payload.message else "Error"
    title = f"{title_prefix} {first_line[:100]}".strip()

    context = dict(payload.context or {})
    if payload.url:
        context.setdefault("url", payload.url)
    if payload.user_agent:
        context.setdefault("user_agent", payload.user_agent)

    description = payload.message
    if context:
        description += "\n\nContext:\n" + "\n".join(
            f"- {key}: {value}" for key, value in sorted(context.items())
        )
    if payload.stack:
        description += "\n\nStack:\n" + payload.stack

    kind = (payload.context or {}).get("kind")
    result = github_issue_creator.create_auto_filed_issue(
        title=title,
        body=description,
        auto_filed_context=f"frontend error report (kind={kind or 'unknown'})",
    )

    return IssueReportResponse(
        enabled=True,
        created=result.created,
        issue_number=result.issue_number,
        issue_url=result.issue_url,
        reason=result.reason,
    )


@router.get("/mac/enabled", include_in_schema=False)
def legacy_reporting_enabled():
    return RedirectResponse("/api/issues/enabled", status_code=307)


@router.post("/mac/report", include_in_schema=False)
def legacy_reporting_report():
    return RedirectResponse("/api/issues/report", status_code=307)
