"""Provider-neutral navigation-data records, ingestion, and catalog queries."""

from __future__ import annotations

from datetime import datetime, timezone
from math import isfinite
from typing import Any, Mapping, Sequence


def _canonical(value: Any, field: str) -> str:
    result = str(value or "").strip().upper()
    if not result:
        raise ValueError(f"{field} is required")
    return result


def _optional_canonical(value: Any) -> str | None:
    if value is None or not str(value).strip():
        return None
    return str(value).strip().upper()


def _optional_string(value: Any) -> str | None:
    if value is None or not str(value).strip():
        return None
    return str(value).strip()


def _finite_number(value: Any, field: str) -> float:
    try:
        result = float(value)
    except (TypeError, ValueError) as error:
        raise ValueError(f"{field} must be finite") from error
    if not isfinite(result):
        raise ValueError(f"{field} must be finite")
    return result


def _optional_number(value: Any, field: str) -> float | None:
    if value is None or value == "":
        return None
    return _finite_number(value, field)


def _instant(value: str, field: str) -> datetime:
    try:
        result = datetime.fromisoformat(value.replace("Z", "+00:00"))
    except (TypeError, ValueError) as error:
        raise ValueError(f"{field} must be an ISO-8601 instant") from error
    if result.tzinfo is None:
        raise ValueError(f"{field} must include a timezone")
    return result.astimezone(timezone.utc)


def normalize_metadata(raw: Mapping[str, Any]) -> dict[str, Any]:
    source = str(raw.get("source") or "").strip()
    if not source:
        raise ValueError("metadata.source is required")
    metadata = {
        "source": source,
        "cycle": _optional_string(raw.get("cycle")),
        "retrieved_at": _optional_string(raw.get("retrieved_at")),
        "effective_from": _optional_string(raw.get("effective_from")),
        "effective_through": _optional_string(raw.get("effective_through")),
    }
    for field in ("retrieved_at", "effective_from", "effective_through"):
        if metadata[field]:
            _instant(metadata[field], field)
    if (
        metadata["effective_from"]
        and metadata["effective_through"]
        and _instant(metadata["effective_from"], "effective_from")
        > _instant(metadata["effective_through"], "effective_through")
    ):
        raise ValueError("effective_from must not follow effective_through")
    return metadata


def freshness_status(
    metadata: Mapping[str, Any], at: str | datetime | None = None
) -> str:
    normalized = normalize_metadata(metadata)
    if at is None:
        reference = datetime.now(timezone.utc)
    elif isinstance(at, datetime):
        if at.tzinfo is None:
            raise ValueError("at must include a timezone")
        reference = at.astimezone(timezone.utc)
    else:
        reference = _instant(at, "at")
    if normalized["effective_from"] and reference < _instant(
        normalized["effective_from"], "effective_from"
    ):
        return "future"
    if normalized["effective_through"] and reference > _instant(
        normalized["effective_through"], "effective_through"
    ):
        return "expired"
    if not normalized["effective_from"] and not normalized["effective_through"]:
        return "undated"
    return "current"


def normalize_navaid(raw: Mapping[str, Any]) -> dict[str, Any]:
    latitude = _finite_number(raw.get("latitude"), "latitude")
    longitude = _finite_number(raw.get("longitude"), "longitude")
    if not -90 <= latitude <= 90:
        raise ValueError("latitude must be in [-90, 90]")
    if not -180 <= longitude <= 180:
        raise ValueError("longitude must be in [-180, 180]")
    frequency = _optional_number(raw.get("frequency"), "frequency")
    if frequency is not None and frequency <= 0:
        raise ValueError("frequency must be positive")
    return {
        "identifier": _canonical(raw.get("identifier"), "identifier"),
        "name": _optional_string(raw.get("name")),
        "type": _canonical(raw.get("type"), "type"),
        "latitude": latitude,
        "longitude": longitude,
        "frequency": frequency,
        "magnetic_variation": _optional_number(
            raw.get("magnetic_variation"), "magnetic_variation"
        ),
    }


