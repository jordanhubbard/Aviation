from __future__ import annotations

from typing import Any, Optional

from aviation.github_issues import (
    GitHubErrorLogHandler,
    GitHubIssueCreator,
    install_error_log_handler,
    report_unhandled_exception as _report_unhandled_exception,
)

from app.config import settings

github_issue_creator = GitHubIssueCreator(
    require_debug=True,
    debug=settings.debug,
)


_log_handler: Optional[GitHubErrorLogHandler] = None


def maybe_install_log_handler() -> None:
    global _log_handler
    if _log_handler is not None:
        return
    _log_handler = install_error_log_handler(github_issue_creator)


def report_unhandled_exception(
    *, where: str, exc: BaseException, context: dict[str, Any]
) -> None:
    _report_unhandled_exception(
        creator=github_issue_creator, where=where, exc=exc, context=context
    )
