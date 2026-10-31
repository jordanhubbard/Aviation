"""Portable provider-neutral NOTAM record semantics."""

from __future__ import annotations

from dataclasses import dataclass, replace
from datetime import datetime, timezone
import re
from typing import Iterable, Mapping, Sequence


NotamSeverity = str


class NotamValidationError(ValueError):
    """Stable fail-closed normalization error."""

    def __init__(self, code: str, message: str) -> None:
        super().__init__(message)
        self.code = code


@dataclass(frozen=True)
class Notam:
    id: str
    type: str
    location: str
    facility_type: str
    effective_start: datetime
    effective_end: datetime
    classification: str
    text: str
    severity: NotamSeverity
    category: str


def _value(record: Mapping[str, object], camel: str, snake: str | None = None) -> object:
    if camel in record:
        return record[camel]
    return record.get(snake or camel)


def _required_text(value: object, code: str, field: str) -> str:
    normalized = str(value if value is not None else "").strip()
    if not normalized:
        raise NotamValidationError(code, f"{field} is required")
    return normalized


def _required_canonical(value: object, code: str, field: str) -> str:
    return _required_text(value, code, field).upper()


def _required_instant(value: object, code: str, field: str) -> datetime:
    if isinstance(value, datetime):
        result = value
    else:
        raw = str(value if value is not None else "").strip()
        try:
            result = datetime.fromisoformat(raw.replace("Z", "+00:00"))
        except ValueError as exc:
            raise NotamValidationError(code, f"{field} must be a valid instant") from exc
    if result.tzinfo is None or result.utcoffset() is None:
        raise NotamValidationError(code, f"{field} must include a timezone")
    return result.astimezone(timezone.utc)


def categorize_notam(text: str) -> str:
    """Return the portable category using declared precedence."""

    upper = text.upper()
    if "RWY" in upper or "RUNWAY" in upper:
        return "Runway"
    if "TWY" in upper or "TAXIWAY" in upper:
        return "Taxiway"
    if "APRON" in upper or "RAMP" in upper:
        return "Apron/Ramp"
    if "LIGHTING" in upper or "LGT" in upper:
        return "Lighting"
    if any(token in upper for token in ("NAVAID", "NAV", "VOR", "ILS")):
        return "Navigation"
    if any(token in upper for token in ("OBST", "OBSTACLE", "CRANE")):
        return "Obstacle"
    if "AIRSPACE" in upper or "TFR" in upper:
        return "Airspace"
    if any(token in upper for token in ("FREQ", "FREQUENCY", "ATIS")):
        return "Communications"
    if "FUEL" in upper:
        return "Fuel"
    if "WEATHER" in upper or "WX" in upper:
        return "Weather"
    return "General"


def categorize_notam_severity(notam: Notam | str) -> NotamSeverity:
    """Return critical/high/medium/low using stable keyword precedence."""

    text = (notam.text if isinstance(notam, Notam) else notam).upper()
    if any(
        token in text
        for token in ("CLOSED", "CLSD", "OUT OF SERVICE", "U/S", "NOTAVBL")
    ):
        return "critical"
    if any(
        token in text
        for token in ("OBST", "OBSTACLE", "CRANE", "TOWER", "CONSTRUCTION")
    ):
        return "high"
    if any(
        token in text
        for token in ("DISPLACED", "DSPLCD", "LIGHTING", "LGT", "NAVAID", "VASI", "PAPI")
    ):
        return "medium"
    return "low"


def normalize_notam_record(record: Mapping[str, object]) -> Notam:
    """Validate and canonicalize a provider-neutral NOTAM record."""

    identifier = _required_canonical(
        _value(record, "id"), "notam-id-required", "id"
    )
    location = _required_canonical(
        _value(record, "location"), "notam-location-required", "location"
    )
    text = _required_text(_value(record, "text"), "notam-text-required", "text")
    effective_start = _required_instant(
        _value(record, "effectiveStart", "effective_start"),
        "notam-effective-start-invalid",
        "effectiveStart",
    )
    effective_end = _required_instant(
        _value(record, "effectiveEnd", "effective_end"),
        "notam-effective-end-invalid",
        "effectiveEnd",
    )
    if effective_end < effective_start:
        raise NotamValidationError(
            "notam-effective-window-invalid",
            "effectiveEnd must not precede effectiveStart",
        )

    result = Notam(
        id=identifier,
        type=str(_value(record, "type") or "NOTAM").strip().upper() or "NOTAM",
        location=location,
        facility_type=str(
            _value(record, "facilityType", "facility_type") or "AD"
        ).strip().upper() or "AD",
        effective_start=effective_start,
        effective_end=effective_end,
        classification=str(_value(record, "classification") or "Unknown").strip()
        or "Unknown",
        text=text,
        severity="low",
        category=categorize_notam(text),
    )
    return replace(result, severity=categorize_notam_severity(result))


def is_notam_effective(notam: Notam, check_at: datetime) -> bool:
    """Return whether check_at is within the inclusive effective window."""

    if check_at.tzinfo is None or check_at.utcoffset() is None:
        raise NotamValidationError(
            "notam-check-time-invalid", "check_at must include a timezone"
        )
    check_utc = check_at.astimezone(timezone.utc)
    return notam.effective_start <= check_utc <= notam.effective_end


def filter_relevant_notams(
    notams: Iterable[Notam],
    route_icaos: Sequence[str],
    include_enroute: bool,
    check_at: datetime,
) -> list[Notam]:
    """Filter effective route/en-route records while retaining input order."""

    route = tuple(value.strip().upper() for value in route_icaos if value.strip())
    return [
        notam
        for notam in notams
        if is_notam_effective(notam, check_at)
        and (
            any(notam.location.upper().startswith(icao) for icao in route)
            or (include_enroute and notam.facility_type.upper() == "EN")
        )
    ]


_SEVERITY_ORDER = {"critical": 0, "high": 1, "medium": 2, "low": 3}


def sort_notams_by_severity(notams: Iterable[Notam]) -> list[Notam]:
    """Return a stable severity-ordered copy."""

    return sorted(notams, key=lambda value: _SEVERITY_ORDER[value.severity])


def format_notam_text(text: str) -> str:
    """Collapse whitespace and expand the declared conservative abbreviations."""

    formatted = re.sub(r"\s+", " ", text).strip()
    replacements = (
        (r"\bRWY\b", "Runway"),
        (r"\bTWY\b", "Taxiway"),
        (r"\bCLSD\b", "CLOSED"),
        (r"\bOBST\b", "Obstacle"),
        (r"\bLGT\b", "Lighting"),
        (r"\bNAVAID\b", "Navigation Aid"),
        (r"\bU/S\b", "Out of Service"),
        (r"\bNOTAVBL\b", "Not Available"),
    )
    for pattern, replacement_value in replacements:
        formatted = re.sub(pattern, replacement_value, formatted)
    return formatted


__all__ = [
    "Notam",
    "NotamValidationError",
    "categorize_notam",
    "categorize_notam_severity",
    "filter_relevant_notams",
    "format_notam_text",
    "is_notam_effective",
    "normalize_notam_record",
    "sort_notams_by_severity",
]
