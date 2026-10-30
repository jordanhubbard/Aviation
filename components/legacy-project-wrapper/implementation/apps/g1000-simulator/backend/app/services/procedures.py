"""G1000 procedure compatibility surface over ``aviation.nav_data``."""

from __future__ import annotations

from typing import Any

from aviation.nav_data import NavDataCatalog, sample_nav_data_catalog


def _compatibility_record(record: dict[str, Any]) -> dict[str, Any]:
    return {
        "name": record["identifier"],
        "type": record["procedure_type"],
        "runway": record.get("runway"),
        "initial_altitude": record.get("initial_altitude_ft"),
        "waypoints": [leg["fix"] for leg in record["legs"]],
    }


class ProceduresService:
    """Preserve the application API while the SDK owns catalog behavior."""

    def __init__(self, catalog: NavDataCatalog | None = None) -> None:
        self.catalog = catalog or sample_nav_data_catalog()

    def _get(
        self, airport_code: str, procedure_type: str, runway: str | None = None
    ) -> list[dict[str, Any]]:
        return [
            _compatibility_record(record)
            for record in self.catalog.procedures_for_airport(
                airport_code, procedure_type, runway
            )
        ]

    def get_sid(
        self, airport_code: str, runway: str | None = None
    ) -> list[dict[str, Any]]:
        return self._get(airport_code, "SID", runway)

    def get_star(
        self, airport_code: str, runway: str | None = None
    ) -> list[dict[str, Any]]:
        return self._get(airport_code, "STAR", runway)

    def get_approach(
        self, airport_code: str, runway: str | None = None
    ) -> list[dict[str, Any]]:
        return self._get(airport_code, "APPROACH", runway)

    def get_all_procedures(self, airport_code: str) -> dict[str, list[dict[str, Any]]]:
        return {
            "sids": self.get_sid(airport_code),
            "stars": self.get_star(airport_code),
            "approaches": self.get_approach(airport_code),
        }
