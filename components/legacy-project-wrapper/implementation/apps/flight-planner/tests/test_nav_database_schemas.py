"""Unit tests for nav_database Pydantic v2 schemas."""
from __future__ import annotations

import pytest

from app.schemas.nav_database import (
    NavAirportSchema,
    NavAirspaceSchema,
    NavDataStatus,
    NavFrequencySchema,
    NavNavaidSchema,
    NavProcedureSchema,
    NavRunwaySchema,
    ProcedureLegSchema,
)


class TestNavRunwaySchema:
    def test_required_fields(self):
        rwy = NavRunwaySchema(identifier="18L")
        assert rwy.identifier == "18L"
        assert rwy.length_ft is None
        assert rwy.width_ft is None
        assert rwy.surface is None
        assert rwy.heading_deg is None

    def test_all_fields(self):
        rwy = NavRunwaySchema(
            identifier="28R",
            length_ft=11870.0,
            width_ft=200.0,
            surface="ASPHALT",
            heading_deg=280.0,
        )
        assert rwy.identifier == "28R"
        assert rwy.length_ft == pytest.approx(11870.0)
        assert rwy.surface == "ASPHALT"

    def test_heading_boundary_valid(self):
        rwy_zero = NavRunwaySchema(identifier="00", heading_deg=0.0)
        assert rwy_zero.heading_deg == pytest.approx(0.0)
        rwy_359 = NavRunwaySchema(identifier="36", heading_deg=359.9)
        assert rwy_359.heading_deg == pytest.approx(359.9)

    def test_heading_360_raises(self):
        with pytest.raises(Exception):
            NavRunwaySchema(identifier="36", heading_deg=360.0)

    def test_heading_negative_raises(self):
        with pytest.raises(Exception):
            NavRunwaySchema(identifier="36", heading_deg=-1.0)

    def test_length_non_negative_raises(self):
        with pytest.raises(Exception):
            NavRunwaySchema(identifier="18L", length_ft=-100.0)

    def test_width_non_negative_raises(self):
        with pytest.raises(Exception):
            NavRunwaySchema(identifier="18L", width_ft=-50.0)

    def test_str_strip_whitespace(self):
        rwy = NavRunwaySchema(identifier="  18L  ")
        assert rwy.identifier == "18L"

    def test_model_dump(self):
        rwy = NavRunwaySchema(identifier="18L", length_ft=10000.0)
        data = rwy.model_dump()
        assert data["identifier"] == "18L"
        assert data["length_ft"] == pytest.approx(10000.0)


class TestNavFrequencySchema:
    def test_basic(self):
        freq = NavFrequencySchema(type="ATIS", frequency_mhz=135.05)
        assert freq.type == "ATIS"
        assert freq.frequency_mhz == pytest.approx(135.05)
        assert freq.description is None

    def test_with_description(self):
        freq = NavFrequencySchema(type="TOWER", description="SFO Tower", frequency_mhz=120.5)
        assert freq.description == "SFO Tower"

    def test_zero_frequency_raises(self):
        with pytest.raises(Exception):
            NavFrequencySchema(type="ATIS", frequency_mhz=0)

    def test_negative_frequency_raises(self):
        with pytest.raises(Exception):
            NavFrequencySchema(type="ATIS", frequency_mhz=-1.0)

    def test_model_dump(self):
        freq = NavFrequencySchema(type="GROUND", frequency_mhz=121.9)
        data = freq.model_dump()
        assert data["type"] == "GROUND"
        assert data["frequency_mhz"] == pytest.approx(121.9)


class TestNavAirportSchema:
    def test_required_fields(self):
        airport = NavAirportSchema(
            icao="KSFO",
            name="San Francisco Intl",
            latitude=37.6213,
            longitude=-122.3790,
        )
        assert airport.icao == "KSFO"
        assert airport.name == "San Francisco Intl"
        assert airport.latitude == pytest.approx(37.6213)
        assert airport.longitude == pytest.approx(-122.3790)
        assert airport.iata is None
        assert airport.city is None
        assert airport.country is None
        assert airport.elevation_ft is None
        assert airport.runways == []
        assert airport.frequencies == []

    def test_all_fields(self):
        rwy = NavRunwaySchema(identifier="28L", length_ft=11870.0)
        freq = NavFrequencySchema(type="ATIS", frequency_mhz=135.05)
        airport = NavAirportSchema(
            icao="KJFK",
            iata="JFK",
            name="John F. Kennedy International",
            city="New York",
            country="US",
            latitude=40.6413,
            longitude=-73.7781,
            elevation_ft=13.0,
            runways=[rwy],
            frequencies=[freq],
        )
        assert airport.icao == "KJFK"
        assert airport.iata == "JFK"
        assert airport.city == "New York"
        assert airport.country == "US"
        assert airport.elevation_ft == pytest.approx(13.0)
        assert len(airport.runways) == 1
        assert len(airport.frequencies) == 1

    def test_missing_required_raises(self):
        with pytest.raises(Exception):
            NavAirportSchema(icao="KSFO")  # missing name, latitude, longitude

    def test_latitude_out_of_range_raises(self):
        with pytest.raises(Exception):
            NavAirportSchema(icao="KSFO", name="Test", latitude=91.0, longitude=0.0)

    def test_latitude_min_boundary(self):
        airport = NavAirportSchema(icao="TEST", name="South Pole", latitude=-90.0, longitude=0.0)
        assert airport.latitude == pytest.approx(-90.0)

    def test_latitude_max_boundary(self):
        airport = NavAirportSchema(icao="TEST", name="North Pole", latitude=90.0, longitude=0.0)
        assert airport.latitude == pytest.approx(90.0)

    def test_longitude_out_of_range_raises(self):
        with pytest.raises(Exception):
            NavAirportSchema(icao="KSFO", name="Test", latitude=0.0, longitude=181.0)

    def test_longitude_boundaries(self):
        airport_west = NavAirportSchema(icao="TEST", name="West", latitude=0.0, longitude=-180.0)
        airport_east = NavAirportSchema(icao="TEST", name="East", latitude=0.0, longitude=180.0)
        assert airport_west.longitude == pytest.approx(-180.0)
        assert airport_east.longitude == pytest.approx(180.0)

    def test_model_dump(self):
        airport = NavAirportSchema(icao="KSFO", name="SFO", latitude=37.6, longitude=-122.4)
        data = airport.model_dump()
        assert data["icao"] == "KSFO"
        assert isinstance(data["runways"], list)
        assert isinstance(data["frequencies"], list)


