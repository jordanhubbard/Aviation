"""Conformance adapter for Component-owned aviation.alerts semantics."""

import pytest

from aviation.alerts import (
    AlertLifecycleError,
    alert_priority,
    highest_alert_level,
    normalize_alert_level,
    order_alerts,
    reconcile_acknowledgements,
)
from _conformance_contract import load_conformance_contract


CONTRACT = load_conformance_contract("alerts")


@pytest.mark.parametrize("vector", CONTRACT["normalizationCases"])
def test_normalization(vector: dict[str, object]) -> None:
    assert normalize_alert_level(vector["input"]) == vector["expected"]
    assert alert_priority(vector["input"]) == vector["priority"]


@pytest.mark.parametrize("level", CONTRACT["invalidLevelCases"])
def test_invalid_level(level: str) -> None:
    with pytest.raises(AlertLifecycleError) as raised:
        normalize_alert_level(level)
    assert raised.value.code == "alert-level-invalid"


@pytest.mark.parametrize("vector", CONTRACT["orderingCases"], ids=lambda item: item["id"])
def test_ordering(vector: dict[str, object]) -> None:
    before = [dict(alert) for alert in vector["input"]]
    assert [alert["id"] for alert in order_alerts(vector["input"])] == vector["expectedIds"]
    assert vector["input"] == before


@pytest.mark.parametrize(
    "vector", CONTRACT["reconciliationCases"], ids=lambda item: item["id"]
)
def test_reconciliation(vector: dict[str, object]) -> None:
    active_before = list(vector["activeIds"])
    acknowledged_before = list(vector["acknowledgedIds"])
    assert reconcile_acknowledgements(
        vector["activeIds"], vector["acknowledgedIds"]
    ) == vector["expected"]
    assert vector["activeIds"] == active_before
    assert vector["acknowledgedIds"] == acknowledged_before


@pytest.mark.parametrize("vector", CONTRACT["highestCases"], ids=lambda item: item["id"])
def test_highest(vector: dict[str, object]) -> None:
    assert highest_alert_level(
        vector["alerts"], vector["includeAcknowledged"]
    ) == vector["expected"]
