from __future__ import annotations

import os
import threading
import time
from contextlib import contextmanager
from dataclasses import dataclass
from typing import Any, Callable, Dict, Iterator, Optional


class PlanningCancelled(RuntimeError):
    pass


class PlanningTimeout(RuntimeError):
    pass


class PlanningCapacityError(RuntimeError):
    pass


StreamEvent = Dict[str, Any]
StreamEventCallback = Callable[[StreamEvent], None]


def _env_float(name: str, default: float) -> float:
    raw = os.environ.get(name)
    if raw is None:
        return default
    try:
        return float(raw)
    except Exception:
        return default


def _env_int(name: str, default: int) -> int:
    raw = os.environ.get(name)
    if raw is None:
        return default
    try:
        return int(raw)
    except Exception:
        return default


@dataclass
class PlanningContext:
    on_event: Optional[StreamEventCallback] = None
    cancel_event: Optional[threading.Event] = None
    deadline_s: Optional[float] = None

    def emit(self, event: StreamEvent) -> None:
        if self.on_event is None:
            return
        self.on_event(event)

    def emit_progress(self, *, phase: str, message: str, percent: Optional[float] = None) -> None:
        self.emit(
            {
                "type": "progress",
                "phase": phase,
                "message": message,
                "percent": percent,
                "ts": time.time(),
            }
        )

    def emit_partial_plan(self, *, phase: str, plan: Any) -> None:
        self.emit(
            {
                "type": "partial_plan",
                "phase": phase,
                "plan": plan,
                "ts": time.time(),
            }
        )

    def check_cancelled(self) -> None:
        if self.cancel_event is not None and self.cancel_event.is_set():
            raise PlanningCancelled("Planning cancelled")

    def check_deadline(self) -> None:
        if self.deadline_s is not None and time.perf_counter() > self.deadline_s:
            raise PlanningTimeout("Planning exceeded server timeout")


_PLANNING_MAX_CONCURRENCY = _env_int("PLANNING_MAX_CONCURRENCY", 4)
_PLANNING_QUEUE_TIMEOUT_S = _env_float("PLANNING_QUEUE_TIMEOUT_S", 0.0)
_PLANNING_SEMAPHORE: Optional[threading.Semaphore]
if _PLANNING_MAX_CONCURRENCY > 0:
    _PLANNING_SEMAPHORE = threading.Semaphore(_PLANNING_MAX_CONCURRENCY)
else:
    _PLANNING_SEMAPHORE = None


@contextmanager
def planning_capacity(*, cancel_event: Optional[threading.Event] = None) -> Iterator[None]:
    if _PLANNING_SEMAPHORE is None:
        yield
        return

    timeout_s = _PLANNING_QUEUE_TIMEOUT_S
    if timeout_s <= 0:
        while True:
            if cancel_event is not None and cancel_event.is_set():
                raise PlanningCancelled("Planning cancelled")
            acquired = _PLANNING_SEMAPHORE.acquire(timeout=0.25)
            if acquired:
                break
    else:
        start = time.perf_counter()
        while True:
            if cancel_event is not None and cancel_event.is_set():
                raise PlanningCancelled("Planning cancelled")
            remaining = timeout_s - (time.perf_counter() - start)
            if remaining <= 0:
                raise PlanningCapacityError("Planner at capacity; try again shortly")
            acquired = _PLANNING_SEMAPHORE.acquire(timeout=min(0.25, remaining))
            if acquired:
                break

    try:
        yield
    finally:
        _PLANNING_SEMAPHORE.release()


def planning_total_timeout_s() -> float:
    return _env_float("PLANNING_TOTAL_TIMEOUT_S", 120.0)


def planning_phase_timeout_s() -> float:
    return _env_float("PLANNING_PHASE_TIMEOUT_S", 30.0)


def planning_external_workers() -> int:
    return max(1, _env_int("PLANNING_EXTERNAL_WORKERS", 4))
