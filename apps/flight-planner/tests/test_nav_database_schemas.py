"""Unit tests for nav_database Pydantic v2 schemas and NavDatabase service."""
from __future__ import annotations

import pytest

from app.schemas.nav_database import (
    AirspaceClass,
    NavAirportSchema,
    NavAirspaceSchema,
    NavaidType,
    NavDataProceduresResponse,
    NavDataSearchResponse,
    NavNavaidSchema,
    NavProcedureSchema,
)
from app.services.nav_database import NavDatabase


# ---------------------------------------------------------------------------
# Schema construction tests
# ---------------------------------------------------------------------------


class TestNavAirportSchema:
    def test_required_fields(self):
        airport = NavAirportSchema(icao="KSFO", latitude=37.6213, longitude=-122.3790)
        assert airport.icao == "KSFO"
        assert airport.latitude == pytest.approx(37.6213)
        assert airport.longitude == pytest.approx(-122.3790)
        assert airport.iata is None
        assert airport.name is None
        assert airport.elevation_ft is None

    def test_all_fields(self):
        airport = NavAirportSchema(
            icao="KJFK",
            iata="JFK",
            name="John F. Kennedy International",
            latitude=40.6413,
            longitude=-73.7781,
            elevation_ft=13,
        )
        assert airport.icao == "KJFK"
        assert airport.iata == "JFK"
        assert airport.name == "John F. Kennedy International"
        assert airport.elevation_ft == 13

    def test_missing_required_fields_raises(self):
        with pytest.raises(Exception):
            NavAirportSchema(icao="KSFO")  # missing latitude/longitude


class TestNavNavaidSchema:
    def test_vor_navaid(self):
        navaid = NavNavaidSchema(
            identifier="SFO",
            name="San Francisco VOR",
            type=NavaidType.VORDME,
            latitude=37.619,
            longitude=-122.375,
            frequency="115.8",
        )
        assert navaid.identifier == "SFO"
        assert navaid.type == NavaidType.VORDME
        assert navaid.frequency == "115.8"
        assert navaid.airport_icao is None

    def test_navaid_with_airport(self):
        navaid = NavNavaidSchema(
            identifier="JFK",
            type=NavaidType.VOR,
            latitude=40.6413,
            longitude=-73.7781,
            airport_icao="KJFK",
        )
        assert navaid.airport_icao == "KJFK"

    def test_navaid_type_enum_values(self):
        for nav_type in NavaidType:
            navaid = NavNavaidSchema(
                identifier="TST",
                type=nav_type,
                latitude=0.0,
                longitude=0.0,
            )
            assert navaid.type == nav_type


class TestNavAirspaceSchema:
    def test_basic_airspace(self):
        airspace = NavAirspaceSchema(
            identifier="SFO_B",
            name="San Francisco Class B",
            airspace_class=AirspaceClass.B,
            lower_limit_ft=0,
            upper_limit_ft=10000,
        )
        assert airspace.identifier == "SFO_B"
        assert airspace.airspace_class == AirspaceClass.B
        assert airspace.lower_limit_ft == 0
        assert airspace.upper_limit_ft == 10000
        assert airspace.controlling_facility is None

    def test_all_airspace_classes(self):
        for cls in AirspaceClass:
            airspace = NavAirspaceSchema(
                identifier="TST",
                airspace_class=cls,
                lower_limit_ft=0,
                upper_limit_ft=5000,
            )
            assert airspace.airspace_class == cls


class TestNavProcedureSchema:
    def test_sid_procedure(self):
        proc = NavProcedureSchema(name="DEPARTURE1", type="SID", runway="04L", initial_altitude_ft=2000)
        assert proc.name == "DEPARTURE1"
        assert proc.type == "SID"
        assert proc.runway == "04L"
        assert proc.initial_altitude_ft == 2000

    def test_approach_no_initial_altitude(self):
        proc = NavProcedureSchema(name="ILS 22L", type="APPROACH", runway="22L")
        assert proc.initial_altitude_ft is None


class TestNavDataSearchResponse:
    def test_empty_response(self):
        resp = NavDataSearchResponse()
        assert resp.airports == []
        assert resp.navaids == []

    def test_populated_response(self):
        airport = NavAirportSchema(icao="KSFO", latitude=37.6213, longitude=-122.3790)
        navaid = NavNavaidSchema(identifier="SFO", type=NavaidType.VOR, latitude=37.619, longitude=-122.375)
        resp = NavDataSearchResponse(airports=[airport], navaids=[navaid])
        assert len(resp.airports) == 1
        assert len(resp.navaids) == 1


class TestNavDataProceduresResponse:
    def test_empty_response(self):
        resp = NavDataProceduresResponse()
        assert resp.airport is None
        assert resp.sids == []
        assert resp.stars == []
        assert resp.approaches == []


# ---------------------------------------------------------------------------
# NavDatabase service tests
# ---------------------------------------------------------------------------


class TestNavDatabase:
    def setup_method(self):
        self.db = NavDatabase()

    def test_search_by_icao(self):
        result = self.db.search("KJFK")
        assert isinstance(result, NavDataSearchResponse)
        assert any(a.icao == "KJFK" for a in result.airports)

    def test_search_returns_typed_schemas(self):
        result = self.db.search("KSFO")
        for airport in result.airports:
            assert isinstance(airport, NavAirportSchema)
        for navaid in result.navaids:
            assert isinstance(navaid, NavNavaidSchema)

    def test_search_by_name_substring(self):
        result = self.db.search("Francisco")
        assert any("Francisco" in (a.name or "") for a in result.airports)

    def test_search_no_match_returns_empty_lists(self):
        result = self.db.search("ZZZZ_NOMATCH")
        assert result.airports == []
        assert result.navaids == []

    def test_search_case_insensitive(self):
        result_upper = self.db.search("kjfk")
        result_lower = self.db.search("KJFK")
        assert len(result_upper.airports) == len(result_lower.airports)

    def test_get_procedures_known_airport(self):
        result = self.db.get_procedures("KJFK")
        assert isinstance(result, NavDataProceduresResponse)
        assert result.airport is not None
        assert result.airport.icao == "KJFK"
        assert len(result.sids) > 0
        assert len(result.stars) > 0
        assert len(result.approaches) > 0

    def test_get_procedures_returns_typed_schemas(self):
        result = self.db.get_procedures("KLAX")
        for sid in result.sids:
            assert isinstance(sid, NavProcedureSchema)
        for star in result.stars:
            assert isinstance(star, NavProcedureSchema)
        for approach in result.approaches:
            assert isinstance(approach, NavProcedureSchema)

    def test_get_procedures_unknown_airport_has_no_airport(self):
        result = self.db.get_procedures("ZZZZ")
        assert isinstance(result, NavDataProceduresResponse)
        assert result.airport is None
        assert len(result.sids) > 0

    def test_get_procedures_case_insensitive(self):
        result_lower = self.db.get_procedures("kjfk")
        result_upper = self.db.get_procedures("KJFK")
        assert (result_lower.airport is not None) == (result_upper.airport is not None)

    def test_search_navaid_by_identifier(self):
        result = self.db.search("JFK")
        assert any(n.identifier == "JFK" for n in result.navaids)

    def test_schemas_are_pydantic_v2(self):
        airport = NavAirportSchema(icao="KORD", latitude=41.9742, longitude=-87.9073)
        data = airport.model_dump()
        assert isinstance(data, dict)
        assert data["icao"] == "KORD"
