from __future__ import annotations

import hashlib
import json
import logging
import os
import time
import traceback
import urllib.error
import urllib.request
from dataclasses import dataclass
from threading import Lock
from typing import Any, Optional

logger = logging.getLogger(__name__)


@dataclass(frozen=True)
class CreateTaskResult:
    created: bool
    task_id: Optional[str] = None
    reason: Optional[str] = None


class MacTaskCreator:
    def __init__(
        self,
        *,
        hub_url: Optional[str] = None,
        token: Optional[str] = None,
        project: Optional[str] = None,
        require_debug: bool = False,
        debug: bool = False,
        actor: str = "aviation-runtime-autoreport",
    ) -> None:
        self._lock = Lock()
        self._recent: dict[str, float] = {}
        self._hub_url = (
            hub_url
            or os.environ.get("MAC_API_URL")
            or os.environ.get("MAC_URL")
            or os.environ.get("MAC_HUB_URL")
            or ""
        ).rstrip("/")
        self._token = token or os.environ.get("MAC_API_TOKEN")
        self._project = (
            project or os.environ.get("MAC_AUTOREPORT_PROJECT") or "Aviation"
        )
        self._require_debug = require_debug
        self._debug = debug
        self._actor = actor

    def enabled(self) -> bool:
        configured = str(os.environ.get("MAC_AUTOREPORT", "")).lower()
        if configured in {"0", "false", "no"}:
            return False

        force = str(os.environ.get("MAC_AUTOREPORT_FORCE", "")).lower() in {
            "1",
            "true",
            "yes",
        }
        if not force and (
            os.environ.get("CI") or os.environ.get("PYTEST_CURRENT_TEST")
        ):
            return False
        if self._require_debug and not self._debug:
            return False
        return bool(self._hub_url)

    @staticmethod
    def _signature(title: str, description: str) -> str:
        digest = hashlib.sha256()
        digest.update(title.encode("utf-8", errors="ignore"))
        digest.update(b"\0")
        digest.update(description.encode("utf-8", errors="ignore"))
        return digest.hexdigest()

    def create_task(
        self,
        *,
        title: str,
        description: str,
        task_type: str = "bug",
        priority: int = 1,
        depends_on: Optional[str] = None,
        dedupe_ttl_s: int = 15 * 60,
    ) -> CreateTaskResult:
        if not self.enabled():
            return CreateTaskResult(created=False, reason="MAC autoreport disabled")

        signature = self._signature(title, description)
        now = time.time()
        with self._lock:
            last = self._recent.get(signature)
            if last and now - last < dedupe_ttl_s:
                return CreateTaskResult(created=False, reason="deduped")
            self._recent[signature] = now

        parent = depends_on or os.environ.get("MAC_AUTOREPORT_PARENT")
        body = {
            "title": title,
            "description": description,
            "project": self._project,
            "priority": priority,
            "dependencies": [parent] if parent else [],
            "metadata": {
                "source": "aviation-runtime-autoreport",
                "task_type": task_type,
                "signature": signature,
                "auto_filed": True,
            },
            "actor": self._actor,
            "idempotency_key": f"aviation-autoreport:{signature}",
        }
        request = urllib.request.Request(
            f"{self._hub_url}/tasks",
            data=json.dumps(body).encode("utf-8"),
            headers={
                "Accept": "application/json",
                "Content-Type": "application/json",
                **({"Authorization": f"Bearer {self._token}"} if self._token else {}),
            },
            method="POST",
        )
        try:
            with urllib.request.urlopen(request, timeout=30) as response:
                payload = json.loads(response.read().decode("utf-8"))
        except urllib.error.HTTPError as exc:
            logger.error("MAC task create failed with HTTP %s", exc.code)
            return CreateTaskResult(
                created=False, reason=f"MAC task create failed (HTTP {exc.code})"
            )
        except (urllib.error.URLError, OSError, ValueError) as exc:
            logger.error("MAC task create failed: %s", exc)
            return CreateTaskResult(
                created=False, reason=f"MAC task create failed: {exc}"
            )

        task_id = payload.get("id") if isinstance(payload, dict) else None
        if not task_id:
            return CreateTaskResult(
                created=False, reason="MAC task create returned no task id"
            )
        return CreateTaskResult(created=True, task_id=str(task_id))

    def create_auto_filed_task(
        self,
        *,
        title: str,
        description: str,
        auto_filed_context: str,
        task_type: str = "bug",
        priority: int = 1,
        depends_on: Optional[str] = None,
        dedupe_ttl_s: int = 15 * 60,
    ) -> CreateTaskResult:
        return self.create_task(
            title=title,
            description=(f"{description}\n\nAuto-filed context:\n{auto_filed_context}"),
            task_type=task_type,
            priority=priority,
            depends_on=depends_on,
            dedupe_ttl_s=dedupe_ttl_s,
        )

    @staticmethod
    def format_exception(exc: BaseException) -> str:
        return "".join(traceback.format_exception(type(exc), exc, exc.__traceback__))


class MacErrorLogHandler(logging.Handler):
    def __init__(self, creator: MacTaskCreator):
        super().__init__(level=logging.ERROR)
        self._creator = creator
        self._in_emit = False

    def emit(self, record: logging.LogRecord) -> None:  # pragma: no cover
        if self._in_emit or not self._creator.enabled():
            return
        if record.name.startswith("uvicorn") or record.name.startswith("fastapi"):
            return
        if record.levelno < logging.ERROR or not record.exc_info:
            return

        stack = "".join(traceback.format_exception(*record.exc_info))
        msg = record.getMessage()
        try:
            self._in_emit = True
            self._creator.create_auto_filed_task(
                title=f"[backend][log] {msg[:80]}".strip(),
                description=(
                    f"Logger: {record.name}\nLevel: {record.levelname}\n\n"
                    f"Message:\n{msg}\n\nTraceback:\n{stack}"
                ),
                priority=1,
                auto_filed_context=(
                    f"backend log emitted error with traceback (logger={record.name})."
                ),
            )
        finally:
            self._in_emit = False


def install_error_log_handler(creator: MacTaskCreator) -> Optional[MacErrorLogHandler]:
    if not creator.enabled():
        return None
    handler = MacErrorLogHandler(creator)
    logging.getLogger().addHandler(handler)
    return handler


def report_unhandled_exception(
    *, creator: MacTaskCreator, where: str, exc: BaseException, context: dict[str, Any]
) -> None:
    if not creator.enabled():
        return

    stack = creator.format_exception(exc)
    msg = str(exc)
    creator.create_auto_filed_task(
        title=f"[backend][{where}] {msg[:80]}".strip(),
        description=(
            f"Where: {where}\n\nMessage:\n{msg}\n\nContext:\n"
            f"{json.dumps(context, indent=2, default=str)}\n\nTraceback:\n{stack}"
        ),
        priority=1,
        auto_filed_context=f"unhandled exception in backend ({where}).",
    )
