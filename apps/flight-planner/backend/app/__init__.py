from __future__ import annotations

from contextlib import asynccontextmanager
import json
import logging
import os
from pathlib import Path

from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
from fastapi.responses import Response
from fastapi.middleware.cors import CORSMiddleware
from slowapi import Limiter
from slowapi.errors import RateLimitExceeded
from slowapi.extension import _rate_limit_exceeded_handler
from slowapi.middleware import SlowAPIMiddleware
from slowapi.util import get_remote_address
from starlette.staticfiles import StaticFiles

from app.config import Settings
from app.openapi import APP_DESCRIPTION, OPENAPI_TAGS
from app.routers import (
    airspace,
    airports,
    beads,
    health,
    local,
    meta,
    plan,
    route,
    terrain,
    weather,
)
from app.services.beads_reporter import (
    beads_issue_creator,
    maybe_install_log_handler,
    report_unhandled_exception,
)
from app.startup_checks import collect_startup_config_issues


logger = logging.getLogger(__name__)


class SPAStaticFiles(StaticFiles):
    async def get_response(self, path: str, scope):
        if path == "api" or path.startswith("api/"):
            return Response("Not Found", status_code=404, media_type="text/plain")

        response = await super().get_response(path, scope)
        if response.status_code == 404:
            return await super().get_response("index.html", scope)
        return response


def create_app(settings: Settings) -> FastAPI:
    if settings.openweather_api_key and not (
        os.environ.get("OPENWEATHERMAP_API_KEY") or os.environ.get("OPENWEATHER_API_KEY")
    ):
        os.environ.setdefault("OPENWEATHERMAP_API_KEY", settings.openweather_api_key)

    if settings.opentopography_api_key and not os.environ.get("OPENTOPOGRAPHY_API_KEY"):
        os.environ.setdefault("OPENTOPOGRAPHY_API_KEY", settings.opentopography_api_key)

    @asynccontextmanager
    async def lifespan(app: FastAPI):
        issues = collect_startup_config_issues()
        app.state.startup_config_issues = issues

        maybe_install_log_handler()

        for issue in issues:
            missing = ", ".join(issue.get("missing") or [])
            feature = issue.get("feature") or "unknown feature"
            logger.warning("Startup config: missing %s (%s)", missing, feature)
            for step in issue.get("remediation") or []:
                logger.warning("  - %s", step)
        yield

    app = FastAPI(
        title=settings.app_name,
        version=settings.app_version,
        description=APP_DESCRIPTION,
        openapi_tags=OPENAPI_TAGS,
        debug=settings.debug,
        lifespan=lifespan,
    )

    limiter = Limiter(key_func=get_remote_address, default_limits=["1000/minute"])
    app.state.limiter = limiter
    app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)
    app.add_middleware(SlowAPIMiddleware)

    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        allow_credentials=True,
        allow_methods=settings.cors_methods,
        allow_headers=settings.cors_headers,
    )

    app.include_router(health.router, prefix=settings.api_prefix, tags=["health"])

    @app.get("/health", include_in_schema=False)
    def root_health(request: Request) -> dict:
        return health.health(request)

    app.include_router(beads.router, prefix=settings.api_prefix, tags=["beads"])
    app.include_router(plan.router, prefix=settings.api_prefix, tags=["plan"])
    app.include_router(airports.router, prefix=settings.api_prefix, tags=["airports"])
    app.include_router(weather.router, prefix=settings.api_prefix, tags=["weather"])
    app.include_router(route.router, prefix=settings.api_prefix, tags=["route"])
    app.include_router(local.router, prefix=settings.api_prefix, tags=["local"])
    app.include_router(airspace.router, prefix=settings.api_prefix, tags=["airspace"])
    app.include_router(terrain.router, prefix=settings.api_prefix, tags=["terrain"])
    app.include_router(meta.router, prefix=settings.api_prefix, tags=["meta"])

    @app.exception_handler(Exception)
    async def unhandled_exception_handler(request: Request, exc: Exception):
        report_unhandled_exception(
            where="exception_handler",
            exc=exc,
            context={
                "method": request.method,
                "path": str(request.url.path),
                "query": str(request.url.query),
            },
        )
        if settings.debug:
            return JSONResponse(status_code=500, content={"detail": str(exc)})
        return JSONResponse(status_code=500, content={"detail": "Internal server error"})

    static_dir = Path(__file__).resolve().parents[1] / "static"
    if static_dir.exists():

        @app.get("/env.js", include_in_schema=False)
        def env_js() -> Response:
            key = (
                os.environ.get("VITE_OPENWEATHERMAP_API_KEY")
                or os.environ.get("OPENWEATHERMAP_API_KEY")
                or ""
            )
            payload = {}
            if key:
                payload["VITE_OPENWEATHERMAP_API_KEY"] = key
            repo_url = os.environ.get("VITE_REPO_URL") or os.environ.get("REPO_URL") or ""
            if repo_url:
                payload["VITE_REPO_URL"] = repo_url
            git_sha = os.environ.get("VITE_GIT_SHA") or os.environ.get("GIT_SHA") or ""
            if git_sha:
                payload["VITE_GIT_SHA"] = git_sha
            payload["VITE_BEADS_AUTOREPORT"] = "1" if beads_issue_creator.enabled() else "0"
            js = "window.__ENV__ = window.__ENV__ || {};\n"
            for k, v in payload.items():
                js += f"window.__ENV__[{json.dumps(k)}] = {json.dumps(v)};\n"
            return Response(js, media_type="application/javascript")

        app.mount("/", SPAStaticFiles(directory=static_dir, html=True), name="spa")

    return app