class TestNavNavaidSchema:
    def test_required_fields(self):
        navaid = NavNavaidSchema(
            identifier="SFO",
            type="VOR",
            latitude=37.619,
            longitude=-122.375,
        )
        assert navaid.identifier == "SFO"
        assert navaid.type == "VOR"
        assert navaid.latitude == pytest.approx(37.619)
        assert navaid.longitude == pytest.approx(-122.375)
        assert navaid.name is None
        assert navaid.frequency is None
        assert navaid.magnetic_variation is None

    def test_all_fields(self):
        navaid = NavNavaidSchema(
            identifier="SFO",
            name="San Francisco VOR",
            type="VOR",
            latitude=37.619,
            longitude=-122.375,
            frequency=115.8,
            magnetic_variation=14.5,
        )
        assert navaid.name == "San Francisco VOR"
        assert navaid.frequency == pytest.approx(115.8)
        assert navaid.magnetic_variation == pytest.approx(14.5)

    def test_various_types(self):
        for nav_type in ("VOR", "NDB", "DME", "FIX", "TACAN", "OTHER"):
            navaid = NavNavaidSchema(
                identifier="TST",
                type=nav_type,
                latitude=0.0,
                longitude=0.0,
            )
            assert navaid.type == nav_type

    def test_latitude_out_of_range_raises(self):
        with pytest.raises(Exception):
            NavNavaidSchema(identifier="TST", type="VOR", latitude=-91.0, longitude=0.0)

    def test_longitude_out_of_range_raises(self):
        with pytest.raises(Exception):
            NavNavaidSchema(identifier="TST", type="VOR", latitude=0.0, longitude=200.0)

    def test_zero_frequency_raises(self):
        with pytest.raises(Exception):
            NavNavaidSchema(identifier="TST", type="VOR", latitude=0.0, longitude=0.0, frequency=0.0)

    def test_model_dump(self):
        navaid = NavNavaidSchema(identifier="SFO", type="VOR", latitude=37.6, longitude=-122.4)
        data = navaid.model_dump()
        assert data["identifier"] == "SFO"
        assert data["type"] == "VOR"


class TestNavAirspaceSchema:
    def test_basic_airspace(self):
        airspace = NavAirspaceSchema(
            identifier="SFO_B",
            name="San Francisco Class B",
            airspace_class="B",
            lower_limit_ft=0.0,
            upper_limit_ft=10000.0,
            coordinates=[(37.0, -122.0), (37.1, -122.1)],
        )
        assert airspace.identifier == "SFO_B"
        assert airspace.airspace_class == "B"
        assert airspace.lower_limit_ft == pytest.approx(0.0)
        assert airspace.upper_limit_ft == pytest.approx(10000.0)
        assert len(airspace.coordinates) == 2

    def test_optional_fields_default(self):
        airspace = NavAirspaceSchema(identifier="TST", airspace_class="G")
        assert airspace.name is None
        assert airspace.lower_limit_ft is None
        assert airspace.upper_limit_ft is None
        assert airspace.coordinates == []

    def test_various_classes(self):
        for cls in ("A", "B", "C", "D", "E", "F", "G"):
            airspace = NavAirspaceSchema(identifier="TST", airspace_class=cls)
            assert airspace.airspace_class == cls

    def test_inverted_altitude_limits_raises(self):
        with pytest.raises(Exception):
            NavAirspaceSchema(
                identifier="BAD",
                airspace_class="C",
                lower_limit_ft=10000.0,
                upper_limit_ft=5000.0,
            )

    def test_equal_altitude_limits_ok(self):
        airspace = NavAirspaceSchema(
            identifier="THIN",
            airspace_class="E",
            lower_limit_ft=5000.0,
            upper_limit_ft=5000.0,
        )
        assert airspace.lower_limit_ft == pytest.approx(5000.0)

    def test_model_dump(self):
        airspace = NavAirspaceSchema(identifier="TST", airspace_class="B")
        data = airspace.model_dump()
        assert data["identifier"] == "TST"
        assert data["airspace_class"] == "B"