def normalize_procedure(raw: Mapping[str, Any]) -> dict[str, Any]:
    procedure_type = _canonical(raw.get("procedure_type"), "procedure_type")
    if procedure_type not in {"SID", "STAR", "APPROACH"}:
        raise ValueError("procedure_type must be SID, STAR, or APPROACH")
    transitions = [
        _canonical(value, "transition") for value in (raw.get("transitions") or [])
    ]
    legs = []
    for leg in raw.get("legs") or []:
        if not isinstance(leg, Mapping):
            raise ValueError("procedure leg must be an object")
        legs.append(
            {
                "fix": _canonical(leg.get("fix"), "fix"),
                "path_type": _optional_canonical(leg.get("path_type")),
                "altitude_constraint": _optional_string(leg.get("altitude_constraint")),
                "speed_constraint": _optional_string(leg.get("speed_constraint")),
                "altitude_ft": _optional_number(leg.get("altitude_ft"), "altitude_ft"),
                "course_deg": _optional_number(leg.get("course_deg"), "course_deg"),
            }
        )
    return {
        "identifier": _canonical(raw.get("identifier"), "identifier"),
        "airport_icao": _canonical(raw.get("airport_icao"), "airport_icao"),
        "procedure_type": procedure_type,
        "runway": _optional_canonical(raw.get("runway")),
        "initial_altitude_ft": _optional_number(
            raw.get("initial_altitude_ft"), "initial_altitude_ft"
        ),
        "transitions": transitions,
        "legs": legs,
    }


def normalize_airspace(raw: Any) -> dict[str, Any]:
    if not isinstance(raw, Mapping) or raw.get("type") != "FeatureCollection":
        raise ValueError("airspace must be a GeoJSON FeatureCollection")
    raw_features = raw.get("features")
    if not isinstance(raw_features, list):
        raise ValueError("airspace must be a GeoJSON FeatureCollection")
    features = []
    for feature in raw_features:
        if (
            isinstance(feature, Mapping)
            and feature.get("type") == "Feature"
            and isinstance(feature.get("geometry"), Mapping)
            and isinstance(feature.get("properties"), Mapping)
        ):
            features.append(dict(feature))
    return {"type": "FeatureCollection", "features": features}


def normalize_nav_data_bundle(raw: Mapping[str, Any]) -> dict[str, Any]:
    metadata = raw.get("metadata")
    if not isinstance(metadata, Mapping):
        raise ValueError("metadata is required")
    return {
        "metadata": normalize_metadata(metadata),
        "navaids": [normalize_navaid(item) for item in (raw.get("navaids") or [])],
        "procedures": [
            normalize_procedure(item) for item in (raw.get("procedures") or [])
        ],
        "airspace": normalize_airspace(
            raw.get("airspace") or {"type": "FeatureCollection", "features": []}
        ),
    }


class NavDataCatalog:
    """Validated in-memory navigation-data catalog."""

    def __init__(self, bundle: Mapping[str, Any]):
        self.bundle = normalize_nav_data_bundle(bundle)

    @property
    def navaids(self) -> list[dict[str, Any]]:
        return self.bundle["navaids"]

    @property
    def procedures(self) -> list[dict[str, Any]]:
        return self.bundle["procedures"]

    @property
    def airspace(self) -> dict[str, Any]:
        return self.bundle["airspace"]

    def search_navaids(self, query: str) -> list[dict[str, Any]]:
        normalized = query.strip().upper()
        if not normalized:
            return []
        return [
            record
            for record in self.navaids
            if normalized in record["identifier"]
            or normalized in (record.get("name") or "").upper()
        ]

    def procedures_for_airport(
        self,
        airport_icao: str,
        procedure_type: str | None = None,
        runway: str | None = None,
    ) -> list[dict[str, Any]]:
        airport = _canonical(airport_icao, "airport_icao")
        normalized_type = _optional_canonical(procedure_type)
        if normalized_type and normalized_type not in {"SID", "STAR", "APPROACH"}:
            raise ValueError("procedure_type must be SID, STAR, or APPROACH")
        normalized_runway = _optional_canonical(runway)
        return [
            record
            for record in self.procedures
            if record["airport_icao"] == airport
            and (not normalized_type or record["procedure_type"] == normalized_type)
            and (not normalized_runway or record["runway"] == normalized_runway)
        ]

    def status(self, at: str | datetime | None = None) -> dict[str, Any]:
        metadata = self.bundle["metadata"]
        return {
            "navaid_count": len(self.navaids),
            "procedure_count": len(self.procedures),
            "airspace_count": len(self.airspace["features"]),
            "source": metadata["source"],
            "cycle": metadata["cycle"],
            "effective_from": metadata["effective_from"],
            "effective_through": metadata["effective_through"],
            "freshness": freshness_status(metadata, at),
        }


