"""Fixed-origin adapters. Credentials stay in settings and request headers."""

from __future__ import annotations

import hashlib
import re
import zlib

from app.config import settings
from app.services import ga_data as data

STATIONS = "https://aviationweather.gov/data/cache/stations.cache.json.gz"
OPENAIP = "https://api.core.openaip.net/api/"
NWS = "https://api.weather.gov/"
FAA_EVENTS = "https://nasstatus.faa.gov/api/airport-events"
LICENSE = "Attribution-NonCommercial 4.0 International (CC BY-NC 4.0)"
LICENSE_URL = "https://creativecommons.org/licenses/by-nc/4.0/"


def station_catalog():
    def load():
        import json

        blob = data.fetch(STATIONS, raw_bytes=True)
        try:
            decoder = zlib.decompressobj(16 + zlib.MAX_WBITS)
            raw = decoder.decompress(blob, 16 * 1024 * 1024 + 1)
            if len(raw) > 16 * 1024 * 1024 or not decoder.eof or decoder.unused_data:
                raise ValueError("Invalid or oversized station cache")
            stations = json.loads(raw)
            if not isinstance(stations, list) or not stations or len(stations) > 50000:
                raise ValueError("Invalid station cache")
            # Do not quietly omit malformed rows and claim full discovery.
            located, unlocated_taf = [], []
            unlocated_count = 0
            for station in stations:
                if (
                    not isinstance(station, dict)
                    or not isinstance(station.get("id"), str)
                    or not isinstance(station.get("icaoId"), (str, type(None)))
                    or not isinstance(station.get("siteType"), list)
                    or any(not isinstance(product, str) for product in station["siteType"])
                ):
                    raise ValueError("Invalid station metadata")
                lat, lon = data.number(station.get("lat")), data.number(station.get("lon"))
                if lat is not None and lon is not None and -100 < lat <= -99 and -100 < lon <= -99:
                    unlocated_count += 1
                    if "TAF" in station["siteType"] and station.get("icaoId"):
                        unlocated_taf.append(station["icaoId"])
                    continue
                if lat is None or lon is None or not -90 <= lat <= 90 or not -180 <= lon <= 180:
                    raise ValueError("Invalid station coordinates")
                located.append(station)
            return located, data.source(
                "NOAA Aviation Weather Center station catalog",
                STATIONS,
                freshness="Daily provider catalog; cached for up to 24 hours",
                total_catalog_records=len(stations),
                excluded_unlocated_count=unlocated_count,
                unlocated_taf_station_ids=unlocated_taf,
            )
        except (ValueError, TypeError, zlib.error) as exc:
            raise data.DataUnavailable("Invalid NOAA station catalog") from exc

    return data.cached(("awc-station-catalog",), 86400, load)


def reports(product, station_ids):
    """At most 40 IDs per provider request; partition by the actual provider ID."""
    return data.aviation_weather(product, {"ids": ",".join(station_ids)})


def winds_aloft(lat, lon, levels, hours):
    levels = tuple(dict.fromkeys(levels))
    variables = [
        f"{field}_{level}hPa"
        for level in levels
        for field in (
            "wind_speed",
            "wind_direction",
            "temperature",
            "geopotential_height",
        )
    ]

    def load():
        url = "https://api.open-meteo.com/v1/forecast"
        value = data.fetch(
            url,
            {
                "latitude": lat,
                "longitude": lon,
                "hourly": ",".join(variables),
                "wind_speed_unit": "kn",
                "temperature_unit": "celsius",
                "timezone": "UTC",
                "forecast_hours": hours,
            },
        )
        hourly = value.get("hourly") if isinstance(value, dict) else None
        units = value.get("hourly_units") if isinstance(value, dict) else None
        if (
            not isinstance(hourly, dict)
            or not isinstance(units, dict)
            or not isinstance(hourly.get("time"), list)
            or not hourly["time"]
            or len(hourly["time"]) > hours
            or value.get("utc_offset_seconds") != 0
            or any(
                not isinstance(hourly.get(var), list)
                or len(hourly[var]) != len(hourly["time"])
                or var not in units
                for var in variables
            )
        ):
            raise data.DataUnavailable("Invalid Open-Meteo pressure-level forecast response")
        return {
            "data": value,
            "levels_hpa": levels,
            "source": data.source(
                "Open-Meteo numerical pressure-level forecast",
                url,
                license="CC BY 4.0; provider API usage terms apply",
                attribution="Open-Meteo.com and its stated model providers",
            ),
            "limitations": "Modeled winds/temperature at pressure surfaces, not fixed flight altitudes, observed winds or NOAA FD tables. Original UTC times, knots, degrees Celsius and geopotential heights/units are preserved; null values remain unknown.",
        }

    return data.cached(("pressure-level-winds", lat, lon, levels, hours), 1800, load)


