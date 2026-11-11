from __future__ import annotations

import hashlib
import json
import logging
import os
import re
import time
import traceback
import urllib.error
import urllib.parse
import urllib.request
from dataclasses import dataclass
from threading import Lock
from typing import Any, Optional


@dataclass(frozen=True)
class CreateIssueResult:
    created: bool
    issue_number: Optional[int] = None
    issue_url: Optional[str] = None
    reason: Optional[str] = None


def redact_issue_text(value: str) -> str:
    def clean_url(match: re.Match) -> str:
        try:
            parsed = urllib.parse.urlsplit(match.group())
            host = parsed.hostname or ""
            if ":" in host:
                host = "[" + host + "]"
            if parsed.port:
                host += ":" + str(parsed.port)
            return urllib.parse.urlunsplit((parsed.scheme, host, parsed.path, "", ""))
        except ValueError:
            return "[redacted URL]"

    value = re.sub(r"https?://[^\s<>\"']+", clean_url, value)
    value = re.sub(r"\bBearer\s+[^\s,;]+", "Bearer [REDACTED]", value, flags=re.I)
    value = re.sub(
        r"\b(?:gh[pousr]_[A-Za-z0-9_]+|github_pat_[A-Za-z0-9_]+)\b", "[REDACTED]", value
    )
    return re.sub(
        r"\b(token|password|secret|api[_-]?key|authorization|cookie)([\"']?\s*[:=]\s*[\"']?)[^\s,;\"']+",
        r"\1\2[REDACTED]",
        value,
        flags=re.I,
    )


def _flag(name: str) -> bool:
    return os.environ.get(name, "").lower() in {"1", "true", "yes"}


