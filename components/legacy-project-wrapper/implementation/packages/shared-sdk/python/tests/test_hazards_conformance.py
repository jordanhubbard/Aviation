"""Conformance adapter for Component-owned aviation.hazards semantics."""

from datetime import datetime, timezone

import pytest

from aviation.hazards import (
    Hazard,
    HazardValidationError,
    LatLon,
    altitude_overlaps,
    derive_severity,
    find_route_hazards_in_band,
    hazard_intersects_leg,
    is_hazard_active,
    normalize_hazard_record,
    point_in_polygon,
)
from _conformance_contract import load_conformance_contract


CONTRACT = load_conformance_contract("hazards")


def _instant(value: str) -> datetime:
    return datetime.fromisoformat(value.replace("Z", "+00:00")).astimezone(timezone.utc)


def _geometry(value: Hazard) -> dict[str, object]:
    if value.geometry["type"] == "Point":
        point = value.geometry["coordinate"]
        return {"type": "Point", "coordinate": {"lat": point.lat, "lon": point.lon}}
    return {"type": "Polygon", "coordinates": [
        {"lat": point.lat, "lon": point.lon} for point in value.geometry["coordinates"]
    ]}


def _portable(value: Hazard) -> dict[str, object]:
    iso = lambda instant: instant.isoformat(timespec="milliseconds").replace("+00:00", "Z")
    return {
        "id": value.id, "kind": value.kind, "subType": value.sub_type,
        "summary": value.summary, "geometry": _geometry(value),
        "altitudeBandFt": {"floor": value.altitude_floor_ft, "ceiling": value.altitude_ceiling_ft},
        "validFrom": iso(value.valid_from), "validTo": iso(value.valid_to),
        "severity": value.severity,
    }


@pytest.mark.parametrize("vector", CONTRACT["normalizationCases"], ids=lambda item: item["id"])
def test_normalization(vector: dict[str, object]) -> None:
    before = dict(vector["input"])
    assert _portable(normalize_hazard_record(vector["input"])) == vector["expected"]
    assert vector["input"] == before


@pytest.mark.parametrize("vector", CONTRACT["invalidNormalizationCases"], ids=lambda item: item["id"])
def test_invalid_normalization(vector: dict[str, object]) -> None:
    with pytest.raises(HazardValidationError) as raised:
        normalize_hazard_record(vector["input"])
    assert raised.value.code == vector["expectedErrorCode"]


@pytest.mark.parametrize("vector", CONTRACT["severityCases"])
def test_severity(vector: dict[str, object]) -> None:
    assert derive_severity(vector["kind"], vector["subType"]) == vector["expected"]


POLYGON_HAZARD = normalize_hazard_record(CONTRACT["normalizationCases"][0]["input"])


@pytest.mark.parametrize("vector", CONTRACT["evaluationCases"]["active"])
def test_active(vector: dict[str, object]) -> None:
    assert is_hazard_active(POLYGON_HAZARD, _instant(vector["instant"])) is vector["expected"]


@pytest.mark.parametrize("vector", CONTRACT["evaluationCases"]["altitude"])
def test_altitude(vector: dict[str, object]) -> None:
    assert altitude_overlaps(POLYGON_HAZARD, vector["floor"], vector["ceiling"]) is vector["expected"]


@pytest.mark.parametrize("vector", CONTRACT["evaluationCases"]["points"])
def test_point(vector: dict[str, object]) -> None:
    point = LatLon(**vector["point"])
    assert point_in_polygon(point, POLYGON_HAZARD.geometry["coordinates"]) is vector["expected"]


@pytest.mark.parametrize("vector", CONTRACT["evaluationCases"]["legs"], ids=lambda item: item["id"])
def test_leg(vector: dict[str, object]) -> None:
    assert hazard_intersects_leg(
        POLYGON_HAZARD, LatLon(**vector["start"]), LatLon(**vector["end"]),
        12000, 12000, _instant(CONTRACT["referenceTime"])
    ) is vector["expected"]


def test_route_order_and_non_mutation() -> None:
    case = CONTRACT["routeCase"]
    waypoints = [LatLon(**point) for point in case["waypoints"]]
    before = list(waypoints)
    point_hazard = normalize_hazard_record(CONTRACT["normalizationCases"][1]["input"])
    hazards = [point_hazard, POLYGON_HAZARD]
    result = find_route_hazards_in_band(
        waypoints, case["floor"], case["ceiling"], hazards, _instant(CONTRACT["referenceTime"])
    )
    assert [{"id": item.hazard.id, "legStartIndex": item.leg_start_index} for item in result] == case["expected"]
    assert waypoints == before
    assert hazards == [point_hazard, POLYGON_HAZARD]
