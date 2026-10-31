"""Conformance adapter for Component-owned aviation.aircraft profiles."""

from __future__ import annotations

import copy
import math

import pytest

from aviation.aircraft import (
    ADDITIONAL_SUPPORTED_TYPE_DESIGNATORS,
    AIRCRAFT_TYPE_DESIGNATORS,
    C172S_OPERATING_PROFILE,
    C182T_OPERATING_PROFILE,
    SR22_PERSPECTIVE_3600_OPERATING_PROFILE,
    aircraft_operating_profile_from_mapping,
    aircraft_type_designator_catalog_summary,
    aircraft_type_designators_by_manufacturer,
    find_aircraft_type_designator,
    find_aircraft_operating_profile,
    match_aircraft_operating_profile,
    is_supported_aircraft_type_designator,
    suggest_aircraft_type_designators,
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
            "takeoffGroundRollFt": performance.takeoff_ground_roll_ft,
            "takeoffDistanceFt": performance.takeoff_distance_ft,
            "landingGroundRollFt": performance.landing_ground_roll_ft,
            "landingDistanceFt": performance.landing_distance_ft,
        },
    }


@pytest.mark.parametrize(
    "profile",
    (
        C172S_OPERATING_PROFILE,
        C182T_OPERATING_PROFILE,
        SR22_PERSPECTIVE_3600_OPERATING_PROFILE,
    ),
    ids=lambda profile: profile.profile_id,
)
def test_component_profile_matches_portable_vector(profile) -> None:
    assert CONTRACT["schema"] == "aviation/aircraft-acceptance-vectors@5"
    assert _portable_profile(profile) == CONTRACT["profiles"][profile.profile_id]


@pytest.mark.parametrize("lookup", CONTRACT["lookups"], ids=lambda item: item["query"])
def test_component_profile_lookup(lookup: dict[str, object]) -> None:
    profile = find_aircraft_operating_profile(str(lookup["query"]))
    actual = profile.profile_id if profile else None
    assert actual == lookup["expectedProfileId"]


@pytest.mark.parametrize(
    "identity",
    CONTRACT["identityMatches"],
    ids=lambda item: f'{item["manufacturer"]}/{item["model"]}',
)
def test_component_profile_identity_match(identity: dict[str, object]) -> None:
    profile = match_aircraft_operating_profile(
        str(identity["manufacturer"]),
        str(identity["model"]),
    )
    actual = profile.profile_id if profile else None
    assert actual == identity["expectedProfileId"]


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


def test_component_type_designator_catalog_matches_portable_vectors() -> None:
    actual = {
        code: {
            "manufacturer": record.manufacturer,
            "model": record.model,
            "category": record.category,
        }
        for code, record in AIRCRAFT_TYPE_DESIGNATORS.items()
    }
    assert actual == CONTRACT["typeDesignators"]
    assert sorted(ADDITIONAL_SUPPORTED_TYPE_DESIGNATORS) == (
        CONTRACT["additionalSupportedTypeDesignators"]
    )


@pytest.mark.parametrize(
    "lookup",
    CONTRACT["typeDesignatorLookups"],
    ids=lambda item: item["query"] or "blank",
)
def test_component_type_designator_lookup(lookup: dict[str, object]) -> None:
    record = find_aircraft_type_designator(str(lookup["query"]))
    assert (record.code if record else None) == lookup["expectedCode"]
    assert is_supported_aircraft_type_designator(str(lookup["query"])) is lookup["supported"]


@pytest.mark.parametrize(
    "lookup",
    CONTRACT["typeDesignatorManufacturerLookups"],
    ids=lambda item: item["manufacturer"],
)
def test_component_type_designator_manufacturer_lookup(
    lookup: dict[str, object],
) -> None:
    assert aircraft_type_designators_by_manufacturer(str(lookup["manufacturer"])) == (
        lookup["expectedCodes"]
    )


@pytest.mark.parametrize(
    "suggestion",
    CONTRACT["typeDesignatorSuggestions"],
    ids=lambda item: item["query"] or "blank",
)
def test_component_type_designator_suggestions(suggestion: dict[str, object]) -> None:
    assert suggest_aircraft_type_designators(
        str(suggestion["query"]), int(suggestion["maximum"])
    ) == suggestion["expectedCodes"]


def test_component_type_designator_summary() -> None:
    assert aircraft_type_designator_catalog_summary() == CONTRACT["typeDesignatorSummary"]
