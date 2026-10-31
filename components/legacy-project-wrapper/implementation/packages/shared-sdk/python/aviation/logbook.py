"""Portable pilot-logbook duration validation owned by aviation.logbook."""

from __future__ import annotations

from dataclasses import dataclass
from math import isfinite

LOGBOOK_PILOT_ROLES = (
    "PIC",
    "SIC",
    "STUDENT",
    "INSTRUCTOR",
    "SPLIT",
    "DUAL",
    "SOLO",
)


@dataclass(frozen=True)
class LogbookTimeInput:
    total_time: float
    pilot_role: str
    pic_time: float = 0.0
    dual_received_time: float = 0.0
    solo_time: float = 0.0
    day_time: float = 0.0
    night_time: float = 0.0
    actual_instrument_time: float = 0.0
    simulated_instrument_time: float = 0.0
    cross_country_time: float = 0.0
    night_landings: int = 0
    student_pilot: bool = False


@dataclass(frozen=True)
class LogbookValidationIssue:
    code: str
    severity: str
    message: str
    fields: tuple[str, ...]


@dataclass(frozen=True)
class LogbookTimeValidationResult:
    valid: bool
    normalized_pilot_role: str
    normalized_pic_time: float
    accounted_time: float | None
    issues: tuple[LogbookValidationIssue, ...]


_DURATION_FIELDS = (
    "total_time",
    "pic_time",
    "dual_received_time",
    "solo_time",
    "day_time",
    "night_time",
    "actual_instrument_time",
    "simulated_instrument_time",
    "cross_country_time",
)


def _issue(code: str, message: str, *fields: str) -> LogbookValidationIssue:
    return LogbookValidationIssue(code, "error", message, fields)


def _valid_number(value: object) -> bool:
    return (
        isinstance(value, (int, float))
        and not isinstance(value, bool)
        and isfinite(value)
    )


