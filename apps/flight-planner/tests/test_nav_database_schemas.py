"""Unit tests for nav_database Pydantic v2 schemas."""
from __future__ import annotations

import pytest

from app.schemas.nav_database import (
    AirspaceClass,
    GeoPointSchema,
    NavAirportSchema,
    NavAirspaceSchema,
    NavDataStoreSchema,
    NavNavaidSchema,
    NavProcedureSchema,
    NavaidType,
    ProcedureAltitudeConstraintSchema,
    ProcedureAltitudeConstraintType,
    ProcedureLegSchema,
    ProcedureSpeedConstraintSchema,
    ProcedureSpeedConstraintType,
    ProcedureType,
)


class TestGeoPointSchema:
    def test_basic(self):
        gp = GeoPointSchema(latitude=37.6, longitude=-122.4)
        assert gp.latitude == pytest.approx(37.6)
        assert gp.longitude == pytest.approx(-122.4)

    def test_required_fields(self):
        with pytest.raises(Exception):
            GeoPointSchema(latitude=0.0)  # missing longitude


class TestNavAirportSchema:
    def test_required_fields(self):
        gp = GeoPointSchema(latitude=37.6213, longitude=-122.3790)
        airport = NavAirportSchema(icao="KSFO", name="San Francisco Intl", location=gp, sources=[])
        assert airport.icao == "KSFO"
        assert airport.name == "San Francisco Intl"
        assert airport.location.latitude == pytest.approx(37.6213)
        assert airport.iata is None
        assert airport.elevation_ft is None
        assert airport.type is None
        assert airport.country is None

    def test_all_fields(self):
        gp = GeoPointSchema(latitude=40.6413, longitude=-73.7781)
        airport = NavAirportSchema(
            icao="KJFK",
            iata="JFK",
            name="John F. Kennedy International",
            location=gp,
            elevationFt=13,
            type="large_airport",
            country="US",
            sources=["openflights"],
        )
        assert airport.icao == "KJFK"
        assert airport.iata == "JFK"
        assert airport.elevation_ft == 13
        assert airport.country == "US"
        assert airport.sources == ["openflights"]

    def test_alias_elevation_ft(self):
        gp = GeoPointSchema(latitude=0.0, longitude=0.0)
        airport = NavAirportSchema(icao="KZZZ", name="Test", location=gp, elevationFt=100, sources=[])
        assert airport.elevation_ft == 100

    def test_missing_required_raises(self):
        with pytest.raises(Exception):
            NavAirportSchema(icao="KSFO", sources=[])  # missing name and location


class TestNavNavaidSchema:
    def test_vor_navaid(self):
        pos = GeoPointSchema(latitude=37.619, longitude=-122.375)
        navaid = NavNavaidSchema(
            identifier="SFO",
            name="San Francisco VOR",
            type=NavaidType.VOR,
            position=pos,
            frequency=115.8,
            frequencyUnit="MHz",
            sources=["dafif"],
        )
        assert navaid.identifier == "SFO"
        assert navaid.type == NavaidType.VOR
        assert navaid.frequency == pytest.approx(115.8)
        assert navaid.frequency_unit == "MHz"

    def test_navaid_type_enum_values(self):
        pos = GeoPointSchema(latitude=0.0, longitude=0.0)
        for nav_type in NavaidType:
            navaid = NavNavaidSchema(identifier="TST", type=nav_type, position=pos, sources=[])
            assert navaid.type == nav_type

    def test_optional_fields_default_none(self):
        pos = GeoPointSchema(latitude=0.0, longitude=0.0)
        navaid = NavNavaidSchema(identifier="TST", type=NavaidType.FIX, position=pos, sources=[])
        assert navaid.name is None
        assert navaid.frequency is None
        assert navaid.frequency_unit is None


class TestNavAirspaceSchema:
    def test_basic_airspace(self):
        pt = GeoPointSchema(latitude=37.0, longitude=-122.0)
        airspace = NavAirspaceSchema(
            identifier="SFO_B",
            name="San Francisco Class B",
            **{"class": AirspaceClass.B},
            lowerLimitFt=0,
            upperLimitFt=10000,
            boundary=[pt],
            sources=["faa"],
        )
        assert airspace.identifier == "SFO_B"
        assert airspace.airspace_class == AirspaceClass.B
        assert airspace.lower_limit_ft == 0
        assert airspace.upper_limit_ft == 10000
        assert len(airspace.boundary) == 1

    def test_all_airspace_classes(self):
        pt = GeoPointSchema(latitude=0.0, longitude=0.0)
        for cls in AirspaceClass:
            airspace = NavAirspaceSchema(
                identifier="TST",
                **{"class": cls},
                boundary=[pt],
                sources=[],
            )
            assert airspace.airspace_class == cls

    def test_optional_limits(self):
        pt = GeoPointSchema(latitude=0.0, longitude=0.0)
        airspace = NavAirspaceSchema(identifier="TST", **{"class": AirspaceClass.G}, boundary=[pt], sources=[])
        assert airspace.lower_limit_ft is None
        assert airspace.upper_limit_ft is None


