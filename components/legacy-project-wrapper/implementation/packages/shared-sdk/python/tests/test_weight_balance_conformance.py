"""Conformance adapter for the Component-owned weight-and-balance capability."""

from __future__ import annotations

import copy
import math

import pytest

from aviation.aircraft import C172S_OPERATING_PROFILE
from aviation.weight_balance import (
    C172S_LOADING_PROFILE,
    EnvelopePoint,
    LoadingInput,
    calculate_load,
    find_loading_profile,
    interpolate_envelope,
    loading_profile_from_mapping,
)
from _conformance_contract import load_conformance_contract

CONTRACT = load_conformance_contract("weight-balance")
PROFILE = CONTRACT["profiles"]["cessna-172s-sample-loading"]


def _portable_profile(profile) -> dict[str, object]:
    return {
        "profileId": profile.profile_id,
        "aircraftProfileId": profile.aircraft_profile_id,
        "displayName": profile.display_name,
        "emptyWeight": profile.empty_weight,
        "emptyMoment": profile.empty_moment,
        "maxGross": profile.max_gross,
        "usableFuelCapacity": profile.usable_fuel_capacity,
        "fuelArm": profile.fuel_arm,
        "fuelDensity": profile.fuel_density,
        "stations": [
            {
                "stationId": station.station_id,
                "name": station.name,
                "arm": station.arm,
                **(
                    {"maximumWeight": station.maximum_weight}
                    if station.maximum_weight is not None
                    else {}
                ),
            }
            for station in profile.stations
        ],
        "stationGroupLimits": [
            {
                "name": group.name,
                "stationIds": list(group.station_ids),
                "maximumWeight": group.maximum_weight,
            }
            for group in profile.station_group_limits
        ],
        "envelope": [
            {"weight": point.weight, "forward": point.forward, "aft": point.aft}
            for point in profile.envelope
        ],
    }


def _portable_condition(condition) -> dict[str, object]:
    return {
        "weight": condition.weight,
        "cg": condition.cg,
        "limits": (
            {"forward": condition.limits[0], "aft": condition.limits[1]}
            if condition.limits is not None
            else None
        ),
        "problems": list(condition.problems),
        "withinLimits": condition.within_limits,
    }


def _execute(vector: dict[str, object]) -> object:
    args = vector["args"]
    if vector["operation"] == "interpolate_envelope":
        raw_envelope = args[1] if len(args) > 1 else PROFILE["envelope"]
        envelope = tuple(
            EnvelopePoint(point["weight"], point["forward"], point["aft"])
            for point in raw_envelope
        )
        limits = interpolate_envelope(envelope, args[0])
        return (
            {"forward": limits[0], "aft": limits[1]}
            if limits is not None
            else None
        )

    raw_loading = args[0]
    result = calculate_load(
        C172S_LOADING_PROFILE,
        LoadingInput(
            station_weights=tuple(raw_loading["stationWeights"]),
            fuel_gallons=raw_loading["fuelGallons"],
            fuel_burn_gallons=raw_loading["fuelBurnGallons"],
        ),
    )
    return {
        "takeoff": _portable_condition(result.takeoff),
        "landing": _portable_condition(result.landing),
    }


def test_profile_matches_component_vector_and_aircraft_link() -> None:
    assert CONTRACT["schema"] == "aviation/weight-balance-acceptance-vectors@2"
    assert _portable_profile(C172S_LOADING_PROFILE) == PROFILE
    assert C172S_LOADING_PROFILE.aircraft_profile_id == C172S_OPERATING_PROFILE.profile_id
    assert C172S_LOADING_PROFILE.max_gross == (
        C172S_OPERATING_PROFILE.weight_limits.maximum_takeoff_weight_lb
    )
    assert C172S_LOADING_PROFILE.usable_fuel_capacity == (
        C172S_OPERATING_PROFILE.fuel_limits.usable_capacity_gal
    )


@pytest.mark.parametrize("lookup", CONTRACT["lookups"], ids=lambda item: item["query"])
def test_loading_profile_lookup(lookup: dict[str, object]) -> None:
    profile = find_loading_profile(str(lookup["query"]))
    actual = profile.profile_id if profile else None
    assert actual == lookup["expectedProfileId"]


@pytest.mark.parametrize("vector", CONTRACT["vectors"], ids=lambda item: item["id"])
def test_weight_balance_vector(vector: dict[str, object]) -> None:
    if vector.get("expected_error"):
        with pytest.raises((TypeError, ValueError)):
            _execute(vector)
        return
    actual = _execute(vector)
    if "expected_problems" in vector:
        assert set(vector["expected_problems"]).issubset(actual["takeoff"]["problems"])
        return
    assert actual == vector["expected"]


@pytest.mark.parametrize(
    "mutation",
    CONTRACT["invalidProfileMutations"],
    ids=lambda item: item["id"],
)
def test_invalid_profiles_fail_closed(mutation: dict[str, object]) -> None:
    candidate = copy.deepcopy(PROFILE)
    target = candidate
    path = mutation["path"]
    for segment in path[:-1]:
        target = target[segment]
    value = mutation["value"]
    target[path[-1]] = math.nan if value == "non-finite" else value
    with pytest.raises((TypeError, ValueError)):
        loading_profile_from_mapping(candidate, C172S_OPERATING_PROFILE)
