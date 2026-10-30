"""Flight Planner navigation-database compatibility surface over the SDK."""

from __future__ import annotations

from typing import Any

from aviation.airports import AirportDatabase
from aviation.nav_data import NavDataCatalog, sample_nav_data_catalog
from app.schemas.nav_database import (
    NavAirportSchema,
    NavDataProceduresResponse,
    NavDataSearchResponse,
    NavNavaidSchema,
    NavProcedureSchema,
    ProcedureLegSchema,
)


class NavDatabase:
    """Adapt common airport and nav-data catalogs to application Pydantic schemas."""

    def __init__(
        self,
        catalog: NavDataCatalog | None = None,
        airports: AirportDatabase | None = None,
    ) -> None:
        self.catalog = catalog or sample_nav_data_catalog()
        self.airports = airports or AirportDatabase()

    @staticmethod
    def _airport(record: dict[str, Any]) -> NavAirportSchema:
        return NavAirportSchema(
            icao=record.get("icao") or "",
            iata=record.get("iata") or None,
            name=record.get("name") or "",
            city=record.get("city") or None,
            country=record.get("country") or None,
            latitude=record["latitude"],
            longitude=record["longitude"],
            elevation_ft=record.get("elevation"),
        )

    @staticmethod
    def _navaid(record: dict[str, Any]) -> NavNavaidSchema:
        return NavNavaidSchema(**record)

    @staticmethod
    def _procedure(record: dict[str, Any]) -> NavProcedureSchema:
        return NavProcedureSchema(
            identifier=record["identifier"],
            airport_icao=record["airport_icao"],
            procedure_type=record["procedure_type"],
            transitions=record["transitions"],
            legs=[ProcedureLegSchema(**leg) for leg in record["legs"]],
        )

    def search(self, query: str) -> NavDataSearchResponse:
        return NavDataSearchResponse(
            airports=[self._airport(record) for record in self.airports.search(query)],
            navaids=[
                self._navaid(record) for record in self.catalog.search_navaids(query)
            ],
        )

    def get_procedures(self, airport_code: str) -> NavDataProceduresResponse:
        airport_record = self.airports.get_airport_coordinates(airport_code)
        records = self.catalog.procedures_for_airport(airport_code)
        return NavDataProceduresResponse(
            airport=self._airport(airport_record) if airport_record else None,
            sids=[
                self._procedure(record)
                for record in records
                if record["procedure_type"] == "SID"
            ],
            stars=[
                self._procedure(record)
                for record in records
                if record["procedure_type"] == "STAR"
            ],
            approaches=[
                self._procedure(record)
                for record in records
                if record["procedure_type"] == "APPROACH"
            ],
        )