class GitHubIssueCreator:
    """Opt-in GitHub reporting with server-side credentials and no tracker fallback."""

    def __init__(
        self,
        *,
        repository: Optional[str] = None,
        api_url: Optional[str] = None,
        token: Optional[str] = None,
        require_debug: bool = False,
        debug: bool = False,
    ) -> None:
        self._repository = (
            repository
            if repository is not None
            else os.environ.get("GITHUB_ISSUES_REPOSITORY", "jordanhubbard/Aviation")
        )
        if not re.fullmatch(
            r"[A-Za-z0-9_-][A-Za-z0-9_.-]*/[A-Za-z0-9_-][A-Za-z0-9_.-]*",
            self._repository,
        ):
            raise ValueError("Invalid GitHub issue repository")
        self._api_url = (
            api_url
            if api_url is not None
            else os.environ.get("GITHUB_API_URL", "https://api.github.com")
        ).rstrip("/")
        parsed = urllib.parse.urlsplit(self._api_url)
        if (
            parsed.username
            or parsed.password
            or parsed.query
            or parsed.fragment
            or (
                parsed.scheme != "https"
                and not (
                    parsed.scheme == "http"
                    and parsed.hostname in {"127.0.0.1", "localhost", "::1"}
                )
            )
        ):
            raise ValueError(
                "GitHub issue API must use HTTPS or explicit loopback HTTP"
            )
        if not parsed.hostname:
            raise ValueError("Invalid GitHub issue API")
        self._token = (
            token if token is not None else os.environ.get("GITHUB_ISSUES_TOKEN")
        )
        self._require_debug, self._debug = require_debug, debug
        self._lock = Lock()
        self._recent: dict[str, float] = {}
        self._in_flight: set[str] = set()
        self._attempts: list[float] = []

    def enabled(self) -> bool:
        if not _flag("GITHUB_ISSUES_AUTOREPORT"):
            return False
        if not _flag("GITHUB_ISSUES_AUTOREPORT_FORCE") and (
            os.environ.get("CI") or os.environ.get("PYTEST_CURRENT_TEST")
        ):
            return False
        return bool(self._token) and (not self._require_debug or self._debug)

    def create_issue(
        self, *, title: str, body: str, dedupe_ttl_s: int = 900
    ) -> CreateIssueResult:
        if not self.enabled():
            return CreateIssueResult(
                created=False, reason="GitHub issue reporting disabled"
            )
        title, body = redact_issue_text(title)[:180], redact_issue_text(body)[:60000]
        signature = hashlib.sha256((title + "\0" + body).encode("utf-8")).hexdigest()
        now = time.time()
        with self._lock:
            if (
                signature in self._in_flight
                or now - self._recent.get(signature, 0) < dedupe_ttl_s
            ):
                return CreateIssueResult(created=False, reason="deduped")
            self._attempts = [stamp for stamp in self._attempts if now - stamp < 3600]
            if len(self._attempts) >= 5:
                return CreateIssueResult(
                    created=False, reason="GitHub issue reporting rate limited"
                )
            self._attempts.append(now)
            self._in_flight.add(signature)
        request = urllib.request.Request(
            f"{self._api_url}/repos/{self._repository}/issues",
            data=json.dumps(
                {
                    "title": title,
                    "body": f"{body}\n\n<!-- aviation-autoreport:{signature} -->",
                }
            ).encode("utf-8"),
            headers={
                "Accept": "application/vnd.github+json",
                "Content-Type": "application/json",
                "Authorization": f"Bearer {self._token}",
                "X-GitHub-Api-Version": "2022-11-28",
                "User-Agent": "aviation-runtime-issue-reporter",
            },
            method="POST",
        )
        try:
            with urllib.request.urlopen(request, timeout=30) as response:
                payload = json.loads(response.read().decode("utf-8"))
            number = payload.get("number") if isinstance(payload, dict) else None
            url = payload.get("html_url") if isinstance(payload, dict) else None
            if type(number) is not int or number <= 0 or not isinstance(url, str):
                return CreateIssueResult(
                    created=False,
                    reason="GitHub issue create returned an invalid issue",
                )
            with self._lock:
                self._recent[signature] = now
                if len(self._recent) > 1024:
                    self._recent.pop(next(iter(self._recent)))
            return CreateIssueResult(created=True, issue_number=number, issue_url=url)
        except urllib.error.HTTPError as error:
            return CreateIssueResult(
                created=False, reason=f"GitHub issue create failed (HTTP {error.code})"
            )
        except (urllib.error.URLError, OSError, ValueError, TypeError):
            return CreateIssueResult(
                created=False, reason="GitHub issue create unavailable"
            )
        finally:
            with self._lock:
                self._in_flight.discard(signature)

    def create_auto_filed_issue(
        self, *, title: str, body: str, auto_filed_context: str, dedupe_ttl_s: int = 900
    ) -> CreateIssueResult:
        return self.create_issue(
            title=title,
            body=f"{body}\n\nAuto-filed context:\n{auto_filed_context}",
            dedupe_ttl_s=dedupe_ttl_s,
        )

    @staticmethod
    def format_exception(exc: BaseException) -> str:
        return "".join(traceback.format_exception(type(exc), exc, exc.__traceback__))


class GitHubErrorLogHandler(logging.Handler):
    def __init__(self, creator: GitHubIssueCreator):
        super().__init__(level=logging.ERROR)
        self._creator = creator
        self._in_emit = False

    def emit(self, record: logging.LogRecord) -> None:
        if self._in_emit or not self._creator.enabled() or not record.exc_info:
            return
        if record.name.startswith(("uvicorn", "fastapi", __name__)):
            return
        try:
            self._in_emit = True
            self._creator.create_auto_filed_issue(
                title=f"[backend][log] {record.getMessage()[:80]}",
                body=f"Logger: {record.name}\n\n{record.getMessage()}\n\n{''.join(traceback.format_exception(*record.exc_info))}",
                auto_filed_context=f"backend log emitted error with traceback (logger={record.name}).",
            )
        finally:
            self._in_emit = False


def install_error_log_handler(
    creator: GitHubIssueCreator,
) -> Optional[GitHubErrorLogHandler]:
    if not creator.enabled():
        return None
    handler = GitHubErrorLogHandler(creator)
    logging.getLogger().addHandler(handler)
    return handler


def report_unhandled_exception(
    *,
    creator: GitHubIssueCreator,
    where: str,
    exc: BaseException,
    context: dict[str, Any],
) -> None:
    if creator.enabled():
        creator.create_auto_filed_issue(
            title=f"[backend][{where}] {str(exc)[:80]}",
            body=f"Where: {where}\n\nContext:\n{json.dumps(context, indent=2, default=str)}\n\n{creator.format_exception(exc)}",
            auto_filed_context=f"unhandled exception in backend ({where}).",
        )
