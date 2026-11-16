"""Conformance adapter for the Component-owned aviation.weather vectors."""

from __future__ import annotations

from aviation.weather import (
    AWCJSONError,
    fetch_awc_json_reports,
    flight_category,
    parse_metar,
    to_weather_data,
    warnings_for_conditions,
)
from _conformance_contract import load_conformance_contract
import copy
import pytest

CONTRACT = load_conformance_contract("weather")


@pytest.mark.parametrize("vector", CONTRACT["awcRequests"], ids=lambda v: v["id"])
def test_awc_request(vector):
    calls = []

    def transport(url, params):
        calls.append({"url": url, "params": params})
        return []

    result = fetch_awc_json_reports(vector["product"], vector["params"], transport)
    assert calls == [vector["expected"]]
    assert result == {"url": vector["expected"]["url"], "reports": []}


@pytest.mark.parametrize(
    "vector", CONTRACT["awcInvalidRequests"], ids=lambda v: v["id"]
)
def test_awc_invalid_request_does_not_invoke(vector):
    calls = []

    def transport(*args):
        calls.append(args)
        return []

    with pytest.raises(AWCJSONError) as raised:
        fetch_awc_json_reports(vector["product"], vector["params"], transport)
    assert raised.value.kind == "request" and not calls


@pytest.mark.parametrize("vector", CONTRACT["awcResponses"], ids=lambda v: v["id"])
def test_awc_preserves_raw_reports(vector):
    calls = []
    before = copy.deepcopy(vector["payload"])

    def transport(*args):
        calls.append(args)
        return vector["payload"]

    result = fetch_awc_json_reports("taf", {"ids": "KAAA"}, transport)
    assert len(calls) == 1
    assert result["reports"] == before and vector["payload"] == before


@pytest.mark.parametrize(
    "vector", CONTRACT["awcInvalidResponses"], ids=lambda v: v["id"]
)
def test_awc_invalid_response_does_not_retry(vector):
    calls = []

    def transport(*args):
        calls.append(args)
        return vector["payload"]

    with pytest.raises(AWCJSONError) as raised:
        fetch_awc_json_reports("taf", {"ids": "KAAA"}, transport)
    assert raised.value.kind == "response" and len(calls) == 1


def test_awc_hides_transport_failure_without_retry():
    calls = []

    def transport(*args):
        calls.append(args)
        raise RuntimeError("private-provider-url?credential=private")

    with pytest.raises(AWCJSONError) as raised:
        fetch_awc_json_reports("taf", {"ids": "KAAA"}, transport)
    assert raised.value.kind == "provider" and len(calls) == 1
    assert str(raised.value) == "AWC JSON reports unavailable"
    assert raised.value.__cause__ is None and raised.value.__context__ is None


@pytest.mark.parametrize("field", ["distance", "age"])
@pytest.mark.parametrize("value", [float("nan"), float("inf"), -float("inf"), 10**400])
def test_awc_nonfinite_or_huge_values_rejected_before_transport(field, value):
    def transport(*args):
        pytest.fail("invalid request invoked transport")

    with pytest.raises(AWCJSONError):
        fetch_awc_json_reports(
            "pirep", {"id": "KAAA", "distance": 20, "age": 3, field: value}, transport
        )


def test_component_vector_schema() -> None:
    assert CONTRACT["schema"] == "aviation/weather-acceptance-vectors@1"


def test_metar_vectors() -> None:
    for vector in CONTRACT["metars"]:
        parsed = parse_metar(vector["raw"])
        actual = {key: parsed.get(key) for key in vector["expected"]}
        assert actual == vector["expected"], vector["id"]


def test_category_vectors() -> None:
    for vector in CONTRACT["categories"]:
        actual = flight_category(
            visibility_sm=vector["visibility_sm"],
            ceiling_ft=vector["ceiling_ft"],
        )
        assert actual == vector["expected"], vector["id"]


def test_warning_vectors() -> None:
    for vector in CONTRACT["warnings"]:
        actual = warnings_for_conditions(
            visibility_sm=vector["visibility_sm"],
            ceiling_ft=vector["ceiling_ft"],
            wind_speed_kt=vector["wind_speed_kt"],
        )
        assert actual == vector["expected"], vector["id"]


def test_openweathermap_vectors() -> None:
    for vector in CONTRACT["openweathermap"]:
        actual = to_weather_data(vector["airport"], vector["payload"])
        assert actual == vector["expected"], vector["id"]
