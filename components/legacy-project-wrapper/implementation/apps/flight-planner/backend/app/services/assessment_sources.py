"""Bounded official-source adapters for route assessment, without applicability guesses."""

from __future__ import annotations

import math
import hashlib
import zlib
from xml.etree import ElementTree
import re

from . import ga_data as data

TFR_WFS = "https://tfr.faa.gov/geoserver/TFR/ows"
OBSTACLES = data.FAA_AIS + "Digital_Obstacle_File/FeatureServer/0/query"


def bounds_query(bounds):
    if len(bounds) != 4 or not all(math.isfinite(v) for v in bounds):
        raise ValueError("Expected finite west/south/east/north bounds")
    west, south, east, north = bounds
    if not (-180 <= west <= east <= 180 and -90 <= south <= north <= 90):
        raise ValueError("Split antimeridian queries before source acquisition")
    return ",".join(str(float(v)) for v in bounds)


def feature_collection(value, label):
    if (
        not isinstance(value, dict)
        or value.get("type") != "FeatureCollection"
        or not isinstance(value.get("features"), list)
        or any(
            not isinstance(f, dict)
            or f.get("type") != "Feature"
            or not isinstance(f.get("properties"), dict)
            for f in value["features"]
        )
    ):
        raise data.DataUnavailable(f"Invalid {label} feature collection")
    return value["features"]


def obstacles(bounds, *, limit=2000):
    """FAA DOF elevations/accuracy remain raw; complete pagination is explicit."""
    geometry = bounds_query(bounds)
    if type(limit) is not int or not 1 <= limit <= 10000:
        raise ValueError("Obstacle limit must be 1–10000")

    def load():
        features, seen, offset, truncated = [], set(), 0, False
        while len(features) < limit:
            count = min(500, limit - len(features))
            value = data.fetch(
                OBSTACLES,
                {
                    "f": "geojson",
                    "where": "1=1",
                    "geometry": geometry,
                    "geometryType": "esriGeometryEnvelope",
                    "inSR": 4326,
                    "outSR": 4326,
                    "spatialRel": "esriSpatialRelIntersects",
                    "outFields": "*",
                    "resultRecordCount": count,
                    "resultOffset": offset,
                    "orderByFields": "OBJECTID",
                },
            )
            rows = feature_collection(value, "FAA obstacle")
            if len(rows) > count:
                raise data.DataUnavailable("FAA obstacle response exceeds requested limit")
            for row in rows:
                identifier = row["properties"].get("OBJECTID")
                if identifier is None or identifier in seen:
                    raise data.DataUnavailable("FAA obstacle pagination changed or lacks identity")
                seen.add(identifier)
            features.extend(rows)
            metadata = value.get("properties", {})
            if not isinstance(metadata, dict):
                raise data.DataUnavailable("Invalid FAA obstacle pagination metadata")
            top_level = value.get("exceededTransferLimit")
            nested = metadata.get("exceededTransferLimit")
            if top_level is not None and nested is not None and top_level != nested:
                raise data.DataUnavailable("Contradictory FAA obstacle pagination status")
            more = nested if nested is not None else top_level
            if more is None:
                # An exactly full page without a flag cannot prove completeness.
                more = len(rows) == count
            if type(more) is not bool:
                raise data.DataUnavailable("Invalid FAA obstacle pagination status")
            if not more:
                break
            if not rows:
                raise data.DataUnavailable("FAA obstacle pagination made no progress")
            offset += len(rows)
            truncated = len(features) == limit
        return {
            "status": "available" if features else "no_records",
            "records": features,
            "truncated": truncated,
            "bounds": list(bounds),
            "source": data.source("FAA Digital Obstacle File", OBSTACLES),
            "limitations": "Published man-made charting obstructions, not every obstacle. Original AMSL/AGL, accuracy, verification and date fields are preserved. Live pagination is not a transactional snapshot.",
        }

    return data.cached(("assessment-obstacles", tuple(bounds), limit), 900, load)


def tfr_geometry():
    """Join list identities to all bounded WFS areas; missing geometry stays visible."""

    def load():
        listed = data.temporary_restrictions()
        value = data.fetch(
            TFR_WFS,
            {
                "service": "WFS",
                "version": "2.0.0",
                "request": "GetFeature",
                "typeNames": "TFR:V_TFR_LOC",
                "outputFormat": "application/json",
                "srsName": "urn:ogc:def:crs:OGC:1.3:CRS84",
                "count": 1000,
            },
        )
        features = feature_collection(value, "FAA TFR")
        matched, returned = value.get("numberMatched"), value.get("numberReturned")
        if (
            type(matched) is not int
            or type(returned) is not int
            or matched < returned
            or returned != len(features)
            or returned > 1000
        ):
            raise data.DataUnavailable("FAA TFR geometry completeness cannot be verified")
        by_id = {}
        for item in listed["restrictions"]:
            identity = item["notam_id"]
            if identity in by_id:
                raise data.DataUnavailable("Duplicate FAA TFR list identity")
            by_id[identity] = {"summary": item, "areas": []}
        unmatched = []
        for feature in features:
            key = feature["properties"].get("NOTAM_KEY")
            identity = re.match(r"^(\d{1,2}/\d{4,5})(?:-|$)", key) if isinstance(key, str) else None
            if identity and identity[1] in by_id:
                by_id[identity[1]]["areas"].append(feature)
            else:
                unmatched.append(feature)
        restrictions = list(by_id.values())
        return {
            "status": "available" if restrictions else "no_records",
            "records": restrictions,
            "truncated": returned < matched,
            "missing_geometry_ids": sorted(k for k, v in by_id.items() if not v["areas"]),
            "unmatched_geometry": unmatched,
            "sources": [listed["source"], data.source("FAA public TFR geometry WFS", TFR_WFS)],
            "limitations": "Areas may repeat one NOTAM identity. Public geometry does not establish active schedules, altitude applicability or complete NOTAM coverage. Restrictions without geometry remain unassessed; title and creation dates are not validity windows.",
        }

    return data.cached(("assessment-tfr-geometry",), 300, load)


