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
from pathlib import Path
from threading import Lock
from typing import Any, Optional


logger = logging.getLogger(__name__)


def find_repo_root(start: Optional[Path] = None) -> Optional[Path]:
    current = (start or Path.cwd()).resolve()
    while True:
        if (current / ".beads").exists():
            return current
        parent = current.parent
        if parent == current:
            return None
        current = parent


@dataclass(frozen=True)
class CreateIssueResult:
    created: bool
    issue_id: Optional[str] = None
    reason: Optional[str] = None


class BeadsIssueCreator:
    def __init__(
        self,
        *,
        repo_root: Optional[Path] = None,
        default_parent: Optional[str] = None,
        require_debug: bool = False,
        debug: bool = False,
        bd_path: str = "bd",
    ) -> None:
        self._lock = Lock()
        self._recent: dict[str, float] = {}
        self._repo_root = repo_root or find_repo_root()
        self._default_parent = default_parent
        self._require_debug = require_debug
        self._debug = debug
        self._bd_path = bd_path

    def enabled(self) -> bool:
        v = str(os.environ.get("BEADS_AUTOREPORT", "")).lower()
        if v in {"0", "false", "no"}:
            return False

        force = str(os.environ.get("BEADS_AUTOREPORT_FORCE", "")).lower() in {"1", "true", "yes"}

        if not force:
            if os.environ.get("CI"):
                return False
            if os.environ.get("PYTEST_CURRENT_TEST"):
                return False

        if self._require_debug and not self._debug:
            return False

        if not self._repo_root or not (self._repo_root / ".beads").exists():
            return False

        return shutil.which(self._bd_path) is not None

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
        priority: int = 1,
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

        repo_root = self._repo_root
        if not repo_root:
            return CreateIssueResult(created=False, reason="missing repo root")

        cmd = [
            self._bd_path,
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

        parent = discovered_from or os.environ.get("BEADS_AUTOREPORT_PARENT") or self._default_parent
        if parent:
            cmd += ["--deps", f"discovered-from:{parent}"]

        try:
            proc = subprocess.run(
                cmd,
                cwd=str(repo_root),
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

    def add_comment(self, *, issue_id: str, comment: str) -> bool:
        if not self.enabled():
            return False

        repo_root = self._repo_root
        if not repo_root:
            return False

        cmd = [self._bd_path, "comments", "add", issue_id, comment, "--json"]
        try:
            proc = subprocess.run(
                cmd,
                cwd=str(repo_root),
                check=False,
                capture_output=True,
                text=True,
            )
        except Exception:  # pragma: no cover
            logger.exception("Failed to execute bd comments add")
            return False

        return proc.returncode == 0

    def create_auto_filed_issue(
        self,
        *,
        title: str,
        description: str,
        auto_filed_comment: str,
        issue_type: str = "bug",
        priority: int = 1,
        discovered_from: Optional[str] = None,
        dedupe_ttl_s: int = 15 * 60,
    ) -> CreateIssueResult:
        res = self.create_issue(
            title=title,
            description=description,
            issue_type=issue_type,
            priority=priority,
            discovered_from=discovered_from,
            dedupe_ttl_s=dedupe_ttl_s,
        )
        if not res.created or not res.issue_id:
            return res

        self.add_comment(issue_id=res.issue_id, comment=f"[auto-filed] {auto_filed_comment}".strip())
        return res

    def format_exception(self, exc: BaseException) -> str:
        return "".join(traceback.format_exception(type(exc), exc, exc.__traceback__))


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
        description = (
            f"Logger: {record.name}\nLevel: {record.levelname}\n\nMessage:\n{msg}\n\nTraceback:\n{stack}"
        )

        try:
            self._in_emit = True
            self._creator.create_auto_filed_issue(
                title=title,
                description=description,
                priority=1,
                auto_filed_comment=f"backend log emitted error with traceback (logger={record.name}).",
            )
        finally:
            self._in_emit = False


def install_error_log_handler(creator: BeadsIssueCreator) -> Optional[BeadsErrorLogHandler]:
    if not creator.enabled():
        return None
    handler = BeadsErrorLogHandler(creator)
    logging.getLogger().addHandler(handler)
    return handler


def report_unhandled_exception(
    *, creator: BeadsIssueCreator, where: str, exc: BaseException, context: dict[str, Any]
) -> None:
    if not creator.enabled():
        return

    stack = creator.format_exception(exc)
    msg = str(exc)
    title = f"[backend][{where}] {msg[:80]}".strip()
    desc = (
        f"Where: {where}\n\nMessage:\n{msg}\n\nContext:\n{json.dumps(context, indent=2, default=str)}\n\nTraceback:\n{stack}"
    )

    creator.create_auto_filed_issue(
        title=title,
        description=desc,
        priority=1,
        auto_filed_comment=f"unhandled exception in backend ({where}).",
    )
