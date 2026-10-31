"""Conformance adapter for the Component-owned aviation.navigation vectors."""

from __future__ import annotations

import math

from aviation import navigation
from _conformance_contract import load_conformance_contract

CONTRACT = load_conformance_contract("navigation")

OPERATIONS = {
    "distance_nm": navigation.distance_nm,
    "initial_bearing": navigation.initial_bearing,
    "headwind_component": lambda wind_direction, wind_speed, course: navigation.wind_components(
        wind_direction, wind_speed, course
    )[
        0
    ],
    "crosswind_component": lambda wind_direction, wind_speed, course: navigation.wind_components(
        wind_direction, wind_speed, course
    )[
        1
    ],
    "headwind_component_from_vector": lambda wind_east, wind_north, course: navigation.wind_components_from_vector(
        wind_east, wind_north, course
    )[
        0
    ],
    "crosswind_component_from_vector": lambda wind_east, wind_north, course: navigation.wind_components_from_vector(
        wind_east, wind_north, course
    )[
        1
    ],
    "wind_correction_angle": navigation.wind_correction_angle,
    "true_heading": navigation.true_heading,
    "ground_speed": navigation.ground_speed,
    "normalize_bearing": navigation.normalize_bearing,
    "normalize_longitude": navigation.normalize_longitude,
    "dms_to_decimal": navigation.dms_to_decimal,
    "flight_time": navigation.flight_time,
    "fuel_consumption": navigation.fuel_consumption,
    "fuel_reserve": navigation.fuel_reserve,
    "fuel_range": navigation.fuel_range,
    "vfr_fuel_reserve": navigation.vfr_fuel_reserve,
    "ifr_fuel_reserve": navigation.ifr_fuel_reserve,
    "pressure_altitude": navigation.pressure_altitude,
    "isa_temperature": navigation.isa_temperature,
    "density_altitude": navigation.density_altitude,
    "density_altitude_from_indicated": navigation.density_altitude_from_indicated,
    "tsd_distance": navigation.tsd_distance,
    "ias_to_tas": navigation.ias_to_tas,
    "tas_to_mach": navigation.tas_to_mach,
    "mach_to_tas": navigation.mach_to_tas,
}


def test_component_vector_schema() -> None:
    assert CONTRACT["schema"] == "aviation/navigation-acceptance-vectors@2"
    assert CONTRACT["vectors"]


def test_component_vectors() -> None:
    for vector in CONTRACT["vectors"]:
        operation = OPERATIONS.get(vector["operation"])
        assert operation is not None, f"unsupported operation: {vector['operation']}"
        if vector.get("expected_error"):
            try:
                operation(*vector["args"])
            except (TypeError, ValueError, ZeroDivisionError):
                continue
            raise AssertionError(f"{vector['id']} did not reject invalid input")
        actual = operation(*vector["args"])
        assert math.isfinite(actual), vector["id"]
        assert abs(actual - vector["expected"]) <= vector["absolute_tolerance"], (
            vector["id"],
            actual,
            vector["expected"],
        )
