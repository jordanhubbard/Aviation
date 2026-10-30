"""Conformance adapter for the Component-owned aviation.weather vectors."""

from __future__ import annotations

import json
from pathlib import Path

from aviation.weather import (
    flight_category,
    parse_metar,
    to_weather_data,
    warnings_for_conditions,
)

VECTORS_PATH = (
    Path(__file__).resolve().parents[7]
    / "components"
    / "aviation-weather"
    / "acceptance"
    / "vectors.json"
)
CONTRACT = json.loads(VECTORS_PATH.read_text(encoding="utf-8"))


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
