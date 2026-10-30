"""Flight Planner procedure compatibility surface over the common SDK."""

from __future__ import annotations

from typing import Any

from aviation.nav_data import NavDataCatalog, sample_nav_data_catalog


def _planner_record(record: dict[str, Any]) -> dict[str, Any]:
    return {
        "name": record["identifier"],
        "legs": [
            {
                "fix": leg["fix"],
                "altitude": (
                    leg.get("altitude_ft")
                    if leg.get("altitude_ft") is not None
                    else record.get("initial_altitude_ft") or 0
                ),
                "course": leg.get("course_deg") or 0,
            }
            for leg in record["legs"]
        ],
    }


class Procedures:
    """Preserve the application API while the SDK owns procedure selection."""

    def __init__(self, catalog: NavDataCatalog | None = None) -> None:
        self.catalog = catalog or sample_nav_data_catalog()

    def _get(self, airport_code: str, procedure_type: str) -> list[dict[str, Any]]:
        return [
            _planner_record(record)
            for record in self.catalog.procedures_for_airport(
                airport_code, procedure_type
            )
        ]

    def get_sids(self, airport_code: str) -> list[dict[str, Any]]:
        return self._get(airport_code, "SID")

    def get_stars(self, airport_code: str) -> list[dict[str, Any]]:
        return self._get(airport_code, "STAR")

    def get_approaches(self, airport_code: str) -> list[dict[str, Any]]:
        return self._get(airport_code, "APPROACH")
