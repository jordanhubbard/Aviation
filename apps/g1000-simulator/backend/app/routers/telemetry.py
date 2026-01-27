from __future__ import annotations

import asyncio
from contextlib import suppress

from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from app.services import FlightDynamicsSimulator


router = APIRouter()
simulator = FlightDynamicsSimulator()


async def stream_telemetry(websocket: WebSocket) -> None:
    try:
        while True:
            payload = simulator.step()
            await websocket.send_json({"type": "telemetry", "payload": payload})
            await asyncio.sleep(0.5)
    except (WebSocketDisconnect, RuntimeError):
        return


@router.websocket("/ws/telemetry")
async def telemetry_socket(websocket: WebSocket) -> None:
    await websocket.accept()
    await websocket.send_json({"type": "telemetry", "status": "connected"})

    stream_task = asyncio.create_task(stream_telemetry(websocket))

    try:
        while True:
            message = await websocket.receive_json()
            if message.get("type") == "ping":
                await websocket.send_json({"type": "pong"})
            if message.get("type") == "request":
                await websocket.send_json({"type": "telemetry", "payload": simulator.snapshot()})
    except WebSocketDisconnect:
        stream_task.cancel()
        with suppress(asyncio.CancelledError):
            await stream_task
        return


@router.websocket("/ws/commands")
async def command_socket(websocket: WebSocket) -> None:
    await websocket.accept()
    await websocket.send_json({"type": "commands", "status": "connected"})

    try:
        while True:
            message = await websocket.receive_json()
            if message.get("type") == "reset":
                simulator.reset()
            if message.get("type") == "set_targets":
                targets = message.get("targets", {})
                if isinstance(targets, dict):
                    simulator.set_targets(
                        heading_deg=_coerce_float(targets.get("heading_deg")),
                        altitude_ft=_coerce_float(targets.get("altitude_ft")),
                        airspeed_kt=_coerce_float(targets.get("airspeed_kt")),
                    )
            if message.get("type") == "set_adf":
                frequency_khz = _coerce_float(message.get("frequency_khz"))
                simulator.set_adf_frequency(frequency_khz)
            if message.get("type") == "set_dme":
                frequency_mhz = _coerce_float(message.get("frequency_mhz"))
                simulator.set_dme_frequency(frequency_mhz)
            if message.get("type") == "set_autopilot":
                simulator.set_autopilot(
                    master_on=_coerce_bool(message.get("master_on")),
                    lateral_mode=_coerce_str(message.get("lateral_mode")),
                    vertical_mode=_coerce_str(message.get("vertical_mode")),
                    target_vertical_speed_fpm=_coerce_float(
                        message.get("target_vertical_speed_fpm")
                    ),
                )
            if message.get("type") == "set_audio_panel":
                simulator.set_audio_panel(
                    com1_enabled=_coerce_bool(message.get("com1_enabled")),
                    com2_enabled=_coerce_bool(message.get("com2_enabled")),
                    nav1_enabled=_coerce_bool(message.get("nav1_enabled")),
                    nav2_enabled=_coerce_bool(message.get("nav2_enabled")),
                    adf_enabled=_coerce_bool(message.get("adf_enabled")),
                    marker_enabled=_coerce_bool(message.get("marker_enabled")),
                    speaker_enabled=_coerce_bool(message.get("speaker_enabled")),
                    headphone_enabled=_coerce_bool(message.get("headphone_enabled")),
                    com1_volume=_coerce_float(message.get("com1_volume")),
                    com2_volume=_coerce_float(message.get("com2_volume")),
                    nav1_volume=_coerce_float(message.get("nav1_volume")),
                    nav2_volume=_coerce_float(message.get("nav2_volume")),
                    adf_volume=_coerce_float(message.get("adf_volume")),
                    marker_volume=_coerce_float(message.get("marker_volume")),
                )
            if message.get("type") == "set_transponder":
                simulator.set_transponder(
                    mode=_coerce_str(message.get("mode")),
                    squawk_code=message.get("squawk_code"),
                    ident=_coerce_bool(message.get("ident")),
                )
            await websocket.send_json(
                {
                    "type": "ack",
                    "status": "updated",
                    "targets": simulator.targets.to_dict(),
                    "autopilot": simulator.autopilot.to_dict(),
                    "audio_panel": simulator.audio_panel.to_dict(),
                    "transponder": simulator.transponder.to_dict(),
                }
            )
    except WebSocketDisconnect:
        return


def _coerce_float(value: object) -> float | None:
    if isinstance(value, (int, float)):
        return float(value)
    return None


def _coerce_bool(value: object) -> bool | None:
    if isinstance(value, bool):
        return value
    return None


def _coerce_str(value: object) -> str | None:
    if isinstance(value, str):
        return value
    return None
