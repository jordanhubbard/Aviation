from __future__ import annotations

import os
from typing import Any, Optional

from aviation.beads import (
    BeadsErrorLogHandler,
    BeadsIssueCreator,
    install_error_log_handler,
    report_unhandled_exception as _report_unhandled_exception,
)

from app.config import REPO_ROOT, settings


beads_issue_creator = BeadsIssueCreator(
    repo_root=REPO_ROOT,
    default_parent=os.environ.get("BEADS_AUTOREPORT_PARENT") or "Aviation-hd5",
    require_debug=True,
    debug=settings.debug,
)


_log_handler: Optional[BeadsErrorLogHandler] = None


def maybe_install_log_handler() -> None:
    global _log_handler
    if _log_handler is not None:
        return
    _log_handler = install_error_log_handler(beads_issue_creator)


def report_unhandled_exception(*, where: str, exc: BaseException, context: dict[str, Any]) -> None:
    _report_unhandled_exception(creator=beads_issue_creator, where=where, exc=exc, context=context)