class TestProcedureLegSchema:
    def test_basic_leg(self):
        leg = ProcedureLegSchema(fix="DUMBA")
        assert leg.fix == "DUMBA"
        assert leg.path_type is None
        assert leg.altitude_constraint is None
        assert leg.speed_constraint is None

    def test_leg_with_path_type_alias(self):
        leg = ProcedureLegSchema(fix="GATE1", pathType="TF")
        assert leg.path_type == "TF"

    def test_leg_with_altitude_constraint(self):
        alt = ProcedureAltitudeConstraintSchema(
            type=ProcedureAltitudeConstraintType.AT_OR_ABOVE,
            altitudeFt=3000.0,
        )
        leg = ProcedureLegSchema(fix="GATE1", altitudeConstraint=alt)
        assert leg.altitude_constraint.altitude_ft == pytest.approx(3000.0)
        assert leg.altitude_constraint.type == ProcedureAltitudeConstraintType.AT_OR_ABOVE

    def test_leg_with_speed_constraint(self):
        spd = ProcedureSpeedConstraintSchema(
            type=ProcedureSpeedConstraintType.AT_OR_BELOW,
            speedKts=250.0,
        )
        leg = ProcedureLegSchema(fix="CF", speedConstraint=spd)
        assert leg.speed_constraint.speed_kts == pytest.approx(250.0)


class TestNavProcedureSchema:
    def test_sid_procedure(self):
        leg = ProcedureLegSchema(fix="DUMBA")
        proc = NavProcedureSchema(
            identifier="SIDTEST1",
            airportIcao="KSFO",
            type=ProcedureType.SID,
            name="Test SID",
            legs=[leg],
            sources=["cifp"],
        )
        assert proc.identifier == "SIDTEST1"
        assert proc.airport_icao == "KSFO"
        assert proc.type == ProcedureType.SID
        assert proc.name == "Test SID"
        assert len(proc.legs) == 1

    def test_optional_fields(self):
        proc = NavProcedureSchema(
            identifier="STAR1",
            type=ProcedureType.STAR,
            sources=[],
        )
        assert proc.airport_icao is None
        assert proc.transition is None
        assert proc.fixes is None
        assert proc.legs is None
        assert proc.raw_records is None

    def test_procedure_type_enum(self):
        for ptype in ProcedureType:
            proc = NavProcedureSchema(identifier="P1", type=ptype, sources=[])
            assert proc.type == ptype

    def test_alias_raw_records(self):
        proc = NavProcedureSchema(
            identifier="P1",
            type=ProcedureType.APPROACH,
            rawRecords=["raw data"],
            sources=[],
        )
        assert proc.raw_records == ["raw data"]


class TestNavDataStoreSchema:
    def test_empty_store(self):
        store = NavDataStoreSchema()
        assert store.airports_by_icao == {}
        assert store.navaids_by_ident == {}
        assert store.airspaces == []
        assert store.procedures_by_airport == {}

    def test_populated_store(self):
        gp = GeoPointSchema(latitude=37.6, longitude=-122.4)
        airport = NavAirportSchema(icao="KSFO", name="SFO", location=gp, sources=["test"])
        navaid = NavNavaidSchema(identifier="SFO", type=NavaidType.VOR, position=gp, sources=["test"])
        airspace = NavAirspaceSchema(identifier="SFO_B", **{"class": AirspaceClass.B}, boundary=[gp], sources=["test"])
        leg = ProcedureLegSchema(fix="DUMBA")
        proc = NavProcedureSchema(identifier="SID1", type=ProcedureType.SID, airportIcao="KSFO", legs=[leg], sources=["test"])

        store = NavDataStoreSchema(
            airportsByIcao={"KSFO": airport},
            navaidsByIdent={"SFO": navaid},
            airspaces=[airspace],
            proceduresByAirport={"KSFO": [proc]},
        )
        assert "KSFO" in store.airports_by_icao
        assert "SFO" in store.navaids_by_ident
        assert len(store.airspaces) == 1
        assert "KSFO" in store.procedures_by_airport

    def test_model_dump(self):
        store = NavDataStoreSchema()
        data = store.model_dump()
        assert isinstance(data, dict)
        assert "airports_by_icao" in data
        assert "navaids_by_ident" in data
        assert "airspaces" in data
        assert "procedures_by_airport" in data