def openaip(resource, country, search, page, limit):
    key = settings.openaip_api_key
    if not key:
        raise data.DataUnavailable("OpenAIP is not configured: set OPENAIP_API_KEY server-side")

    def terms():
        document = data.fetch(OPENAIP + "system/specs/v1/schema.json")
        info = document.get("info") if isinstance(document, dict) else None
        license_info = info.get("license") if isinstance(info, dict) else None
        if (
            not isinstance(license_info, dict)
            or license_info.get("name") != LICENSE
            or license_info.get("url") != LICENSE_URL
        ):
            raise data.DataUnavailable("OpenAIP license changed; review required")
        return True

    data.cached(("openaip-license",), 86400, terms)
    params = {"page": page, "limit": limit}
    if country:
        params["country"] = country.upper()
    if search:
        params["search"] = search

    def load():
        url = OPENAIP + resource
        value = data.fetch(url, params, headers={"x-openaip-api-key": key})
        if (
            not isinstance(value, dict)
            or not isinstance(value.get("items"), list)
            or any(not isinstance(item, dict) for item in value["items"])
            or type(value.get("totalCount")) is not int
            or value["totalCount"] < 0
            or type(value.get("totalPages")) is not int
            or value["totalPages"] < 0
            or value.get("page") != page
            or len(value["items"]) > limit
        ):
            raise data.DataUnavailable("Invalid OpenAIP collection response")
        next_page = page + 1 if page < value["totalPages"] else None
        return {
            "status": "available" if value["items"] else "no_reports",
            "records": value["items"],
            "page": page,
            "next_page": next_page,
            "total_count": value["totalCount"],
            "truncated": next_page is not None,
            "source": data.source(
                "openAIP",
                url,
                attribution="openAIP — https://www.openaip.net",
                license=LICENSE,
                license_url=LICENSE_URL,
            ),
            "limitations": "Community-contributed reference data under CC BY-NC 4.0. Preserve original geometry, units and update fields. Pagination is explicit; not certified navigation or complete obstacle coverage.",
        }

    credential_id = hashlib.sha256(key.encode()).hexdigest()
    return data.cached(
        ("openaip", credential_id, resource, country, search, page, limit), 900, load
    )


def nws_alerts(lat, lon, area, limit):
    params = {"point": f"{lat:.4f},{lon:.4f}"} if lat is not None else {"area": area.upper()}

    def load():
        url = NWS + "alerts/active"
        value = data.fetch(url, params)
        if (
            not isinstance(value, dict)
            or value.get("type") != "FeatureCollection"
            or not isinstance(value.get("features"), list)
            or any(not isinstance(f, dict) or f.get("type") != "Feature" for f in value["features"])
        ):
            raise data.DataUnavailable("Invalid NWS alert response")
        pagination = value.get("pagination") or {}
        if not isinstance(pagination, dict):
            raise data.DataUnavailable("Invalid NWS alert pagination")
        return {
            "status": "available" if value["features"] else "no_reports",
            "records": value["features"][:limit],
            "truncated": len(value["features"]) > limit or bool(pagination.get("next")),
            "source": data.source("NOAA National Weather Service", url),
            "limitations": "US NWS coverage. Null alert geometry is preserved. Point queries include applicable county/zone alerts; empty results do not establish safe flying conditions.",
        }

    return data.cached(("nws-alerts", tuple(sorted(params.items())), limit), 60, load)


def nws_forecast(lat, lon, hourly):
    def load():
        point_url = NWS + f"points/{lat:.4f},{lon:.4f}"
        point = data.fetch(point_url)
        props = point.get("properties") if isinstance(point, dict) else None
        if not isinstance(props, dict):
            raise data.DataUnavailable("Invalid NWS point response")
        office, x, y = props.get("gridId"), props.get("gridX"), props.get("gridY")
        if (
            not isinstance(office, str)
            or not re.fullmatch(r"[A-Z]{3}", office)
            or type(x) is not int
            or type(y) is not int
            or not 0 <= x <= 10000
            or not 0 <= y <= 10000
        ):
            raise data.DataUnavailable("NWS forecast grid unavailable for this point")
        # Construct the trusted endpoint; never follow a URL supplied in provider data.
        url = NWS + f"gridpoints/{office}/{x},{y}/forecast" + ("/hourly" if hourly else "")
        value = data.fetch(url)
        if (
            not isinstance(value, dict)
            or not isinstance(value.get("properties"), dict)
            or not isinstance(value["properties"].get("periods"), list)
        ):
            raise data.DataUnavailable("Invalid NWS forecast response")
        return {
            "data": value,
            "source": data.source("NOAA National Weather Service", url),
            "limitations": "US point surface forecast, not a TAF or winds-aloft forecast. Original provider periods and units are retained.",
        }

    return data.cached(("nws-forecast", round(lat, 4), round(lon, 4), hourly), 300, load)


def airport_events(airport_id):
    def load():
        value = data.fetch(FAA_EVENTS)
        if not isinstance(value, list) or any(
            not isinstance(row, dict) or not row.get("airportId") for row in value
        ):
            raise data.DataUnavailable("Invalid FAA NAS airport-events response")
        return value, data.source("FAA National Airspace System Status", FAA_EVENTS)

    records, source = data.cached(("faa-airport-events",), 60, load)
    selected = [r for r in records if not airport_id or r["airportId"] == airport_id.upper()]
    return {
        "status": "available" if selected else "no_reports",
        "records": selected,
        "truncated": False,
        "source": source,
        "limitations": "NAS airport-event summaries: ground stops/delays, closures and related events. Airport filter is the FAA airport ID (e.g. JFK), not an inferred ICAO mapping. Not a complete NOTAM feed.",
    }
