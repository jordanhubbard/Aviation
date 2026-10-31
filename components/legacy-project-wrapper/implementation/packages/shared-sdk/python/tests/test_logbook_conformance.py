"""Conformance adapter for Component-owned aviation.logbook validation."""

from __future__ import annotations

from dataclasses import replace
import math

import pytest

from aviation.logbook import LogbookTimeInput, validate_logbook_time
from _conformance_contract import load_conformance_contract

CONTRACT = load_conformance_contract("logbook")


def _input_from_portable(value: dict[str, object]) -> LogbookTimeInput:
    return LogbookTimeInput(
        total_time=value["totalTime"],
        pilot_role=value["pilotRole"],
        pic_time=value.get("picTime", 0.0),
        dual_received_time=value.get("dualReceivedTime", 0.0),
        solo_time=value.get("soloTime", 0.0),
        day_time=value.get("dayTime", 0.0),
        night_time=value.get("nightTime", 0.0),
        actual_instrument_time=value.get("actualInstrumentTime", 0.0),
        simulated_instrument_time=value.get("simulatedInstrumentTime", 0.0),
        cross_country_time=value.get("crossCountryTime", 0.0),
        night_landings=value.get("nightLandings", 0),
        student_pilot=value.get("studentPilot", False),
    )


@pytest.mark.parametrize("vector", CONTRACT["cases"], ids=lambda item: item["id"])
def test_component_logbook_case(vector: dict[str, object]) -> None:
    assert CONTRACT["schema"] == "aviation/logbook-acceptance-vectors@1"
    input_value = _input_from_portable(vector["input"])
    result = validate_logbook_time(input_value, CONTRACT["defaultTolerance"])
    expected = vector["expected"]

    assert {
        "valid": result.valid,
        "normalizedPilotRole": result.normalized_pilot_role,
        "normalizedPicTime": result.normalized_pic_time,
        "accountedTime": result.accounted_time,
        "issueCodes": [candidate.code for candidate in result.issues],
    } == expected
    assert input_value == _input_from_portable(vector["input"])


@pytest.mark.parametrize(
    "vector",
    CONTRACT["invalidRuntimeCases"],
    ids=lambda item: item["id"],
)
def test_component_logbook_invalid_runtime_case(vector: dict[str, object]) -> None:
    input_value = LogbookTimeInput(
        total_time=1.0,
        pic_time=1.0,
        day_time=1.0,
        pilot_role="PIC",
    )
    runtime_value = {
        "positive-infinity": math.inf,
        "not-a-number": math.nan,
    }.get(vector["runtimeValue"], vector["runtimeValue"])
    if vector["field"] == "tolerance":
        result = validate_logbook_time(input_value, runtime_value)
    else:
        python_field = {
            "totalTime": "total_time",
            "nightLandings": "night_landings",
        }[vector["field"]]
        result = validate_logbook_time(
            replace(input_value, **{python_field: runtime_value})
        )

    assert result.valid is False
    assert result.accounted_time is None
    assert vector["expectedIssueCode"] in [
        candidate.code for candidate in result.issues
    ]

