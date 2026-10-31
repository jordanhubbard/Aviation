"""Conformance adapter for Component-owned aviation.notam semantics."""

from __future__ import annotations

from datetime import datetime, timezone

import pytest

from aviation.notam import (
    Notam,
    NotamValidationError,
    categorize_notam,
    categorize_notam_severity,
    filter_relevant_notams,
    format_notam_text,
    is_notam_effective,
    normalize_notam_record,
    sort_notams_by_severity,
)
from _conformance_contract import load_conformance_contract


CONTRACT = load_conformance_contract("notam")


def _instant(value: str) -> datetime:
    return datetime.fromisoformat(value.replace("Z", "+00:00")).astimezone(timezone.utc)


def _portable(notam: Notam) -> dict[str, object]:
    def iso(value: datetime) -> str:
        return (
            value.astimezone(timezone.utc)
            .isoformat(timespec="milliseconds")
            .replace("+00:00", "Z")
        )

    return {
        "id": notam.id,
        "type": notam.type,
        "location": notam.location,
        "facilityType": notam.facility_type,
        "effectiveStart": iso(notam.effective_start),
        "effectiveEnd": iso(notam.effective_end),
        "classification": notam.classification,
        "text": notam.text,
        "severity": notam.severity,
        "category": notam.category,
    }


@pytest.mark.parametrize(
    "vector", CONTRACT["normalizationCases"], ids=lambda item: item["id"]
)
def test_component_notam_normalization(vector: dict[str, object]) -> None:
    before = dict(vector["input"])
    assert _portable(normalize_notam_record(vector["input"])) == vector["expected"]
    assert vector["input"] == before


@pytest.mark.parametrize(
    "vector", CONTRACT["invalidNormalizationCases"], ids=lambda item: item["id"]
)
def test_component_notam_invalid_normalization(vector: dict[str, object]) -> None:
    with pytest.raises(NotamValidationError) as raised:
        normalize_notam_record(vector["input"])
    assert raised.value.code == vector["expectedErrorCode"]


@pytest.mark.parametrize(
    "vector", CONTRACT["classificationCases"], ids=lambda item: item["id"]
)
def test_component_notam_classification(vector: dict[str, object]) -> None:
    record = normalize_notam_record(
        {
            "id": vector["id"],
            "location": "KAAA",
            "effectiveStart": "2026-10-31T10:00:00Z",
            "effectiveEnd": "2026-10-31T14:00:00Z",
            "text": vector["text"],
        }
    )
    assert categorize_notam_severity(record) == vector["severity"]
    assert categorize_notam(vector["text"]) == vector["category"]


@pytest.mark.parametrize(
    "vector", CONTRACT["formatCases"], ids=lambda item: item["id"]
)
def test_component_notam_formatting(vector: dict[str, object]) -> None:
    assert format_notam_text(vector["input"]) == vector["expected"]


RECORDS = [normalize_notam_record(value) for value in CONTRACT["records"]]


@pytest.mark.parametrize(
    "vector", CONTRACT["effectiveCases"], ids=lambda item: item["id"]
)
def test_component_notam_effective_window(vector: dict[str, object]) -> None:
    record = next(
        value for value in RECORDS if value.id == str(vector["recordId"]).upper()
    )
    assert is_notam_effective(record, _instant(vector["instant"])) is vector["expected"]


@pytest.mark.parametrize(
    "vector", CONTRACT["filterCases"], ids=lambda item: item["id"]
)
def test_component_notam_filtering(vector: dict[str, object]) -> None:
    result = filter_relevant_notams(
        RECORDS,
        vector["routeIcaos"],
        vector["includeEnroute"],
        _instant(CONTRACT["referenceTime"]),
    )
    assert [value.id for value in result] == vector["expectedIds"]


def test_component_notam_sorting_is_stable_and_non_mutating() -> None:
    before = [value.id for value in RECORDS]
    assert [value.id for value in sort_notams_by_severity(RECORDS)] == CONTRACT[
        "expectedSeverityOrder"
    ]
    assert [value.id for value in RECORDS] == before
