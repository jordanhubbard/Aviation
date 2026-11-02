"""Optional FastAPI adapter around the common configuration/keystore providers."""
from __future__ import annotations

import hmac
import json

from fastapi import APIRouter, HTTPException, Request
from starlette.concurrency import run_in_threadpool

from aviation.e2e import verify_e2e_headers, assert_test_record_for_run
from .loader import AviationConfig


def create_settings_router(config: AviationConfig, *, write_token: str | None = None,
                           encryption_ready: bool = False,
                           e2e_secret: str | None = None) -> APIRouter:
    """Default to read-only; a signed private run never selects production storage."""
    isolated = config.isolated_run
    token = write_token if isinstance(write_token, str) and len(write_token) >= 32 else None
    ready = encryption_ready and config.writes_available
    enabled = ready and (isolated is not None or token is not None)
    if isolated is not None and (not ready or not e2e_secret or len(e2e_secret) < 32):
        raise ValueError("Isolated settings require a configured private provider")
    router = APIRouter()

    async def json_body(request: Request):
        raw = bytearray()
        async for chunk in request.stream():
            if len(raw) + len(chunk) > 65536:
                raise HTTPException(400, "Invalid settings request")
            raw.extend(chunk)
        try:
            return json.loads(raw)
        except ValueError:
            raise HTTPException(400, "Invalid settings request") from None

    def authorize(request: Request, *, write: bool = False) -> None:
        try:
            run_id = verify_e2e_headers(config.app_id, request.headers, e2e_secret)
        except ValueError:
            raise HTTPException(403, "Invalid test credential") from None
        if (isolated is not None and run_id != isolated) or (isolated is None and run_id is not None):
            raise HTTPException(403, "Invalid test credential")
        if write:
            if not enabled:
                raise HTTPException(503, "Settings changes are disabled")
            if isolated is None and not hmac.compare_digest(
                request.headers.get("authorization", "").encode(), f"Bearer {token}".encode()
            ):
                raise HTTPException(401, "Settings access was not authorized")

    @router.get("/api/settings")
    async def get_settings(request: Request) -> dict:
        authorize(request)
        try:
            services = await run_in_threadpool(config.get_service_status)
        except Exception:
            raise HTTPException(503, "Settings could not be loaded") from None
        return {"app_id": config.app_id,
                "services": services,
                "write_access": {"enabled": enabled, "requires_token": enabled and isolated is None}}

    @router.post("/api/settings/secrets")
    async def save_secret(request: Request) -> dict:
        authorize(request, write=True)
        body = await json_body(request)
        try:
            if not isinstance(body, dict) or any(not isinstance(body.get(k), str)
                                                for k in ("service", "key", "value")):
                raise ValueError()
            await run_in_threadpool(config.set, body["service"], body["key"], body["value"])
        except ValueError:
            raise HTTPException(400, "Invalid settings request") from None
        except Exception:
            raise HTTPException(503, "Settings could not be saved") from None
        return {"success": True, "service": body["service"], "key": body["key"]}

    @router.delete("/api/settings/secrets/{service}/{key}")
    async def delete_secret(service: str, key: str, request: Request) -> dict:
        authorize(request, write=True)
        try:
            deleted = await run_in_threadpool(config.delete, service, key)
        except ValueError:
            raise HTTPException(400, "Invalid settings request") from None
        except Exception:
            raise HTTPException(503, "Settings could not be deleted") from None
        return {"success": True, "service": service, "key": key, "deleted": deleted}

    if isolated is not None:
        @router.post("/__e2e/fixtures")
        async def seed_fixture(request: Request) -> dict:
            authorize(request, write=True)
            body = await json_body(request)
            try:
                if not isinstance(body, dict) or body.get("fixture_type") != "settings":
                    raise ValueError()
                assert_test_record_for_run(body.get("record"), isolated)
            except ValueError:
                raise HTTPException(400, "Invalid settings fixture") from None
            try:
                await run_in_threadpool(config.initialize_test_run)
                return await run_in_threadpool(config.test_run_state)
            except Exception:
                raise HTTPException(503, "Settings fixture could not be initialized") from None

        @router.get("/__e2e/status")
        @router.get("/__e2e/runs/{run_id}")
        async def run_status(request: Request, run_id: str | None = None) -> dict:
            authorize(request)
            if run_id is not None and run_id != isolated:
                raise HTTPException(403, "Invalid test run")
            try:
                return await run_in_threadpool(config.test_run_state)
            except Exception:
                raise HTTPException(503, "Settings run could not be inspected") from None

        @router.delete("/__e2e/runs/{run_id}")
        async def cleanup_run(run_id: str, request: Request) -> dict:
            authorize(request, write=True)
            if run_id != isolated:
                raise HTTPException(403, "Invalid test run")
            try:
                return await run_in_threadpool(config.cleanup_test_run)
            except Exception:
                raise HTTPException(503, "Settings run could not be cleaned") from None

    return router
