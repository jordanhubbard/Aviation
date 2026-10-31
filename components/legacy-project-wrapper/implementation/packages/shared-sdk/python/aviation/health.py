"""Provider-neutral service-health report semantics."""

from __future__ import annotations

from collections.abc import Mapping
from typing import Any


class HealthReportError(ValueError):
    """Stable fail-closed error emitted by portable health operations."""

    def __init__(self, code: str, message: str) -> None:
        super().__init__(message)
        self.code = code


_STATUS_ALIASES = {
    "ok": "ok",
    "healthy": "ok",
    "up": "ok",
    "degraded": "degraded",
    "warning": "degraded",
    "unavailable": "unavailable",
    "unhealthy": "unavailable",
    "down": "unavailable",
}


def normalize_health_status(status: object) -> str:
    """Normalize a canonical health status or supported application alias."""

    value = status.strip().lower() if isinstance(status, str) else ""
    normalized = _STATUS_ALIASES.get(value)
    if normalized is None:
        raise HealthReportError(
            "health-status-invalid", f"unsupported health status: {status}"
        )
    return normalized


def create_health_report(
    *,
    status: str = "ok",
    service: str | None = None,
    details: Mapping[str, Any] | None = None,
) -> dict[str, Any]:
    """Build a common report while preserving adapter-owned detail fields."""

    normalized = normalize_health_status(status)
    detail_values = details or {}
    if "status" in detail_values or "service" in detail_values:
        raise HealthReportError(
            "health-details-invalid",
            "health report details must not replace reserved fields",
        )
    if service is not None:
        if not isinstance(service, str) or not service.strip():
            raise HealthReportError(
                "health-service-invalid", "service must be a non-empty string"
            )
        service = service.strip()

    report: dict[str, Any] = {"status": normalized}
    if service is not None:
        report["service"] = service
    report.update(detail_values)
    return report
