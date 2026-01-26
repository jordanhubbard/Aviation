from __future__ import annotations

from pathlib import Path

from fastapi import FastAPI, Response
from fastapi.middleware.cors import CORSMiddleware
from starlette.staticfiles import StaticFiles

from app.config import Settings
from app.routers import health, telemetry


class SPAStaticFiles(StaticFiles):
    async def get_response(self, path: str, scope):
        if path == "api" or path.startswith("api/") or path == "ws" or path.startswith("ws/"):
            return Response("Not Found", status_code=404, media_type="text/plain")

        response = await super().get_response(path, scope)
        if response.status_code == 404:
            return await super().get_response("index.html", scope)
        return response


def create_app(settings: Settings) -> FastAPI:
    app = FastAPI(
        title=settings.app_name,
        version=settings.app_version,
        debug=settings.debug,
    )

    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        allow_credentials=True,
        allow_methods=settings.cors_methods,
        allow_headers=settings.cors_headers,
    )

    app.include_router(health.router, prefix=settings.api_prefix, tags=["health"])
    app.include_router(telemetry.router, tags=["websocket"])

    @app.get("/health", include_in_schema=False)
    def root_health() -> dict:
        return {"status": "ok"}

    static_dir = Path(__file__).resolve().parents[1] / "static"
    if static_dir.exists():
        app.mount("/", SPAStaticFiles(directory=static_dir, html=True), name="spa")

    return app
