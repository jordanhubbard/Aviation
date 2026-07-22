from __future__ import annotations

from typing import Any, Optional

from aviation.mac_tasks import (
    MacErrorLogHandler,
    MacTaskCreator,
    install_error_log_handler,
    report_unhandled_exception as _report_unhandled_exception,
)

from app.config import settings

mac_task_creator = MacTaskCreator(
    project="Aviation",
    require_debug=True,
    debug=settings.debug,
)


_log_handler: Optional[MacErrorLogHandler] = None


def maybe_install_log_handler() -> None:
    global _log_handler
    if _log_handler is not None:
        return
    _log_handler = install_error_log_handler(mac_task_creator)


def report_unhandled_exception(
    *, where: str, exc: BaseException, context: dict[str, Any]
) -> None:
    _report_unhandled_exception(
        creator=mac_task_creator, where=where, exc=exc, context=context
    )
