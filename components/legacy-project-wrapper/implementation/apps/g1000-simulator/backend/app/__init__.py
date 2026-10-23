from __future__ import annotations

from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

from app.config import Settings
from app.routers import health, settings, telemetry


def create_app(config: Settings) -> FastAPI:
    """Application factory that wires up middleware and routers."""
    app = FastAPI(
        title=config.app_name,
        version=config.app_version,
        debug=config.debug,
    )

    app.add_middleware(
        CORSMiddleware,
        allow_origins=config.cors_origins,
        allow_credentials=True,
        allow_methods=config.cors_methods,
        allow_headers=config.cors_headers,
    )

    app.include_router(health.router, prefix=config.api_prefix)
    app.include_router(settings.router)
    app.include_router(telemetry.router)

    static_root = Path(__file__).resolve().parents[1] / "static"
    if (static_root / "index.html").is_file():
        @app.get("/settings", include_in_schema=False)
        def settings_page() -> FileResponse:
            return FileResponse(static_root / "index.html")

        app.mount("/", StaticFiles(directory=static_root, html=True), name="frontend")

    return app
