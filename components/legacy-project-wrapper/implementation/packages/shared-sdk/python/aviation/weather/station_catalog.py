"""AWC catalog semantics; trusted transport owns bounded gzip/JSON decoding."""

from __future__ import annotations

import math
import re
from collections.abc import Callable
from typing import Any

from .awc import AWC_ORIGIN

AWC_STATION_CATALOG_URL = AWC_ORIGIN + "/data/cache/stations.cache.json.gz"


class AWCStationCatalogError(RuntimeError):
    def __init__(self, kind: str):
        self.kind = kind
        super().__init__(
            "Invalid AWC station catalog request"
            if kind == "request"
            else "AWC station catalog unavailable"
        )


def _identifier(value: Any) -> bool:
    return (
        isinstance(value, str)
        and re.fullmatch(r"[A-Za-z0-9][A-Za-z0-9_.-]{0,79}", value) is not None
    )


def _coordinate(value: Any) -> bool:
    # Range checks before math.isfinite also reject arbitrarily large integers.
    return type(value) in (int, float) and -180 <= value <= 180 and math.isfinite(value)


def interpret_awc_station_catalog(payload: Any) -> dict:
    if not isinstance(payload, list) or not 1 <= len(payload) <= 50000:
        raise AWCStationCatalogError("response")
    stations, unlocated_taf = [], []
    excluded = 0
    for row in payload:
        if (
            not isinstance(row, dict)
            or not _identifier(row.get("id"))
            or (row.get("icaoId") not in (None, "") and not _identifier(row["icaoId"]))
            or not isinstance(row.get("siteType"), list)
            or any(not isinstance(product, str) for product in row["siteType"])
        ):
            raise AWCStationCatalogError("response")
        lat, lon = row.get("lat"), row.get("lon")
        if not _coordinate(lat) or not _coordinate(lon):
            raise AWCStationCatalogError("response")
        if -100 < lat <= -99 and -100 < lon <= -99:
            excluded += 1
            if "TAF" in row["siteType"] and row.get("icaoId"):
                unlocated_taf.append(row["icaoId"])
        else:
            if not -90 <= lat <= 90 or not -180 <= lon <= 180:
                raise AWCStationCatalogError("response")
            stations.append(row)
    return {
        "stations": stations,
        "total_catalog_records": len(payload),
        "excluded_unlocated_count": excluded,
        "unlocated_taf_station_ids": unlocated_taf,
    }


def fetch_awc_station_catalog(transport: Callable) -> dict:
    if not callable(transport):
        raise AWCStationCatalogError("request")
    failed = False
    try:
        payload = transport(AWC_STATION_CATALOG_URL, {})
    except Exception:
        failed = True
    if failed:
        raise AWCStationCatalogError("provider") from None
    return {"url": AWC_STATION_CATALOG_URL, **interpret_awc_station_catalog(payload)}