class TestProcedureLegSchema:
    def test_basic_leg(self):
        leg = ProcedureLegSchema(fix="DUMBA")
        assert leg.fix == "DUMBA"
        assert leg.path_type is None
        assert leg.altitude_constraint is None
        assert leg.speed_constraint is None

    def test_all_fields(self):
        leg = ProcedureLegSchema(
            fix="GATE1",
            path_type="TF",
            altitude_constraint="AT_OR_ABOVE 3000",
            speed_constraint="AT_OR_BELOW 250",
        )
        assert leg.path_type == "TF"
        assert leg.altitude_constraint == "AT_OR_ABOVE 3000"
        assert leg.speed_constraint == "AT_OR_BELOW 250"

    def test_model_dump(self):
        leg = ProcedureLegSchema(fix="MOLEN", path_type="IF")
        data = leg.model_dump()
        assert data["fix"] == "MOLEN"
        assert data["path_type"] == "IF"


class TestNavProcedureSchema:
    def test_sid_procedure(self):
        leg = ProcedureLegSchema(fix="DUMBA")
        proc = NavProcedureSchema(
            identifier="SIDTEST1",
            airport_icao="KSFO",
            procedure_type="SID",
            transitions=["MOLEN", "REBAS"],
            legs=[leg],
        )
        assert proc.identifier == "SIDTEST1"
        assert proc.airport_icao == "KSFO"
        assert proc.procedure_type == "SID"
        assert proc.transitions == ["MOLEN", "REBAS"]
        assert len(proc.legs) == 1

    def test_required_fields(self):
        proc = NavProcedureSchema(
            identifier="STAR1",
            airport_icao="KJFK",
            procedure_type="STAR",
        )
        assert proc.transitions == []
        assert proc.legs == []

    def test_missing_required_raises(self):
        with pytest.raises(Exception):
            NavProcedureSchema(identifier="P1")  # missing airport_icao, procedure_type

    def test_procedure_types(self):
        for ptype in ("SID", "STAR", "APPROACH"):
            proc = NavProcedureSchema(
                identifier="P1",
                airport_icao="KJFK",
                procedure_type=ptype,
            )
            assert proc.procedure_type == ptype

    def test_model_dump(self):
        proc = NavProcedureSchema(
            identifier="TEST1",
            airport_icao="KSFO",
            procedure_type="SID",
        )
        data = proc.model_dump()
        assert data["identifier"] == "TEST1"
        assert isinstance(data["legs"], list)
        assert isinstance(data["transitions"], list)


class TestNavDataStatus:
    def test_required_fields(self):
        status = NavDataStatus(
            airport_count=100,
            navaid_count=500,
            airspace_count=200,
        )
        assert status.airport_count == 100
        assert status.navaid_count == 500
        assert status.airspace_count == 200
        assert status.last_updated is None
        assert status.source is None

    def test_all_fields(self):
        from datetime import datetime
        ts = datetime(2026, 1, 1, 0, 0, 0)
        status = NavDataStatus(
            airport_count=5000,
            navaid_count=20000,
            airspace_count=3000,
            last_updated=ts,
            source="FAA CIFP 2026-01-01",
        )
        assert status.last_updated == ts
        assert status.source == "FAA CIFP 2026-01-01"

    def test_missing_required_raises(self):
        with pytest.raises(Exception):
            NavDataStatus(airport_count=1)  # missing navaid_count and airspace_count

    def test_negative_counts_raise(self):
        with pytest.raises(Exception):
            NavDataStatus(airport_count=-1, navaid_count=0, airspace_count=0)
        with pytest.raises(Exception):
            NavDataStatus(airport_count=0, navaid_count=-1, airspace_count=0)
        with pytest.raises(Exception):
            NavDataStatus(airport_count=0, navaid_count=0, airspace_count=-1)

    def test_zero_counts_ok(self):
        status = NavDataStatus(airport_count=0, navaid_count=0, airspace_count=0)
        assert status.airport_count == 0

    def test_model_dump(self):
        status = NavDataStatus(airport_count=1, navaid_count=2, airspace_count=3)
        data = status.model_dump()
        assert isinstance(data, dict)
        assert "airport_count" in data
        assert "navaid_count" in data
        assert "airspace_count" in data
        assert "last_updated" in data
        assert "source" in data

    def test_model_json_round_trip(self):
        from datetime import datetime
        ts = datetime(2026, 6, 1, 12, 0, 0)
        status = NavDataStatus(
            airport_count=42,
            navaid_count=100,
            airspace_count=15,
            last_updated=ts,
            source="test-source",
        )
        json_str = status.model_dump_json()
        restored = NavDataStatus.model_validate_json(json_str)
        assert restored.airport_count == 42
        assert restored.navaid_count == 100
        assert restored.source == "test-source"
