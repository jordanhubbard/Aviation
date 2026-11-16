"""Conformance adapter for the Component-owned aviation.weather vectors."""

from __future__ import annotations

from aviation.weather import (
    AWCJSONError,
    fetch_awc_json_reports,
    OpenMeteoError,
    OpenMeteoPressureError,
    plan_pressure_level_forecast,
    get_pressure_level_forecast,
    flight_category,
    parse_metar,
    to_weather_data,
    warnings_for_conditions,
)
from _conformance_contract import load_conformance_contract
import copy
import pytest

CONTRACT = load_conformance_contract("weather")


@pytest.mark.parametrize("v", CONTRACT["pressureRequests"], ids=lambda v: v["id"])
def test_pressure_request_and_acquisition(v):
    args = [v[k] for k in ("lat", "lon", "levels", "hours")]
    calls = []
    before = copy.deepcopy(v["levels"])
    assert plan_pressure_level_forecast(*args) == v["expected"]
    payload = CONTRACT["pressureResponses"][0]["payload"]

    def transport(url, params):
        calls.append({"url": url, "params": params})
        return payload

    result = get_pressure_level_forecast(*args, transport)
    assert calls == [{"url": v["expected"]["url"], "params": v["expected"]["params"]}]
    assert result == {
        "url": v["expected"]["url"],
        "data": payload,
        "levels_hpa": v["expected"]["levels_hpa"],
    }
    assert v["levels"] == before


@pytest.mark.parametrize(
    "v", CONTRACT["pressureInvalidRequests"], ids=lambda v: v["id"]
)
def test_pressure_invalid_input_before_transport(v):
    args = [v[k] for k in ("lat", "lon", "levels", "hours")]

    def transport(*args):
        pytest.fail("invalid pressure input reached transport")

    with pytest.raises(OpenMeteoPressureError):
        plan_pressure_level_forecast(*args)
    with pytest.raises(OpenMeteoPressureError) as raised:
        get_pressure_level_forecast(*args, transport)
    assert raised.value.kind == "request"


@pytest.mark.parametrize("v", CONTRACT["pressureResponses"], ids=lambda v: v["id"])
def test_pressure_raw_response(v):
    before = copy.deepcopy(v["payload"])
    result = get_pressure_level_forecast(
        37, -122, v["levels"], v["hours"], lambda *a: v["payload"]
    )
    assert result["data"] == before and v["payload"] == before


@pytest.mark.parametrize(
    "v", CONTRACT["pressureInvalidResponses"], ids=lambda v: v["id"]
)
def test_pressure_invalid_response_without_retry(v):
    calls = []

    def transport(*args):
        calls.append(args)
        return v["payload"]

    with pytest.raises(OpenMeteoPressureError) as raised:
        get_pressure_level_forecast(37, -122, v["levels"], v["hours"], transport)
    assert raised.value.kind == "response" and len(calls) == 1


def test_pressure_provider_errors_are_compatible_and_private():
    calls = []

    def transport(*args):
        calls.append(args)
        raise RuntimeError("private-url?credential=private")

    with pytest.raises(OpenMeteoError) as raised:
        get_pressure_level_forecast(37, -122, [850], 1, transport)
    assert raised.value.kind == "provider" and len(calls) == 1
    assert str(raised.value) == "Open-Meteo pressure-level forecast unavailable"
    assert raised.value.__cause__ is None and raised.value.__context__ is None


@pytest.mark.parametrize("field", ["lat", "lon", "hours", "level"])
@pytest.mark.parametrize("value", [float("nan"), float("inf"), -float("inf"), 10**400])
def test_pressure_unbounded_values_before_transport(field, value):
    values = {"lat": 37, "lon": -122, "levels": [850], "hours": 1}
    if field == "level":
        values["levels"] = [value]
    else:
        values[field] = value

    def transport(*args):
        pytest.fail("unbounded pressure request invoked transport")

    with pytest.raises(OpenMeteoPressureError):
        get_pressure_level_forecast(**values, transport=transport)


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
