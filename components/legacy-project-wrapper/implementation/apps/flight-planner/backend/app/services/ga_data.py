"""Bounded, cached public-data adapters for the GA API. No caller-selected origins."""

from __future__ import annotations

import csv
import io
import json
import math
from datetime import datetime, timezone
from threading import RLock
from time import monotonic
from typing import Any

import httpx

OURAIRPORTS = "https://davidmegginson.github.io/ourairports-data/"
FAA_FACILITIES = "https://services.arcgis.com/xOi1kZaI0eWDREZv/arcgis/rest/services/NTAD_Aviation_Facilities/FeatureServer/0"
FAA_AIS = "https://services6.arcgis.com/ssFJjBXIUyZDrSYZ/arcgis/rest/services/"
AWC = "https://aviationweather.gov/api/data/"
_CACHE: dict[tuple, tuple[float, Any, int]] = {}
_MAX_CACHE_WEIGHT = 64 * 1024 * 1024
_LOCK = RLock()


class DataUnavailable(RuntimeError):
    pass


def now() -> str:
    return datetime.now(timezone.utc).isoformat()


def cached(key: tuple, ttl: int, loader):
    # A bounded cache; never label stale data as a newly fetched result.
    with _LOCK:
        found = _CACHE.get(key)
        if found and found[0] > monotonic():
            return found[1]
        _CACHE.pop(key, None)
        result = loader()
        # Large polygon layers must not turn normal map panning into unbounded
        # retention. Budget serialized bytes with a conservative Python-object
        # overhead multiplier; oversized responses still work without caching.
        weight = 4 * len(json.dumps(result, ensure_ascii=False).encode("utf-8"))
        if weight <= _MAX_CACHE_WEIGHT:
            while _CACHE and (
                len(_CACHE) >= 128
                or sum(entry[2] for entry in _CACHE.values()) + weight > _MAX_CACHE_WEIGHT
            ):
                _CACHE.pop(next(iter(_CACHE)))
            _CACHE[key] = (monotonic() + ttl, result, weight)
        return result


def fetch(url: str, params: dict | None = None, *, csv_data: bool = False):
    try:
        response = httpx.get(
            url,
            params=params,
            timeout=20,
            follow_redirects=True,
            headers={"User-Agent": "Aviation-GA-API/1.0 (github.com/jordanhubbard/Aviation)"},
        )
        response.raise_for_status()
        if len(response.content) > 20 * 1024 * 1024:
            raise DataUnavailable("Provider response exceeds 20 MiB")
        if response.status_code == 204:
            return []
        return response.text if csv_data else response.json()
    except (httpx.HTTPError, ValueError) as exc:
        # Avoid leaking upstream URLs, query credentials, or HTML responses.
        status = getattr(getattr(exc, "response", None), "status_code", None)
        raise DataUnavailable(
            f'Public data provider unavailable{f" (HTTP {status})" if status else ""}'
        ) from exc


def source(provider: str, url: str, **extra) -> dict:
    return {"provider": provider, "url": url, "retrieved_at_utc": now(), **extra}


def number(value):
    try:
        n = float(value)
        return n if math.isfinite(n) else None
    except (TypeError, ValueError):
        return None


def airport_csv(filename: str):
    def load():
        text = fetch(OURAIRPORTS + filename, csv_data=True)
        reader = csv.DictReader(io.StringIO(text))
        if not reader.fieldnames or "airport_ident" not in reader.fieldnames:
            raise DataUnavailable("Invalid OurAirports dataset schema")
        index: dict[str, list] = {}
        for row in reader:
            index.setdefault(row["airport_ident"].upper(), []).append(row)
        return index, source("OurAirports", OURAIRPORTS + filename)

    return cached(("csv", filename), 86400, load)


def airport_facilities(ident: str) -> dict:
    def load():
        url = FAA_FACILITIES + "/query"
        params = {
            "f": "json",
            "where": f"ICAO_ID='{ident}' OR ARPT_ID='{ident}'",
            "outFields": "ARPT_ID,ICAO_ID,EFF_DATE,ARPT_STATUS,FACILITY_USE_CODE,FUEL_TYPES,AIRFRAME_REPAIR_SER_CODE,PWR_PLANT_REPAIR_SER,OTHER_SERVICES,CONTR_FUEL_AVBL,TRNS_STRG_HGR_FLAG,TRNS_STRG_TIE_FLAG,TRNS_STRG_BUOY_FLAG,TWR_TYPE_CODE,TPA,CHART_NAME,LNDG_FEE_FLAG",
            "returnGeometry": "false",
            "resultRecordCount": 2,
        }
        data = fetch(url, params)
        if (
            not isinstance(data, dict)
            or "error" in data
            or not isinstance(data.get("features"), list)
        ):
            raise DataUnavailable("Invalid FAA facilities response")
        if data.get("exceededTransferLimit") or len(data["features"]) > 1:
            raise DataUnavailable("Ambiguous FAA facility identity")
        record = data["features"][0].get("attributes", {}) if data["features"] else None
        if record is not None and not isinstance(record, dict):
            raise DataUnavailable("Invalid FAA facility attributes")
        if record is not None and ident not in {
            str(record.get("ICAO_ID", "")).upper(),
            str(record.get("ARPT_ID", "")).upper(),
        }:
            raise DataUnavailable("FAA facility identity does not match the requested airport")
        return {
            "status": "available" if record else "no_record",
            "record": record,
            "source": source(
                "FAA NASR via US DOT NTAD",
                FAA_FACILITIES,
                effective_date=record.get("EFF_DATE") if record else None,
            ),
            "fuel_prices": None,
            "fbo_hours": None,
            "limitations": "Published facility codes; verify current availability with the airport. Fuel prices and FBO opening hours are not provided.",
        }

    return cached(("facility", ident), 3600, load)


