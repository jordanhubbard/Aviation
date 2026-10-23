from __future__ import annotations

from fastapi import APIRouter, Request

from app.schemas.mac_tasks import MacErrorReport, MacReportResponse
from app.services.mac_reporter import mac_task_creator

router = APIRouter()


@router.get("/mac/enabled", response_model=MacReportResponse)
def mac_enabled() -> MacReportResponse:
    enabled = mac_task_creator.enabled()
    return MacReportResponse(enabled=enabled, created=False)


@router.post("/mac/report", response_model=MacReportResponse)
def report_mac_task(payload: MacErrorReport, request: Request) -> MacReportResponse:
    enabled = mac_task_creator.enabled()
    if not enabled:
        return MacReportResponse(
            enabled=False, created=False, reason="MAC autoreport disabled"
        )

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
            f"- {key}: {value}" for key, value in sorted(context.items())
        )
    if payload.stack:
        description += "\n\nStack:\n" + payload.stack

    kind = (payload.context or {}).get("kind")
    result = mac_task_creator.create_auto_filed_task(
        title=title,
        description=description,
        task_type="bug",
        priority=1,
        auto_filed_context=f"frontend error report (kind={kind or 'unknown'})",
    )

    return MacReportResponse(
        enabled=True,
        created=result.created,
        task_id=result.task_id,
        reason=result.reason,
    )
