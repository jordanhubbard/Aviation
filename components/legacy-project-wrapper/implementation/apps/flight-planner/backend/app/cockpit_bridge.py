"""Explicitly launched local receiver service; importing it opens no sockets."""

from __future__ import annotations

import argparse
from contextlib import asynccontextmanager
import ipaddress
import os
import secrets
from typing import Annotated, Literal
from urllib.parse import urlsplit

from aviation_avionics.gdl90_reports import Gdl90Report
from fastapi import Depends, FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from pydantic import AwareDatetime, BaseModel, Field

from .services.cockpit_bridge import ReceiverBridge, ReceiverSettings, ReceiverState


class ReportEnvelope(BaseModel):
    source_id: str
    received_at: AwareDatetime
    age_seconds: float = Field(ge=0, allow_inf_nan=False)
    live: bool
    stale: bool
    gps_fix_valid: bool | None = None
    report: Annotated[Gdl90Report, Field(discriminator="kind")]


class SenderState(BaseModel):
    source_id: str
    connected: bool
    heartbeat: ReportEnvelope | None
    ownship: ReportEnvelope | None
    geometric_altitude: ReportEnvelope | None


class Capabilities(BaseModel):
    heartbeat: bool
    ownship: bool
    traffic: bool
    geometric_altitude: bool
    weather_decoding: bool


class BridgeStatus(BaseModel):
    source: Literal["local-udp-gdl90"]
    session: int
    listening: bool
    udp_bind: str
    udp_port: int | None
    connected: bool
    counters: dict[str, int]
    decode_errors: dict[str, int]
    capabilities: Capabilities
    limitations: list[str]


class BridgeSnapshot(BridgeStatus):
    receivers: list[SenderState] = Field(max_length=8)
    traffic: list[ReportEnvelope] = Field(max_length=500)
    recent_reports: list[ReportEnvelope] = Field(max_length=128)


class BridgeError(BaseModel):
    detail: str


def valid_origin(value):
    url = urlsplit(value)
    try:
        port = url.port
    except ValueError as error:
        raise ValueError("Bridge origins must be explicit HTTP(S) origins") from error
    if (
        url.scheme not in {"http", "https"}
        or not url.hostname
        or url.username
        or url.password
        or url.path
        or url.query
        or url.fragment
        or "*" in value
        or port == 0
    ):
        raise ValueError("Bridge origins must be explicit HTTP(S) origins")
    return value


def create_bridge_app(bridge: ReceiverBridge, *, token: str, origins=(), start=False):
    if not isinstance(token, str) or len(token) < 32:
        raise ValueError("AVIATION_COCKPIT_TOKEN must contain at least 32 characters")
    allowed = tuple(valid_origin(value) for value in origins)

    @asynccontextmanager
    async def lifespan(_app):
        try:
            if start:
                await bridge.start()
            yield
        finally:
            await bridge.stop()

    app = FastAPI(
        title="Aviation local cockpit bridge",
        version="1.0.0",
        openapi_url="/api/openapi.json",
        lifespan=lifespan,
        responses={401: {"model": BridgeError}, 403: {"model": BridgeError}},
    )
    app.state.receiver_bridge = bridge
    app.add_middleware(
        CORSMiddleware,
        allow_origins=list(allowed),
        allow_methods=["GET", "POST"],
        allow_headers=["Authorization", "Content-Type"],
    )

    @app.middleware("http")
    async def check_origin(request: Request, call_next):
        origin = request.headers.get("origin")
        if origin is not None and origin not in allowed:
            return JSONResponse({"detail": "Bridge origin is not allowed"}, status_code=403)
        response = await call_next(request)
        response.headers["Cache-Control"] = "private, no-store"
        response.headers["X-Content-Type-Options"] = "nosniff"
        return response

    bearer = HTTPBearer(auto_error=False)

    def operator(credentials: HTTPAuthorizationCredentials | None = Depends(bearer)):
        if (
            credentials is None
            or credentials.scheme.lower() != "bearer"
            or not secrets.compare_digest(credentials.credentials.encode(), token.encode())
        ):
            raise HTTPException(
                401,
                "Bridge operator credential required",
                headers={"WWW-Authenticate": "Bearer"},
            )

    authorization = [Depends(operator)]

    @app.get(
        "/api/cockpit/status",
        response_model=BridgeStatus,
        dependencies=authorization,
        operation_id="cockpit_status",
    )
    def status():
        return bridge.state.snapshot(include_reports=False)

    @app.get(
        "/api/cockpit/state",
        response_model=BridgeSnapshot,
        dependencies=authorization,
        operation_id="cockpit_state",
    )
    def state():
        return bridge.state.snapshot()

    @app.post(
        "/api/cockpit/start",
        response_model=BridgeStatus,
        dependencies=authorization,
        operation_id="cockpit_start",
        responses={503: {"model": BridgeError}},
    )
    async def begin():
        try:
            return await bridge.start()
        except TimeoutError as error:
            raise HTTPException(503, "Previous receiver shutdown has not completed") from error
        except OSError as error:
            raise HTTPException(503, "Cannot bind the configured receiver UDP listener") from error

    @app.post(
        "/api/cockpit/stop",
        response_model=BridgeStatus,
        dependencies=authorization,
        operation_id="cockpit_stop",
        responses={503: {"model": BridgeError}},
    )
    async def end():
        try:
            return await bridge.stop()
        except TimeoutError as error:
            raise HTTPException(503, "Receiver UDP shutdown has not completed") from error

    return app


def main(argv=None):
    parser = argparse.ArgumentParser(description="Explicit local GDL90 receiver bridge")
    parser.add_argument("--udp-bind", default="0.0.0.0")
    parser.add_argument("--udp-port", type=int, default=4000)
    parser.add_argument(
        "--source",
        action="append",
        required=True,
        help="Allowed receiver IP or CIDR; repeatable",
    )
    parser.add_argument("--http-bind", default="127.0.0.1")
    parser.add_argument("--http-port", type=int, default=18190)
    parser.add_argument("--allow-origin", action="append", default=[])
    parser.add_argument("--tls-cert")
    parser.add_argument("--tls-key")
    parser.add_argument(
        "--start",
        action="store_true",
        help="Explicitly start the UDP listener on process launch",
    )
    args = parser.parse_args(argv)
    try:
        ipaddress.ip_address(args.http_bind)
        if not 1 <= args.http_port <= 65535:
            raise ValueError("HTTP port must be between 1 and 65535")
        if bool(args.tls_cert) != bool(args.tls_key):
            raise ValueError("TLS certificate and key must be configured together")
        settings = ReceiverSettings(args.udp_bind, args.udp_port, tuple(args.source))
        app = create_bridge_app(
            ReceiverBridge(ReceiverState(settings)),
            token=os.environ.get("AVIATION_COCKPIT_TOKEN", ""),
            origins=args.allow_origin,
            start=args.start,
        )
    except ValueError as error:
        parser.error(str(error))
    import uvicorn

    uvicorn.run(
        app,
        host=args.http_bind,
        port=args.http_port,
        ssl_certfile=args.tls_cert,
        ssl_keyfile=args.tls_key,
    )


if __name__ == "__main__":
    main()
