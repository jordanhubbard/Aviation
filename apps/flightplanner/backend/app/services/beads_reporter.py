from __future__ import annotations

import hashlib
import json
import logging
import os
import shutil
import subprocess
import time
import traceback
from dataclasses import dataclass
from threading import Lock
from typing import Any, Optional

from app.config import REPO_ROOT, settings


logger = logging.getLogger(__name__)


@dataclass(frozen=True)
class CreateIssueResult:
    created: bool
    issue_id: Optional[str] = None
    reason: Optional[str] = None


class BeadsIssueCreator:
    def __init__(self) -> None:
        self._lock = Lock()
        self._recent: dict[str, float] = {}

    def enabled(self) -> bool:
        # Explicit disable always wins.
        if str(os.environ.get("BEADS_AUTOREPORT", "")).lower() in {"0", "false", "no"}:
            return False

        # Don't create issues during tests/CI.
        if os.environ.get("CI"):
            return False
        if os.environ.get("PYTEST_CURRENT_TEST"):
            return False

        if not settings.debug:
            return False

        if not (REPO_ROOT / ".beads").exists():
            return False

        return shutil.which("bd") is not None

    def _signature(self, title: str, description: str) -> str:
        h = hashlib.sha256()
        h.update(title.encode("utf-8", errors="ignore"))
        h.update(b"\0")
        h.update(description.encode("utf-8", errors="ignore"))
        return h.hexdigest()

    def create_issue(
        self,
        *,
        title: str,
        description: str,
        issue_type: str = "bug",
        priority: int = 2,
        discovered_from: Optional[str] = None,
        dedupe_ttl_s: int = 15 * 60,
    ) -> CreateIssueResult:
        if not self.enabled():
            return CreateIssueResult(created=False, reason="beads autoreport disabled")

        signature = self._signature(title, description)

        now = time.time()
        with self._lock:
            last = self._recent.get(signature)
            if last and (now - last) < dedupe_ttl_s:
                return CreateIssueResult(created=False, reason="deduped")
            self._recent[signature] = now

        cmd = [
            "bd",
            "create",
            title,
            "--description",
            description,
            "-t",
            issue_type,
            "-p",
            str(priority),
            "--json",
        ]

        parent = discovered_from or os.environ.get("BEADS_AUTOREPORT_PARENT") or "flightplanner-47q"
        if parent:
            cmd += ["--deps", f"discovered-from:{parent}"]

        try:
            proc = subprocess.run(
                cmd,
                cwd=str(REPO_ROOT),
                check=False,
                capture_output=True,
                text=True,
            )
        except Exception as exc:  # pragma: no cover
            logger.exception("Failed to execute bd create")
            return CreateIssueResult(created=False, reason=f"bd exec failed: {exc}")

        if proc.returncode != 0:
            logger.error("bd create failed: %s", proc.stderr.strip() or proc.stdout.strip())
            return CreateIssueResult(created=False, reason="bd create failed")

        try:
            payload = json.loads(proc.stdout)
        except Exception:
            logger.error("bd create returned non-json output: %r", proc.stdout[:500])
            return CreateIssueResult(created=False, reason="bd create returned invalid json")

        issue_id = payload.get("id") if isinstance(payload, dict) else None
        return CreateIssueResult(created=True, issue_id=issue_id)

    def format_exception(self, exc: BaseException) -> str:
        return "".join(traceback.format_exception(type(exc), exc, exc.__traceback__))


beads_issue_creator = BeadsIssueCreator()


class BeadsErrorLogHandler(logging.Handler):
    def __init__(self, creator: BeadsIssueCreator):
        super().__init__(level=logging.ERROR)
        self._creator = creator
        self._in_emit = False

    def emit(self, record: logging.LogRecord) -> None:  # pragma: no cover
        if self._in_emit:
            return
        if not self._creator.enabled():
            return

        if record.name.startswith("uvicorn") or record.name.startswith("fastapi"):
            return

        if record.levelno < logging.ERROR:
            return

        stack = None
        if record.exc_info:
            stack = "".join(traceback.format_exception(*record.exc_info))
        if not stack:
            return

        msg = record.getMessage()
        title = f"[backend][log] {msg[:80]}".strip()
        description = f"Logger: {record.name}\nLevel: {record.levelname}\n\nMessage:\n{msg}\n\nTraceback:\n{stack}"

        try:
            self._in_emit = True
            self._creator.create_issue(title=title, description=description, priority=2)
        finally:
            self._in_emit = False


_log_handler: Optional[BeadsErrorLogHandler] = None


def maybe_install_log_handler() -> None:
    global _log_handler
    if _log_handler is not None:
        return
    if not beads_issue_creator.enabled():
        return

    handler = BeadsErrorLogHandler(beads_issue_creator)
    logging.getLogger().addHandler(handler)
    _log_handler = handler


def report_unhandled_exception(*, where: str, exc: BaseException, context: dict[str, Any]) -> None:
    if not beads_issue_creator.enabled():
        return

    stack = beads_issue_creator.format_exception(exc)
    msg = str(exc)
    title = f"[backend][{where}] {msg[:80]}".strip()
    desc = f"Where: {where}\n\nMessage:\n{msg}\n\nContext:\n{json.dumps(context, indent=2, default=str)}\n\nTraceback:\n{stack}"
    beads_issue_creator.create_issue(title=title, description=desc, priority=1)
