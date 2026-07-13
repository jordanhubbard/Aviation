"""Navigation database service for the flight-planner backend."""
from __future__ import annotations

from typing import Dict, List

from app.schemas.nav_database import (
    NavAirportSchema,
    NavNavaidSchema,
    NavaidType,
    NavDataProceduresResponse,
    NavDataSearchResponse,
    NavProcedureSchema,
)


class NavDatabase:
    """In-memory navigation database with sample data."""

    def __init__(self) -> None:
        self._airports: Dict[str, NavAirportSchema] = {}
        self._navaids: Dict[str, NavNavaidSchema] = {}
        self._initialize_sample_data()

    def _initialize_sample_data(self) -> None:
        """Seed with representative sample navigation data."""
        airports = [
            NavAirportSchema(icao="KJFK", iata="JFK", name="John F. Kennedy International",
                             latitude=40.6413, longitude=-73.7781, elevation_ft=13),
            NavAirportSchema(icao="KLAX", iata="LAX", name="Los Angeles International",
                             latitude=33.9425, longitude=-118.4081, elevation_ft=125),
            NavAirportSchema(icao="KSFO", iata="SFO", name="San Francisco International",
                             latitude=37.6213, longitude=-122.3790, elevation_ft=8),
            NavAirportSchema(icao="KORD", iata="ORD", name="Chicago O'Hare International",
                             latitude=41.9742, longitude=-87.9073, elevation_ft=682),
        ]
        for airport in airports:
            self._airports[airport.icao] = airport

        navaids = [
            NavNavaidSchema(identifier="JFK", name="JFK VOR", type=NavaidType.VOR,
                            latitude=40.6413, longitude=-73.7781, frequency="110.9",
                            airport_icao="KJFK"),
            NavNavaidSchema(identifier="LAX", name="LAX VOR", type=NavaidType.VOR,
                            latitude=33.9425, longitude=-118.4081, frequency="113.6",
                            airport_icao="KLAX"),
            NavNavaidSchema(identifier="SFO", name="San Francisco VOR", type=NavaidType.VORDME,
                            latitude=37.6190, longitude=-122.3750, frequency="115.8",
                            airport_icao="KSFO"),
            NavNavaidSchema(identifier="ORD", name="Chicago O'Hare VOR", type=NavaidType.VORTAC,
                            latitude=41.9742, longitude=-87.9073, frequency="113.9",
                            airport_icao="KORD"),
        ]
        for navaid in navaids:
            self._navaids[navaid.identifier] = navaid

    def search(self, query: str) -> NavDataSearchResponse:
        """Search airports and navaids matching *query*.

        Matches against ICAO code, IATA code, name (airports) and identifier,
        name (navaids) case-insensitively.

        Returns:
            NavDataSearchResponse with matching airports and navaids.
        """
        q = query.upper()

        matching_airports: List[NavAirportSchema] = [
            a for a in self._airports.values()
            if q in a.icao
            or (a.iata and q in a.iata)
            or (a.name and q in a.name.upper())
        ]

        matching_navaids: List[NavNavaidSchema] = [
            n for n in self._navaids.values()
            if q in n.identifier
            or (n.name and q in n.name.upper())
        ]

        return NavDataSearchResponse(airports=matching_airports, navaids=matching_navaids)

    def get_procedures(self, airport_code: str) -> NavDataProceduresResponse:
        """Retrieve instrument procedures for *airport_code*.

        Returns:
            NavDataProceduresResponse with SIDs, STARs, and approaches.
        """
        airport = self._airports.get(airport_code.upper())

        sids = [
            NavProcedureSchema(name="DEPARTURE1", type="SID", runway="04L", initial_altitude_ft=2000),
            NavProcedureSchema(name="DEPARTURE2", type="SID", runway="04R", initial_altitude_ft=2000),
        ]
        stars = [
            NavProcedureSchema(name="ARRIVAL1", type="STAR", runway="22L", initial_altitude_ft=5000),
            NavProcedureSchema(name="ARRIVAL2", type="STAR", runway="22R", initial_altitude_ft=5000),
        ]
        approaches = [
            NavProcedureSchema(name="ILS 04L", type="APPROACH", runway="04L"),
            NavProcedureSchema(name="VOR 22L", type="APPROACH", runway="22L"),
        ]

        return NavDataProceduresResponse(
            airport=airport,
            sids=sids,
            stars=stars,
            approaches=approaches,
        )
