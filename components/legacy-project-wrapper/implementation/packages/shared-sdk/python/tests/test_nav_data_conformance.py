"""Conformance adapter for the Component-owned aviation.nav-data vectors."""

from __future__ import annotations

from aviation.nav_data import NavDataCatalog, freshness_status
from _conformance_contract import load_conformance_contract

CONTRACT = load_conformance_contract("nav-data")


def test_component_vector_schema() -> None:
    assert CONTRACT["schema"] == "aviation/nav-data-acceptance-vectors@1"


def test_normalization_vectors() -> None:
    catalog = NavDataCatalog(CONTRACT["bundle"])
    expected = CONTRACT["expected"]
    assert [record["identifier"] for record in catalog.navaids] == expected[
        "navaid_identifiers"
    ]
    assert [record["type"] for record in catalog.navaids] == expected["navaid_types"]
    assert [record["identifier"] for record in catalog.procedures] == expected[
        "procedure_identifiers"
    ]
    assert [record["procedure_type"] for record in catalog.procedures] == expected[
        "procedure_types"
    ]
    assert [
        feature["properties"]["id"] for feature in catalog.airspace["features"]
    ] == expected["airspace_feature_ids"]


def test_catalog_query_vectors() -> None:
    catalog = NavDataCatalog(CONTRACT["bundle"])
    search = CONTRACT["expected"]["search"]
    assert [
        record["identifier"] for record in catalog.search_navaids(search["query"])
    ] == search["identifiers"]
    procedure_filter = CONTRACT["expected"]["procedure_filter"]
    assert [
        record["identifier"]
        for record in catalog.procedures_for_airport(
            procedure_filter["airport_icao"],
            procedure_filter["procedure_type"],
            procedure_filter["runway"],
        )
    ] == procedure_filter["identifiers"]


def test_status_vector() -> None:
    catalog = NavDataCatalog(CONTRACT["bundle"])
    expected = CONTRACT["expected"]["status"]
    status = catalog.status("2026-10-30T12:00:00Z")
    assert {key: status[key] for key in expected} == expected


def test_freshness_vectors() -> None:
    for vector in CONTRACT["freshness"]:
        assert (
            freshness_status(vector["metadata"], vector["at"]) == vector["expected"]
        ), vector["id"]