def airport_details(airport: dict) -> dict:
    ident = airport["icao"]
    runways, runway_source = airport_csv("runways.csv")
    frequencies, frequency_source = airport_csv("airport-frequencies.csv")
    rw = []
    for row in runways.get(ident, []):
        rw.append(
            {
                "ident": f"{row.get('le_ident', '')}/{row.get('he_ident', '')}",
                "length_ft": number(row.get("length_ft")),
                "width_ft": number(row.get("width_ft")),
                "surface": row.get("surface") or None,
                "lighted": row.get("lighted") == "1" if row.get("lighted") in {"0", "1"} else None,
                "closed": row.get("closed") == "1" if row.get("closed") in {"0", "1"} else None,
                "ends": [
                    {
                        "ident": row.get(prefix + "_ident"),
                        "latitude": number(row.get(prefix + "_latitude_deg")),
                        "longitude": number(row.get(prefix + "_longitude_deg")),
                        "heading_true_deg": number(row.get(prefix + "_heading_degT")),
                        "displaced_threshold_ft": number(
                            row.get(prefix + "_displaced_threshold_ft")
                        ),
                    }
                    for prefix in ("le", "he")
                ],
            }
        )
    freq = [
        {
            "type": r.get("type"),
            "description": r.get("description"),
            "frequency_mhz": number(r.get("frequency_mhz")),
        }
        for r in frequencies.get(ident, [])
    ]
    facilities = (
        airport_facilities(ident)
        if airport.get("country") == "US"
        else {
            "status": "outside_coverage",
            "record": None,
            "source": None,
            "limitations": "FAA facility services cover United States airports.",
        }
    )
    return {
        "airport": airport,
        "runways": rw,
        "frequencies": freq,
        "services": facilities,
        "sources": [runway_source, frequency_source],
    }


def aviation_weather(product: str, params: dict) -> dict:
    def load():
        url = AWC + product
        data = fetch(url, {**params, "format": "json"})
        if not isinstance(data, list):
            raise DataUnavailable("Invalid NOAA aviation weather response")
        return {
            "status": "available" if data else "no_reports",
            "reports": data,
            "source": source("NOAA Aviation Weather Center", url),
        }

    return cached(("awc", product, tuple(sorted(params.items()))), 300, load)


def navaids(west: float, south: float, east: float, north: float) -> dict:
    def load():
        url = AWC + "navaid"
        data = fetch(url, {"bbox": f"{south},{west},{north},{east}", "format": "geojson"})
        if (
            not isinstance(data, dict)
            or data.get("type") != "FeatureCollection"
            or not isinstance(data.get("features"), list)
        ):
            raise DataUnavailable("Invalid NOAA navigation GeoJSON")
        if len(data["features"]) >= 400:
            raise DataUnavailable("Navaid query reaches provider limit; use a smaller bounding box")
        return {
            **data,
            "truncated": False,
            "source": source("NOAA Aviation Weather Center", url),
            "limitations": "Provider result limits apply; this layer is not a complete navigation database.",
        }

    return cached(("navaids", west, south, east, north), 3600, load)


def airspace(west: float, south: float, east: float, north: float) -> dict:
    def load():
        url = FAA_AIS + "Class_Airspace/FeatureServer/0/query"
        data = fetch(
            url,
            {
                "f": "geojson",
                "where": "1=1",
                "geometry": f"{west},{south},{east},{north}",
                "geometryType": "esriGeometryEnvelope",
                "inSR": 4326,
                "spatialRel": "esriSpatialRelIntersects",
                "outSR": 4326,
                "outFields": "*",
                "resultRecordCount": 500,
            },
        )
        if (
            not isinstance(data, dict)
            or data.get("type") != "FeatureCollection"
            or not isinstance(data.get("features"), list)
        ):
            raise DataUnavailable("Invalid FAA airspace GeoJSON")
        if data.get("exceededTransferLimit") or len(data["features"]) >= 500:
            raise DataUnavailable("Airspace query too broad; use a smaller bounding box")
        return {
            **data,
            "source": source("FAA Aeronautical Information Services", url),
            "limitations": "Class airspace only; not TFRs, special-use airspace, or a complete airspace clearance assessment.",
        }

    return cached(("airspace", west, south, east, north), 3600, load)


def temporary_restrictions(state=None):
    def load():
        url = "https://tfr.faa.gov/tfrapi/exportTfrList"
        data = fetch(url)
        if not isinstance(data, list) or any(
            not isinstance(r, dict) or not r.get("notam_id") for r in data
        ):
            raise DataUnavailable("Invalid FAA TFR list")
        return {
            "restrictions": data,
            "source": source("FAA temporary flight restrictions", url),
            "limitations": "Published TFR list summaries, including future restrictions; not a complete NOTAM briefing or route-intersection assessment. Consult the full FAA NOTAM text.",
        }

    result = cached(("tfr-list",), 300, load)
    return {
        **result,
        "restrictions": [
            r for r in result["restrictions"] if not state or r.get("state") == state.upper()
        ],
    }
