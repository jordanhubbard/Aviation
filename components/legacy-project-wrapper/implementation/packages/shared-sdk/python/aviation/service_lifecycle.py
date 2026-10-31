"""Provider-neutral background-service lifecycle transitions."""

from __future__ import annotations

from typing import Literal

ServiceLifecycleState = Literal[
    "stopped", "starting", "running", "stopping", "failed"
]
ServiceLifecycleEvent = Literal[
    "start_requested",
    "start_succeeded",
    "start_failed",
    "stop_requested",
    "stop_succeeded",
    "stop_failed",
    "reset",
]


class ServiceLifecycleError(ValueError):
    """Stable fail-closed error emitted for an invalid lifecycle transition."""

    def __init__(self, code: str, message: str) -> None:
        super().__init__(message)
        self.code = code


_TRANSITIONS: dict[tuple[str, str], ServiceLifecycleState] = {
    ("stopped", "start_requested"): "starting",
    ("starting", "start_succeeded"): "running",
    ("starting", "start_failed"): "failed",
    ("running", "stop_requested"): "stopping",
    ("stopping", "stop_succeeded"): "stopped",
    ("stopping", "stop_failed"): "failed",
    ("failed", "reset"): "stopped",
}


def transition_service_lifecycle(
    state: ServiceLifecycleState, event: ServiceLifecycleEvent
) -> ServiceLifecycleState:
    """Return the next lifecycle state, rejecting every unowned transition."""

    next_state = _TRANSITIONS.get((state, event))
    if next_state is None:
        raise ServiceLifecycleError(
            "service-lifecycle-transition-invalid",
            f"cannot apply {event} while service is {state}",
        )
    return next_state