_SAMPLE_NAVAIDS = [
    {
        "identifier": "JFK",
        "name": "JFK VOR",
        "type": "VOR",
        "latitude": 40.6413,
        "longitude": -73.7781,
        "frequency": 110.9,
    },
    {
        "identifier": "LAX",
        "name": "LAX VOR",
        "type": "VOR",
        "latitude": 33.9425,
        "longitude": -118.4081,
        "frequency": 113.6,
    },
    {
        "identifier": "SFO",
        "name": "San Francisco VOR",
        "type": "VORDME",
        "latitude": 37.6190,
        "longitude": -122.3750,
        "frequency": 115.8,
    },
    {
        "identifier": "ORD",
        "name": "Chicago O'Hare VOR",
        "type": "VORTAC",
        "latitude": 41.9742,
        "longitude": -87.9073,
        "frequency": 113.9,
    },
]


def _sample_procedure(
    airport: str,
    identifier: str,
    procedure_type: str,
    runway: str,
    initial_altitude_ft: int | None,
    waypoints: Sequence[str],
) -> dict[str, Any]:
    return {
        "identifier": identifier,
        "airport_icao": airport,
        "procedure_type": procedure_type,
        "runway": runway,
        "initial_altitude_ft": initial_altitude_ft,
        "transitions": [runway],
        "legs": [
            {"fix": waypoint, "altitude_ft": initial_altitude_ft}
            for waypoint in waypoints
        ],
    }


_SAMPLE_PROCEDURES = (
    [
        _sample_procedure("KJFK", "CANDLE", "SID", runway, 2000, ["CANDLE", "GREKI"])
        for runway in ("04L", "04R")
    ]
    + [
        _sample_procedure("KJFK", "SKYWAY", "SID", runway, 2000, ["SKYWAY", "BETTE"])
        for runway in ("22L", "22R")
    ]
    + [
        _sample_procedure("KJFK", "CAVEN", "STAR", runway, 5000, ["CAVEN", "MERTZ"])
        for runway in ("04L", "04R")
    ]
    + [
        _sample_procedure(
            "KJFK", "WHITPAIN", "STAR", runway, 5000, ["WHITPAIN", "LNSKY"]
        )
        for runway in ("22L", "22R")
    ]
    + [
        _sample_procedure(
            "KJFK", f"ILS {runway}", "APPROACH", runway, None, ["APPROACH", "FINAL"]
        )
        for runway in ("04L", "04R", "22L", "22R")
    ]
    + [
        _sample_procedure(
            "KJFK", f"VOR {runway}", "APPROACH", runway, None, ["VOR", "FINAL"]
        )
        for runway in ("04L", "22L")
    ]
)


def sample_nav_data_catalog() -> NavDataCatalog:
    """Return the SDK-owned synthetic catalog used by application demos and tests."""

    return NavDataCatalog(
        {
            "metadata": {"source": "aviation-sdk-synthetic-sample"},
            "navaids": _SAMPLE_NAVAIDS,
            "procedures": _SAMPLE_PROCEDURES,
            "airspace": {"type": "FeatureCollection", "features": []},
        }
    )


__all__ = [
    "NavDataCatalog",
    "freshness_status",
    "normalize_airspace",
    "normalize_metadata",
    "normalize_navaid",
    "normalize_nav_data_bundle",
    "normalize_procedure",
    "sample_nav_data_catalog",
]
