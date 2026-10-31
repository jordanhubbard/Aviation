"""Provider-neutral aviation alert lifecycle semantics."""

from __future__ import annotations

from collections.abc import Iterable, Mapping, Sequence
from typing import TypeVar


CanonicalAlertLevel = str
AlertRecord = TypeVar("AlertRecord", bound=Mapping[str, object])


class AlertLifecycleError(ValueError):
    """Stable fail-closed alert lifecycle error."""

    def __init__(self, code: str, message: str) -> None:
        super().__init__(message)
        self.code = code


_LEVEL_ALIASES: dict[str, CanonicalAlertLevel] = {
    "normal": "normal",
    "ok": "normal",
    "debug": "normal",
    "advisory": "advisory",
    "info": "advisory",
    "caution": "caution",
    "warning": "warning",
    "critical": "warning",
}
_LEVEL_PRIORITY = {"normal": 0, "advisory": 1, "caution": 2, "warning": 3}


def normalize_alert_level(level: object) -> CanonicalAlertLevel:
    """Normalize a canonical level or supported application alias."""

    value = level.strip().lower() if isinstance(level, str) else ""
    try:
        return _LEVEL_ALIASES[value]
    except KeyError as exc:
        raise AlertLifecycleError(
            "alert-level-invalid", f"unsupported alert level: {level}"
        ) from exc


def alert_priority(level: object) -> int:
    """Return the portable ascending priority for a level."""

    return _LEVEL_PRIORITY[normalize_alert_level(level)]


def order_alerts(alerts: Iterable[AlertRecord]) -> list[AlertRecord]:
    """Return a stable lifecycle-ordered copy without mutating input records."""

    values = list(alerts)
    return sorted(
        values,
        key=lambda alert: (
            bool(alert["acknowledged"]),
            -alert_priority(alert["level"]),
        ),
    )


def reconcile_acknowledgements(
    active_ids: Iterable[str], acknowledged_ids: Iterable[str]
) -> list[str]:
    """Retain active acknowledgements once, in first-occurrence order."""

    active = set(active_ids)
    retained: list[str] = []
    seen: set[str] = set()
    for identifier in acknowledged_ids:
        if identifier in active and identifier not in seen:
            retained.append(identifier)
            seen.add(identifier)
    return retained


def highest_alert_level(
    alerts: Sequence[Mapping[str, object]], include_acknowledged: bool = False
) -> CanonicalAlertLevel:
    """Return the highest canonical severity in scope, or normal when empty."""

    highest = "normal"
    highest_priority = _LEVEL_PRIORITY[highest]
    for alert in alerts:
        level = normalize_alert_level(alert["level"])
        if not include_acknowledged and bool(alert["acknowledged"]):
            continue
        priority = _LEVEL_PRIORITY[level]
        if priority > highest_priority:
            highest = level
            highest_priority = priority
    return highest


__all__ = [
    "AlertLifecycleError",
    "CanonicalAlertLevel",
    "alert_priority",
    "highest_alert_level",
    "normalize_alert_level",
    "order_alerts",
    "reconcile_acknowledgements",
]
