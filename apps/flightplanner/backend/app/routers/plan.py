from __future__ import annotations

import asyncio
import json
import threading
import time
from typing import AsyncIterator
from typing import Annotated, Any, Literal, Union

from fastapi import APIRouter, HTTPException, Request
from pydantic import Field
from starlette.responses import StreamingResponse

from app.routers import local, route
from app.schemas.local import LocalPlanRequest
from app.schemas.route import RouteRequest
from app.services.planning_runtime import (
    PlanningCancelled,
    PlanningCapacityError,
    PlanningContext,
    PlanningTimeout,
    planning_capacity,
    planning_total_timeout_s,
)


router = APIRouter()


class PlanRouteRequest(RouteRequest):
    mode: Literal["route"] = "route"


class PlanLocalRequest(LocalPlanRequest):
    mode: Literal["local"] = "local"


PlanRequest = Annotated[Union[PlanRouteRequest, PlanLocalRequest], Field(discriminator="mode")]


@router.post(
    "/plan",
    summary="Plan a flight (route or local)",
    description="Uses a discriminated union request body with `mode` set to `route` or `local`.",
    openapi_extra={
        "requestBody": {
            "content": {
                "application/json": {
                    "examples": {
                        "route": {
                            "summary": "Route planning",
                            "value": {
                                "mode": "route",
                                "origin": "KSFO",
                                "destination": "KLAX",
                                "speed": 110,
                                "speed_unit": "knots",
                                "altitude": 5500,
                                "avoid_airspaces": False,
                                "avoid_terrain": False,
                                "apply_wind": True,
                            },
                        },
                        "local": {
                            "summary": "Local planning",
                            "value": {
                                "mode": "local",
                                "airport": "KSFO",
                                "radius_nm": 25,
                            },
                        },
                    }
                }
            }
        }
    },
)
def plan(req: PlanRequest) -> Any:
    if req.mode == "route":
        ctx = PlanningContext(deadline_s=time.perf_counter() + planning_total_timeout_s())
        try:
            with planning_capacity():
                return route.calculate_route_internal(req, ctx=ctx)
        except PlanningCapacityError as e:
            raise HTTPException(status_code=503, detail=str(e))
        except PlanningTimeout as e:
            raise HTTPException(status_code=504, detail=str(e))

    return local.local_plan(req)


def _sse(event: str, data: Any) -> bytes:
    payload = json.dumps(data, separators=(",", ":"), ensure_ascii=False)
    return f"event: {event}\ndata: {payload}\n\n".encode("utf-8")


@router.post(
    "/plan/stream",
    summary="Stream flight planning progress",
    description="Streams progress events and partial route results as Server-Sent Events (SSE).",
)
async def plan_stream(req: PlanRequest, request: Request) -> StreamingResponse:
    async def event_generator() -> AsyncIterator[bytes]:
        loop = asyncio.get_running_loop()
        queue: asyncio.Queue[dict[str, Any]] = asyncio.Queue()
        cancel_event = threading.Event()

        def on_event(ev: dict[str, Any]) -> None:
            loop.call_soon_threadsafe(queue.put_nowait, ev)

        ctx = PlanningContext(
            on_event=on_event,
            cancel_event=cancel_event,
            deadline_s=time.perf_counter() + planning_total_timeout_s(),
        )

        def worker() -> None:
            try:
                with planning_capacity(cancel_event=cancel_event):
                    if req.mode == "route":
                        plan_obj = route.calculate_route_internal(req, ctx=ctx)
                        plan_payload = plan_obj.model_dump(mode="json")
                    else:
                        plan_payload = local.local_plan(req).model_dump(mode="json")
                on_event({"type": "done", "plan": plan_payload})
            except PlanningCapacityError as e:
                on_event({"type": "error", "status_code": 503, "detail": str(e)})
            except PlanningTimeout as e:
                on_event({"type": "error", "status_code": 504, "detail": str(e)})
            except PlanningCancelled:
                on_event({"type": "cancelled"})
            except HTTPException as e:
                on_event({"type": "error", "status_code": e.status_code, "detail": e.detail})
            except Exception as e:
                on_event({"type": "error", "status_code": 500, "detail": str(e)})

        task = asyncio.create_task(asyncio.to_thread(worker))

        # Kick off the stream immediately so the UI can show a progress state.
        yield _sse("progress", {"phase": "queued", "message": "Queued", "percent": 0.0})

        try:
            while True:
                if await request.is_disconnected():
                    cancel_event.set()
                    break

                try:
                    ev = await asyncio.wait_for(queue.get(), timeout=15.0)
                except TimeoutError:
                    yield b": keep-alive\n\n"
                    continue

                typ = ev.get("type")
                if typ == "progress":
                    yield _sse(
                        "progress",
                        {
                            "phase": ev.get("phase"),
                            "message": ev.get("message"),
                            "percent": ev.get("percent"),
                        },
                    )
                elif typ == "partial_plan":
                    yield _sse("partial_plan", {"phase": ev.get("phase"), "plan": ev.get("plan")})
                elif typ == "done":
                    yield _sse("done", {"plan": ev.get("plan")})
                    break
                elif typ == "cancelled":
                    yield _sse("cancelled", {"detail": "cancelled"})
                    break
                elif typ == "error":
                    yield _sse(
                        "error",
                        {"status_code": ev.get("status_code"), "detail": ev.get("detail")},
                    )
                    break
        finally:
            cancel_event.set()
            task.cancel()

    return StreamingResponse(event_generator(), media_type="text/event-stream")
