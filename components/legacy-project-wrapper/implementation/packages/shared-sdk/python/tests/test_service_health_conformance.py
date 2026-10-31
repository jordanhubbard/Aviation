"""Conformance adapter for Component-owned service-health semantics."""

from copy import deepcopy

import pytest

from aviation.health import (
    HealthReportError,
    create_health_report,
    normalize_health_status,
)
from _conformance_contract import load_conformance_contract


CONTRACT = load_conformance_contract("service-health")


@pytest.mark.parametrize("vector", CONTRACT["normalizationCases"])
def test_normalization(vector: dict[str, object]) -> None:
    assert normalize_health_status(vector["input"]) == vector["expected"]


@pytest.mark.parametrize("status", CONTRACT["invalidStatusCases"])
def test_invalid_status(status: str) -> None:
    with pytest.raises(HealthReportError) as raised:
        normalize_health_status(status)
    assert raised.value.code == "health-status-invalid"


@pytest.mark.parametrize("vector", CONTRACT["reportCases"], ids=lambda item: item["id"])
def test_report(vector: dict[str, object]) -> None:
    inputs = vector["input"]
    before = deepcopy(inputs)
    assert create_health_report(**inputs) == vector["expected"]
    assert inputs == before


@pytest.mark.parametrize(
    "vector", CONTRACT["invalidReportCases"], ids=lambda item: item["id"]
)
def test_invalid_report(vector: dict[str, object]) -> None:
    with pytest.raises(HealthReportError) as raised:
        create_health_report(**vector["input"])
    assert raised.value.code == vector["code"]
