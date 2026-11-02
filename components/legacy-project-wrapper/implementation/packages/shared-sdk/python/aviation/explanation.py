"""Thin worker-safe bindings to the application's common Node explanation broker.

Provider communication, request state and browser UI live in @aviation/ai-explainer.
These adapters forward only its declared HTTP surface to an owned loopback broker.
"""
from dataclasses import dataclass
import json
import os
import re
from typing import Callable, Iterable, Mapping
from urllib.error import HTTPError, URLError
from urllib.parse import urlsplit
from urllib.request import Request, ProxyHandler, HTTPRedirectHandler, build_opener

from .e2e import parse_e2e_run_id, verify_e2e_headers

MAX_BODY = 524_288
_RUN_HEADER = "x-aviation-test-run"
_FORWARDED = {"content-type", "x-aviation-explain-token", "x-aviation-test-run",
              "x-aviation-test-expires", "x-aviation-test-signature"}


class _NoRedirect(HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        return None


@dataclass(frozen=True)
class ExplanationResponse:
    status: int
    body: bytes
    headers: Mapping[str, str]


def _error(status: int) -> ExplanationResponse:
    message = "Explanation access was not authorized." if status in {401, 403} else (
        "Explanation request was not found." if status == 404 else (
        "Invalid explanation request." if status in {400, 405, 413} else "AI explanations are unavailable."))
    return ExplanationResponse(status, json.dumps({"error": message}).encode(),
                               {"Content-Type": "application/json", "Cache-Control": "no-store"})


class ExplanationProxy:
    def __init__(self, app_id: str, broker_url: str | None = None,
                 environment: Mapping[str, str] | None = None):
        if not re.fullmatch(r"[a-z][a-z0-9-]{0,63}", app_id):
            raise ValueError("Invalid explanation application identity")
        self.app_id = app_id
        self.opener = build_opener(ProxyHandler({}), _NoRedirect())
        env = os.environ if environment is None else environment
        self.run = parse_e2e_run_id(env["AVIATION_E2E_RUN_ID"]) if "AVIATION_E2E_RUN_ID" in env else None
        self.secret = env.get("AVIATION_E2E_SECRET")
        if self.run and (not self.secret or len(self.secret) < 32):
            raise ValueError("Isolated explanations require a signing key")
        self.broker_url = None
        try:
            value = broker_url if broker_url is not None else env.get("AVIATION_EXPLAIN_BROKER_URL", "")
            parsed = urlsplit(value)
            if (parsed.scheme == "http" and parsed.hostname in {"127.0.0.1", "::1"}
                    and parsed.port and not parsed.username and not parsed.password
                    and parsed.path in {"", "/"} and not parsed.query and not parsed.fragment):
                self.broker_url = value.rstrip("/")
        except ValueError:
            pass

    def _methods(self, path: str) -> set[str]:
        if path == "/api/explain": return {"POST"}
        if path in {"/api/explain/config", "/api/explain/widget.js"}: return {"GET"}
        if path == "/api/explain/callback": return {"POST"}
        if re.fullmatch(r"/api/explain/requests/exp_[0-9a-f]{32}", path): return {"GET", "DELETE"}
        if self.run:
            if path == "/api/explain/__e2e/fixtures": return {"POST"}
            if path == "/api/explain/__e2e/status": return {"GET"}
            if re.fullmatch(r"/api/explain/__e2e/runs/e2e_[0-9a-f]{32}", path): return {"GET", "DELETE"}
        return set()

    def forward(self, method: str, path: str, body: bytes = b"",
                headers: Mapping[str, str] | Iterable[tuple[str, str]] = (),
                authorize: Callable[[], bool] | None = None) -> ExplanationResponse:
        if not isinstance(method, str) or not isinstance(path, str) or not isinstance(body, bytes): return _error(400)
        methods = self._methods(path)
        if not methods: return _error(404)
        if method not in methods: return _error(405)
        if len(body) > MAX_BODY: return _error(413)
        incoming = {}
        for key, value in headers.items() if isinstance(headers, Mapping) else headers:
            if not isinstance(key, str): return _error(400)
            name = key.lower()
            if name not in _FORWARDED: continue
            if name in incoming or not isinstance(value, str) or len(value) > 8192: return _error(403)
            incoming[name] = value
        callback = path == "/api/explain/callback"
        if path != "/api/explain/widget.js":
            try:
                scope = verify_e2e_headers(self.app_id, incoming, self.secret)
            except ValueError:
                return _error(403)
            if not (callback and self.run and scope is None) and scope != self.run: return _error(403)
        user_data = path == "/api/explain" or path.startswith("/api/explain/requests/")
        if user_data and self.run is None and authorize is not None and authorize() is not True:
            return _error(401)
        if self.broker_url is None: return _error(503)
        outgoing = {key: value for key, value in incoming.items() if key in _FORWARDED}
        outgoing["X-Aviation-Application"] = self.app_id
        request = Request(self.broker_url + path, method=method, headers=outgoing,
                          data=body if method == "POST" else None)
        try:
            try:
                response = self.opener.open(request, timeout=15)
            except HTTPError as error:
                response = error
            with response:
                if response.status < 200 or 300 <= response.status < 400: return _error(503)
                if response.headers.get("X-Aviation-Application") != self.app_id: return _error(503)
                if response.headers.get("X-Aviation-Test-Run") != self.run: return _error(503)
                payload = response.read(MAX_BODY + 1)
                if len(payload) > MAX_BODY: return _error(503)
                content_type = response.headers.get("Content-Type", "application/json")
                return ExplanationResponse(response.status, payload, {
                    "Content-Type": content_type, "Cache-Control": "no-store",
                    "X-Content-Type-Options": "nosniff", "X-Aviation-Application": self.app_id,
                })
        except (URLError, TimeoutError, OSError, ValueError):
            return _error(503)


def create_explanation_blueprint(app_id: str, *, broker_url: str | None = None,
                                 environment: Mapping[str, str] | None = None,
                                 authorize: Callable[[], bool] | None = None):
    """Flask binding; each worker forwards to the same application-owned broker."""
    from flask import Blueprint, Response, request
    proxy = ExplanationProxy(app_id, broker_url, environment)
    blueprint = Blueprint("aviation_explanation", __name__)

    @blueprint.route("/api/explain", methods=["POST"])
    @blueprint.route("/api/explain/<path:suffix>", methods=["GET", "POST", "DELETE"])
    def forward(suffix=""):
        result = proxy.forward(request.method, request.path, request.stream.read(MAX_BODY + 1),
                               request.headers.items(), authorize)
        return Response(result.body, status=result.status, headers=dict(result.headers))
    return blueprint


def create_explanation_router(app_id: str, *, broker_url: str | None = None,
                              environment: Mapping[str, str] | None = None,
                              authorize: Callable[[], bool] | None = None):
    """FastAPI binding with bounded body reads and blocking I/O outside the event loop."""
    from fastapi import APIRouter, Request, Response
    from starlette.concurrency import run_in_threadpool
    proxy = ExplanationProxy(app_id, broker_url, environment)
    router = APIRouter(tags=["AI explanations"])

    async def forward(request: Request):
        raw = bytearray()
        async for chunk in request.stream():
            if len(raw) + len(chunk) > MAX_BODY:
                error = _error(413)
                return Response(error.body, status_code=error.status, headers=dict(error.headers))
            raw.extend(chunk)
        result = await run_in_threadpool(proxy.forward, request.method, request.url.path,
                                         bytes(raw), request.headers.items(), authorize)
        return Response(result.body, status_code=result.status, headers=dict(result.headers))

    async def request_forward(request: Request, request_id: str):
        return await forward(request)

    async def run_forward(request: Request, run_id: str):
        return await forward(request)

    for path, methods in [
        ("/api/explain", ["POST"]), ("/api/explain/config", ["GET"]),
        ("/api/explain/widget.js", ["GET"]), ("/api/explain/callback", ["POST"]),
        ("/api/explain/requests/{request_id}", ["GET", "DELETE"]),
    ]:
        for method in methods:
            router.add_api_route(path, request_forward if "{request_id}" in path else forward,
                                 methods=[method], name=method.lower() + "_" + path,
                                 status_code=202 if path == "/api/explain" else 200)
    if proxy.run:
        for path, methods in [("/api/explain/__e2e/fixtures", ["POST"]),
                              ("/api/explain/__e2e/status", ["GET"]),
                              ("/api/explain/__e2e/runs/{run_id}", ["GET", "DELETE"])]:
            for method in methods:
                router.add_api_route(path, run_forward if "{run_id}" in path else forward,
                                     methods=[method], name=method.lower() + "_" + path)
    return router
