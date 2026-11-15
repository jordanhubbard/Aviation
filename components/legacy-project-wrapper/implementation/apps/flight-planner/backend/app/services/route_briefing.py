"""Route orchestration over the SDK's spherical navigation primitives and NOAA data."""

from __future__ import annotations

import math
from datetime import datetime

from aviation import navigation as nav
from app.services import aviation_sources as sources
from app.services import ga_data as data


def route_legs(points):
    legs, progress = [], 0.0
    for a, b in zip(points, points[1:]):
        length = nav.distance_nm(*a, *b)
        if length / nav.EARTH_RADIUS_NM >= math.pi - 1e-7:
            raise ValueError(
                "Antipodal route leg is ambiguous; add an intermediate waypoint"
            )
        legs.append((a, b, length, nav.initial_bearing(*a, *b), progress))
        progress += length
    return legs, progress


def nearest_route(lat, lon, legs):
    best = None
    for index, (a, b, length, bearing, progress) in enumerate(legs):
        delta = nav.distance_nm(*a, lat, lon) / nav.EARTH_RADIUS_NM
        theta = math.radians(nav.initial_bearing(*a, lat, lon) - bearing)
        along = (
            math.atan2(math.sin(delta) * math.cos(theta), math.cos(delta))
            * nav.EARTH_RADIUS_NM
        )
        if length > 1e-9 and 0 <= along <= length:
            distance = (
                abs(math.asin(max(-1.0, min(1.0, math.sin(delta) * math.sin(theta)))))
                * nav.EARTH_RADIUS_NM
            )
        else:
            start, end = nav.distance_nm(*a, lat, lon), nav.distance_nm(*b, lat, lon)
            distance, along = (start, 0.0) if start <= end else (end, length)
        candidate = (distance, progress + along, index)
        if best is None or candidate < best:
            best = candidate
    return {
        "distance_from_route_nm": best[0],
        "along_route_nm": best[1],
        "closest_leg": best[2],
    }


def station_match(station, legs, requested=False):
    return {
        "station_id": station.get("icaoId") or station["id"],
        "name": station.get("site"),
        "latitude": float(station["lat"]),
        "longitude": float(station["lon"]),
        "products": station.get("siteType", []),
        "requested_airport": requested,
        **nearest_route(float(station["lat"]), float(station["lon"]), legs),
    }


def discover(points, requested, corridor_nm, max_stations):
    legs, distance = route_legs(points)
    catalog, source = sources.station_catalog()
    by_id = {s.get("icaoId") or s.get("id"): s for s in catalog}
    matches = {}
    for station in catalog:
        if "TAF" not in station["siteType"] or not station.get("icaoId"):
            continue
        match = station_match(station, legs)
        if match["distance_from_route_nm"] <= corridor_nm + 1e-8:
            matches[match["station_id"]] = match
    # An airport without its own TAF is an explicit no-report result, not replaced
    # by a forecast from a nearby airport. Nearby stations are separate records.
    for code, point in requested:
        station = by_id.get(code) or {
            "id": code,
            "lat": point[0],
            "lon": point[1],
            "siteType": [],
        }
        matches[code] = station_match(station, legs, True)
    ordered = sorted(
        matches.values(),
        key=lambda s: (
            not s["requested_airport"],
            s["distance_from_route_nm"],
            s["along_route_nm"],
            s["station_id"],
        ),
    )
    selected = sorted(
        ordered[:max_stations],
        key=lambda s: (
            s["along_route_nm"],
            s["distance_from_route_nm"],
            s["station_id"],
        ),
    )
    return selected, len(ordered), source, distance


def batch_reports(product, ids):
    results = {}
    for offset in range(0, len(ids), 40):
        batch = ids[offset : offset + 40]
        try:
            value = sources.reports(product, batch)
            rows = value["reports"]
            if not isinstance(rows, list) or any(
                not isinstance(r, dict) or r.get("icaoId") not in batch for r in rows
            ):
                raise data.DataUnavailable("Invalid NOAA station weather records")
            for code in batch:
                found = [r for r in rows if r["icaoId"] == code]
                results[code] = {
                    "status": "available" if found else "no_reports",
                    "reports": found,
                    "source": value["source"],
                    "error": None,
                    "truncated": len(rows) >= 400,
                }
        except data.DataUnavailable as exc:
            for code in batch:
                results[code] = {
                    "status": "unavailable",
                    "reports": [],
                    "error": str(exc),
                    "truncated": False,
                    "source": {
                        "provider": "NOAA Aviation Weather Center",
                        "url": data.AWC + product,
                    },
                }
    return results


def validity(reports, valid_at: datetime | None):
    if valid_at is None:
        return {"valid_at_status": "not_requested", "periods_at_time": []}
    timestamp = valid_at.timestamp()
    valid, unknown, periods = False, False, []
    for report in reports:
        start, end = data.number(report.get("validTimeFrom")), data.number(
            report.get("validTimeTo")
        )
        if start is None or end is None or start <= 0 or end <= start:
            unknown = True
            continue
        if start <= timestamp < end:
            valid = True
            # Includes concurrent TEMPO/PROB groups. Do not collapse them into a
            # deterministic prevailing forecast or synthesize missing fields.
            forecast_periods = report.get("fcsts")
            for period in (
                forecast_periods if isinstance(forecast_periods, list) else []
            ):
                if not isinstance(period, dict):
                    continue
                a, b = data.number(period.get("timeFrom")), data.number(
                    period.get("timeTo")
                )
                if a is not None and b is not None and a <= timestamp < b:
                    periods.append({"station_id": report["icaoId"], "period": period})
    return {
        "valid_at_status": (
            "valid"
            if valid
            else ("unknown" if unknown or not reports else "outside_validity")
        ),
        "periods_at_time": periods,
    }


def briefing(points, requested, corridor_nm, max_stations, include_metars, valid_at):
    stations, count, catalog_source, distance = discover(
        points, requested, corridor_nm, max_stations
    )
    ids = [s["station_id"] for s in stations]
    tafs = batch_reports("taf", ids)
    metars = batch_reports("metar", ids) if include_metars else {}
    for station in stations:
        code = station["station_id"]
        station["taf"] = tafs[code]
        station["metar"] = metars.get(code)
        station.update(validity(tafs[code]["reports"], valid_at))
    products = list(tafs.values()) + list(metars.values())
    return {
        "points": points,
        "route_distance_nm": distance,
        "corridor_nm": corridor_nm,
        "valid_at": valid_at,
        "stations": stations,
        "total_matching_stations": count,
        "truncated": count > len(stations) or any(r["truncated"] for r in products),
        "partial": any(r["status"] == "unavailable" for r in products),
        "discovery_limited": bool(catalog_source.get("unlocated_taf_station_ids")),
        "source": catalog_source,
        "limitations": "Station proximity uses minor great-circle route legs, not a complete weather-hazard briefing. TAFs describe conditions at their issuing airports, not every point along the route. No reports or an out-of-validity forecast does not establish safe conditions. Truncated results require a larger station limit or shorter route.",
    }
