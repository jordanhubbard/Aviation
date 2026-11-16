"""Fixed AWC JSON acquisition over an explicitly trusted bounded HTTP transport."""

from __future__ import annotations

import re
from collections.abc import Callable
from typing import Any

AWC_ORIGIN = "https://aviationweather.gov"
AWC_DATA_URL = AWC_ORIGIN + "/api/data/"


class AWCJSONError(RuntimeError):
    def __init__(self, kind: str):
        self.kind = kind
        super().__init__(
            "Invalid AWC JSON request"
            if kind == "request"
            else "AWC JSON reports unavailable"
        )


def _station(value: Any) -> str:
    if not isinstance(value, str) or len(value) > 8192:
        raise AWCJSONError("request")
    normalized = value.strip(" \t\r\n")
    if not re.fullmatch(r"[A-Za-z0-9][A-Za-z0-9_.-]{0,79}", normalized):
        raise AWCJSONError("request")
    return normalized.upper()


def fetch_awc_json_reports(product: str, params: Any, transport: Callable) -> dict:
    """Invoke transport once; preserve raw reports with no retry or stale fallback."""
    if (
        product not in ("metar", "taf", "pirep", "gairmet", "airsigmet", "cwa")
        or not isinstance(params, dict)
        or not callable(transport)
    ):
        raise AWCJSONError("request")
    if product in ("metar", "taf"):
        if (
            set(params) != {"ids"}
            or not isinstance(params["ids"], str)
            or len(params["ids"]) > 8192
        ):
            raise AWCJSONError("request")
        ids = params["ids"].split(",")
        if len(ids) > 40:
            raise AWCJSONError("request")
        query = {"ids": ",".join(_station(station) for station in ids)}
    elif product == "pirep":
        if set(params) != {"id", "distance", "age"}:
            raise AWCJSONError("request")
        distance, age = params["distance"], params["age"]
        if (
            type(distance) not in (int, float)
            or not 1 <= distance <= 500
            or type(age) not in (int, float)
            or not 1 <= age <= 24
            or int(age) != age
        ):
            raise AWCJSONError("request")
        query = {"id": _station(params["id"]), "distance": distance, "age": age}
    else:
        if params:
            raise AWCJSONError("request")
        query = {}
    url = AWC_DATA_URL + product
    failed = False
    try:
        reports = transport(url, {**query, "format": "json"})
    except Exception:
        failed = True
    if failed:
        # Raise outside the except suite so the generic error retains no private
        # transport exception through Python's implicit __context__ chain.
        raise AWCJSONError("provider") from None
    if not isinstance(reports, list) or any(
        not isinstance(report, dict) for report in reports
    ):
        raise AWCJSONError("response")
    return {"url": url, "reports": reports}
