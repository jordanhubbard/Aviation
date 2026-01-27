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
            await websocket.send_json(
                {"type": "ack", "status": "updated", "targets": simulator.targets.to_dict()}
            )
    except WebSocketDisconnect:
        return


def _coerce_float(value: object) -> float | None:
    if isinstance(value, (int, float)):
        return float(value)
    return None
