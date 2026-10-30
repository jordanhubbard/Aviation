"""Conformance adapter for the Component-owned aviation.weather vectors."""

from __future__ import annotations

from aviation.weather import (
    flight_category,
    parse_metar,
    to_weather_data,
    warnings_for_conditions,
)
from _conformance_contract import load_conformance_contract

CONTRACT = load_conformance_contract("weather")


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
