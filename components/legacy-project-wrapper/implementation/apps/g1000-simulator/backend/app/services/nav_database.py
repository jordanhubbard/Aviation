"""G1000 HTTP compatibility surface over the common Aviation SDK catalogs."""

from __future__ import annotations

from typing import Any

from aviation.airports import AirportDatabase
from aviation.nav_data import NavDataCatalog, sample_nav_data_catalog


def _airport_dict(airport: dict[str, Any]) -> dict[str, Any]:
    return {
        "icao": airport.get("icao", ""),
        "iata": airport.get("iata", ""),
        "name": airport.get("name", ""),
        "latitude": airport.get("latitude"),
        "longitude": airport.get("longitude"),
        "elevation": airport.get("elevation"),
    }


def _procedure_dict(record: dict[str, Any]) -> dict[str, Any]:
    return {
        "name": record["identifier"],
        "type": record["procedure_type"],
        "runway": record.get("runway"),
        "initial_altitude": record.get("initial_altitude_ft"),
        "waypoints": [leg["fix"] for leg in record["legs"]],
    }


class NavigationDatabaseService:
    """Adapt shared airports and navigation data to the established G1000 API."""

    def __init__(
        self,
        catalog: NavDataCatalog | None = None,
        airports: AirportDatabase | None = None,
    ) -> None:
        self.catalog = catalog or sample_nav_data_catalog()
        self.airports = airports or AirportDatabase()

    def search(self, query: str) -> dict[str, list[dict[str, Any]]]:
        airport_matches = [
            _airport_dict(airport) for airport in self.airports.search(query, limit=20)
        ]
        navaid_matches = [dict(record) for record in self.catalog.search_navaids(query)]
        return {"airports": airport_matches, "navaids": navaid_matches}

    def get_procedures(self, airport_code: str) -> dict[str, Any]:
        airport = self.airports.get_airport_coordinates(airport_code)
        records = self.catalog.procedures_for_airport(airport_code)
        return {
            "airport": _airport_dict(airport) if airport else None,
            "sids": [
                _procedure_dict(record)
                for record in records
                if record["procedure_type"] == "SID"
            ],
            "stars": [
                _procedure_dict(record)
                for record in records
                if record["procedure_type"] == "STAR"
            ],
            "approaches": [
                _procedure_dict(record)
                for record in records
                if record["procedure_type"] == "APPROACH"
            ],
        }
