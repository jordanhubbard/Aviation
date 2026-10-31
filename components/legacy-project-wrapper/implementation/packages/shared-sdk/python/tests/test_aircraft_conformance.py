"""Conformance adapter for Component-owned aviation.aircraft profiles."""

from __future__ import annotations

import copy
import math

import pytest

from aviation.aircraft import (
    C172S_OPERATING_PROFILE,
    aircraft_operating_profile_from_mapping,
    find_aircraft_operating_profile,
)
from _conformance_contract import load_conformance_contract

CONTRACT = load_conformance_contract("aircraft")


def _portable_profile(profile) -> dict[str, object]:
    speeds = profile.airspeed_limits
    fuel = profile.fuel_limits
    weight = profile.weight_limits
    dimensions = profile.dimensions
    performance = profile.reference_performance
    return {
        "profileId": profile.profile_id,
        "icaoTypeDesignator": profile.icao_type_designator,
        "manufacturer": profile.manufacturer,
        "model": profile.model,
        "displayName": profile.display_name,
        "airspeedLimits": {
            "vsoKias": speeds.vso_kias,
            "vsKias": speeds.vs_kias,
            "vfeKias": speeds.vfe_kias,
            "vaKias": speeds.va_kias,
            "vnoKias": speeds.vno_kias,
            "vneKias": speeds.vne_kias,
        },
        "fuelLimits": {
            "totalCapacityGal": fuel.total_capacity_gal,
            "usableCapacityGal": fuel.usable_capacity_gal,
        },
        "weightLimits": {
            "maximumTakeoffWeightLb": weight.maximum_takeoff_weight_lb,
        },
        "dimensions": {
            "lengthFt": dimensions.length_ft,
            "heightFt": dimensions.height_ft,
            "wingspanFt": dimensions.wingspan_ft,
        },
        "referencePerformance": {
            "maximumCruiseSpeedKtas": performance.maximum_cruise_speed_ktas,
            "maximumClimbRateFpm": performance.maximum_climb_rate_fpm,
            "serviceCeilingFt": performance.service_ceiling_ft,
            "takeoffDistanceFt": performance.takeoff_distance_ft,
            "landingDistanceFt": performance.landing_distance_ft,
        },
    }


def test_component_profile_matches_portable_vector() -> None:
    assert CONTRACT["schema"] == "aviation/aircraft-acceptance-vectors@2"
    assert _portable_profile(C172S_OPERATING_PROFILE) == (
        CONTRACT["profiles"]["cessna-172s"]
    )


@pytest.mark.parametrize("lookup", CONTRACT["lookups"], ids=lambda item: item["query"])
def test_component_profile_lookup(lookup: dict[str, object]) -> None:
    profile = find_aircraft_operating_profile(str(lookup["query"]))
    actual = profile.profile_id if profile else None
    assert actual == lookup["expectedProfileId"]


@pytest.mark.parametrize(
    "mutation",
    CONTRACT["invalidMutations"],
    ids=lambda item: item["id"],
)
def test_invalid_component_profiles_fail_closed(mutation: dict[str, object]) -> None:
    profile = copy.deepcopy(CONTRACT["profiles"]["cessna-172s"])
    target = profile
    path = mutation["path"]
    for segment in path[:-1]:
        target = target[segment]
    value = mutation["value"]
    target[path[-1]] = math.nan if value == "non-finite" else value
    with pytest.raises((TypeError, ValueError)):
        aircraft_operating_profile_from_mapping(profile)