def validate_logbook_time(
    input_value: LogbookTimeInput,
    tolerance: float = 0.1,
) -> LogbookTimeValidationResult:
    """Validate common duration relationships without mutating the input."""

    issues: list[LogbookValidationIssue] = []
    role_value = input_value.pilot_role
    normalized_role = role_value.strip().upper() if isinstance(role_value, str) else ""
    raw_pic_time = input_value.pic_time
    normalized_pic_time = float(raw_pic_time) if _valid_number(raw_pic_time) else 0.0

    for field in _DURATION_FIELDS:
        value = getattr(input_value, field)
        if not _valid_number(value) or value < 0:
            portable_field = _portable_field(field)
            issues.append(
                _issue(
                    "invalid-duration",
                    f"{portable_field} must be a finite, non-negative duration in decimal hours",
                    portable_field,
                )
            )

    night_landings = input_value.night_landings
    if (
        not _valid_number(night_landings)
        or not float(night_landings).is_integer()
        or night_landings < 0
    ):
        issues.append(
            _issue(
                "invalid-landing-count",
                "nightLandings must be a finite, non-negative integer",
                "nightLandings",
            )
        )

    if not _valid_number(tolerance) or tolerance < 0:
        issues.append(
            _issue(
                "invalid-tolerance",
                "tolerance must be finite and non-negative",
                "tolerance",
            )
        )

    if normalized_role not in LOGBOOK_PILOT_ROLES:
        issues.append(
            _issue(
                "invalid-pilot-role",
                f"Invalid pilot role (must be one of: {', '.join(LOGBOOK_PILOT_ROLES)})",
                "pilotRole",
            )
        )

    if issues:
        return LogbookTimeValidationResult(
            valid=False,
            normalized_pilot_role=normalized_role,
            normalized_pic_time=normalized_pic_time,
            accounted_time=None,
            issues=tuple(issues),
        )

    total_time = float(input_value.total_time)
    dual_received_time = float(input_value.dual_received_time)
    solo_time = float(input_value.solo_time)
    day_time = float(input_value.day_time)
    night_time = float(input_value.night_time)
    actual_instrument_time = float(input_value.actual_instrument_time)
    simulated_instrument_time = float(input_value.simulated_instrument_time)
    tolerance_value = float(tolerance)
    student_pilot = input_value.student_pilot or normalized_role == "STUDENT"

    if (
        total_time > 0
        and normalized_role == "PIC"
        and normalized_pic_time == 0
        and dual_received_time == 0
    ):
        normalized_pic_time = total_time

    condition_time = day_time + night_time
    if (
        condition_time > 0
        and day_time > 0
        and night_time > 0
        and abs(condition_time - total_time) > tolerance_value
    ):
        issues.append(
            _issue(
                "day-night-total-mismatch",
                f"Day ({day_time:g}) + night ({night_time:g}) time ({condition_time:g}) does not match total time ({total_time:g})",
                "dayTime",
                "nightTime",
                "totalTime",
            )
        )

    instrument_time = actual_instrument_time + simulated_instrument_time
    if instrument_time > total_time:
        issues.append(
            _issue(
                "instrument-time-exceeds-total",
                f"Total instrument time ({instrument_time:g}) exceeds flight time ({total_time:g})",
                "actualInstrumentTime",
                "simulatedInstrumentTime",
                "totalTime",
            )
        )

    if dual_received_time > total_time:
        issues.append(
            _issue(
                "dual-received-exceeds-total",
                f"Dual received time ({dual_received_time:g}) exceeds flight time ({total_time:g})",
                "dualReceivedTime",
                "totalTime",
            )
        )

    accounted_time: float | None = None
    if total_time == 0:
        accounted_time = 0.0
    elif normalized_pic_time > 0 and dual_received_time > 0 and not student_pilot:
        pic_equals_total = abs(normalized_pic_time - total_time) <= tolerance_value
        dual_equals_total = abs(dual_received_time - total_time) <= tolerance_value
        accounted_time = (
            total_time
            if pic_equals_total and dual_equals_total
            else dual_received_time
            + normalized_pic_time
            + max(0.0, solo_time - normalized_pic_time)
        )
    elif (
        student_pilot
        or (normalized_pic_time > 0 and dual_received_time == 0)
        or (normalized_pic_time == 0 and dual_received_time > 0)
    ):
        solo_outside_pic = (
            solo_time if student_pilot else max(0.0, solo_time - normalized_pic_time)
        )
        accounted_time = dual_received_time + normalized_pic_time + solo_outside_pic

    if (
        accounted_time is not None
        and total_time > 0
        and abs(accounted_time - total_time) > tolerance_value
    ):
        issues.append(
            _issue(
                "time-accounting-mismatch",
                f"Total time ({total_time:.1f}) does not match PIC ({normalized_pic_time:.1f}), dual received ({dual_received_time:.1f}), and solo ({solo_time:.1f}) time (solo can overlap PIC)",
                "totalTime",
                "picTime",
                "dualReceivedTime",
                "soloTime",
            )
        )

    if student_pilot and normalized_pic_time > 0:
        issues.append(
            _issue(
                "student-pic-conflict",
                "Student pilot cannot log PIC time",
                "studentPilot",
                "pilotRole",
                "picTime",
            )
        )

    if student_pilot and dual_received_time == 0 and solo_time == 0 and total_time > 0:
        issues.append(
            _issue(
                "student-time-missing",
                "Student pilot flights should typically log dual received time",
                "studentPilot",
                "pilotRole",
                "dualReceivedTime",
                "soloTime",
            )
        )

    if night_landings > 0 and night_time == 0:
        issues.append(
            _issue(
                "night-landings-without-night-time",
                "Night landings logged without night flight time",
                "nightLandings",
                "nightTime",
            )
        )

    if solo_time > 0 and dual_received_time > 0:
        issues.append(
            _issue(
                "solo-dual-conflict",
                "Solo time cannot be logged with dual received time",
                "soloTime",
                "dualReceivedTime",
            )
        )

    if solo_time > 0 and normalized_role not in ("PIC", "STUDENT"):
        issues.append(
            _issue(
                "solo-role-conflict",
                "Solo time can only be logged by PIC or student pilots",
                "soloTime",
                "pilotRole",
            )
        )

    return LogbookTimeValidationResult(
        valid=not any(candidate.severity == "error" for candidate in issues),
        normalized_pilot_role=normalized_role,
        normalized_pic_time=normalized_pic_time,
        accounted_time=accounted_time,
        issues=tuple(issues),
    )


def _portable_field(field: str) -> str:
    head, *tail = field.split("_")
    return head + "".join(part.title() for part in tail)


__all__ = [
    "LOGBOOK_PILOT_ROLES",
    "LogbookTimeInput",
    "LogbookTimeValidationResult",
    "LogbookValidationIssue",
    "validate_logbook_time",
]
