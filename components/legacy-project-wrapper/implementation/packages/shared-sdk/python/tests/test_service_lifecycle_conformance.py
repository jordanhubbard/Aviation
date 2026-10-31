"""Conformance adapter for Component-owned service lifecycle transitions."""

from copy import deepcopy

import pytest

from aviation.service_lifecycle import (
    ServiceLifecycleError,
    transition_service_lifecycle,
)
from _conformance_contract import load_conformance_contract


CONTRACT = load_conformance_contract("service-lifecycle")


@pytest.mark.parametrize("vector", CONTRACT["sequenceCases"], ids=lambda item: item["id"])
def test_sequence(vector: dict[str, object]) -> None:
    before = deepcopy(vector)
    state = vector["initial"]
    actual_states = []
    for event in vector["events"]:
        state = transition_service_lifecycle(state, event)
        actual_states.append(state)
    assert actual_states == vector["expectedStates"]
    assert vector == before


@pytest.mark.parametrize(
    "vector", CONTRACT["invalidTransitionCases"], ids=lambda item: item["id"]
)
def test_invalid_transition(vector: dict[str, str]) -> None:
    with pytest.raises(ServiceLifecycleError) as raised:
        transition_service_lifecycle(vector["state"], vector["event"])
    assert raised.value.code == "service-lifecycle-transition-invalid"
