"""Conformance adapter for the Component-owned aviation.airports vectors."""

from __future__ import annotations

import json
from pathlib import Path

from aviation.airports import AirportDatabase


VECTORS_PATH = (
    Path(__file__).resolve().parents[7]
    / "components"
    / "aviation-airports"
    / "acceptance"
    / "vectors.json"
)
CONTRACT = json.loads(VECTORS_PATH.read_text(encoding="utf-8"))
NORMALIZED = [
    airport
    for record in CONTRACT["dataset"]
    if (airport := AirportDatabase.normalize_airport_record(record)) is not None
]


def _database() -> AirportDatabase:
    database = AirportDatabase()
    database.airports = list(NORMALIZED)
    database.loaded = True
    return database


def test_component_vector_schema() -> None:
    assert CONTRACT["schema"] == "aviation/airports-acceptance-vectors@1"
    assert CONTRACT["vectors"]


def test_component_vectors() -> None:
    database = _database()
    for vector in CONTRACT["vectors"]:
        args = vector.get("args", [])
        if vector["operation"] == "normalized_count":
            assert len(NORMALIZED) == vector["expected"], vector["id"]
        elif vector["operation"] == "lookup":
            airport = database.get_airport_coordinates(str(args[0]))
            actual = (
                {"icao": airport["icao"], "elevation": airport.get("elevation")}
                if airport else None
            )
            assert actual == vector["expected"], vector["id"]
        elif vector["operation"] == "search_codes":
            actual = [
                airport["icao"]
                for airport in database.search_airports(
                    query=str(args[0]), limit=int(args[1])
                )
            ]
            assert actual == vector["expected"], vector["id"]
        else:
            actual = database.search_airports(
                latitude=float(args[0]),
                longitude=float(args[1]),
                radius_nm=float(args[2]),
                limit=int(args[3]),
            )
            expected = vector["expected"]
            assert [airport["icao"] for airport in actual] == [
                airport["icao"] for airport in expected
            ], vector["id"]
            for result, wanted in zip(actual, expected):
                assert abs(result["distance_nm"] - wanted["distance_nm"]) <= wanted[
                    "absolute_tolerance"
                ], vector["id"]