def weather_advisories(product):
    if product not in {"airsigmet", "gairmet", "cwa"}:
        raise ValueError("Unsupported route advisory product")
    if product == "gairmet":
        return gairmet_forecasts()
    value = data.aviation_weather(product, {})
    return {
        **value,
        "truncated": len(value["reports"]) >= 400,
        "validity_kind": "forecast_snapshot" if product == "gairmet" else "interval",
        "limitations": "Original AWC records and units remain authoritative. Snapshot valid times, issue times and expiration are distinct. LINE geometry widths, variable freezing levels and unspecified vertical references require explicit applicability handling.",
    }


def gairmet_forecasts():
    """Full NOAA cache retains every forecast snapshot and explicit MSL units."""
    url = "https://aviationweather.gov/data/cache/gairmets.cache.xml.gz"

    def load():
        compressed = data.fetch(url, raw_bytes=True)
        try:
            decoder = zlib.decompressobj(16 + zlib.MAX_WBITS)
            xml = decoder.decompress(compressed, 16 * 1024 * 1024 + 1)
            if (
                len(xml) > 16 * 1024 * 1024
                or not decoder.eof
                or decoder.unused_data
                or b"<!DOCTYPE" in xml.upper()
            ):
                raise ValueError("Invalid compressed forecast cache")
            root = ElementTree.fromstring(xml)
            records = root.find("data")
            if (
                records is None
                or root.tag != "response"
                or root.find("errors") is not None
                and len(root.find("errors"))
            ):
                raise ValueError("Invalid forecast cache envelope")
            rows = records.findall("GAIRMET")
            if len(rows) > 5000 or int(records.attrib["num_results"]) != len(rows):
                raise ValueError("Forecast cache count is inconsistent")
            reports = []
            for row in rows:
                hazard = row.find("hazard")
                altitude = next(
                    (
                        a
                        for a in row.findall("altitude")
                        if "min_ft_msl" in a.attrib or "max_ft_msl" in a.attrib
                    ),
                    None,
                )
                level = next(
                    (
                        a.attrib.get("level_ft_msl")
                        for a in row.findall("altitude")
                        if a.attrib.get("level_ft_msl")
                    ),
                    None,
                )
                reports.append(
                    {
                        "tag": row.findtext("tag"),
                        "product": row.findtext("product"),
                        "hazard": hazard.attrib.get("type") if hazard is not None else None,
                        "severity": hazard.attrib.get("severity") if hazard is not None else None,
                        "geometryType": row.findtext("geometry_type"),
                        "geom": row.findtext("geometry_type"),
                        "validTime": row.findtext("valid_time"),
                        "issueTime": row.findtext("issue_time"),
                        "expireTime": row.findtext("expire_time"),
                        "receiptTime": row.findtext("receipt_time"),
                        "altitude_ft_msl": dict(altitude.attrib) if altitude is not None else {},
                        "level_ft_msl": level,
                        "freezing_altitude_ft_msl": {
                            c.tag: c.text for c in row.findall("fzl_altitude/*")
                        },
                        "coords": [
                            {"lat": p.findtext("latitude"), "lon": p.findtext("longitude")}
                            for p in row.findall("area/point")
                        ],
                        "raw_xml": ElementTree.tostring(row, encoding="unicode"),
                    }
                )
        except (ValueError, TypeError, ElementTree.ParseError, KeyError, zlib.error) as error:
            raise data.DataUnavailable("Malformed NOAA G-AIRMET forecast cache") from error
        return {
            "status": "available" if reports else "no_reports",
            "reports": reports,
            "source": data.source(
                "NOAA AWC complete G-AIRMET forecast cache",
                url,
                compressed_sha256=hashlib.sha256(compressed).hexdigest(),
                xml_sha256=hashlib.sha256(xml).hexdigest(),
            ),
            "truncated": False,
            "validity_kind": "forecast_snapshot",
            "limitations": "All published cache snapshots retained. MSL altitude fields are explicit; SFC and variable freezing-level bounds remain distinct. Snapshot validity does not assert a continuous forecast interval.",
        }

    return data.cached(("assessment-gairmet-cache",), 300, load)
