"""METAR acquisition and provider-neutral parsing."""

from __future__ import annotations

import os
import re
from fractions import Fraction
from typing import Any, Dict, Optional, Sequence

import httpx

from .cache import weather_cache

_WIND_RE = re.compile(
    r"\b(?P<dir>\d{3}|VRB)(?P<speed>\d{2,3})(?:G(?P<gust>\d{2,3}))?KT\b"
)
_VIS_RE = re.compile(r"\b(?P<vis>(?:P?\d+)(?:\s+\d+/\d+)?|\d+/\d+)SM\b")
_TEMP_RE = re.compile(r"\b(?P<t>M?\d{2})/(?P<d>M?\d{2})\b")
_CLOUD_RE = re.compile(r"\b(?P<kind>FEW|SCT|BKN|OVC|VV)(?P<hundreds>\d{3})\b")
_WEATHER_RE = re.compile(
    r"^[+-]?(?:VC)?(?:MI|PR|BC|DR|BL|SH|TS|FZ)?"
    r"(?:DZ|RA|SN|SG|IC|PL|GR|GS|UP|BR|FG|FU|VA|DU|SA|HZ|PO|SQ|FC|SS|DS)$"
)


def _normalized_stations(stations: Sequence[str]) -> list[str]:
    result: list[str] = []
    seen: set[str] = set()
    for station in stations:
        normalized = str(station).strip().upper()
        if normalized and normalized not in seen:
            seen.add(normalized)
            result.append(normalized)
    return result


def fetch_metar_raws(stations: Sequence[str]) -> Dict[str, Optional[str]]:
    """Fetch raw METARs with normalized identifiers and stale cache fallback."""
    stations_u = _normalized_stations(stations)
    if os.environ.get("DISABLE_METAR_FETCH") == "1":
        return {station: None for station in stations_u}

    result: Dict[str, Optional[str]] = {station: None for station in stations_u}
    missing: list[str] = []
    stale: Dict[str, Optional[str]] = {}
    for station in stations_u:
        key = f"metar:{station}"
        cached = weather_cache.get(key)
        if cached is not None:
            result[station] = cached
        else:
            missing.append(station)
            stale[key] = weather_cache.get_stale(key)

    if not missing:
        return result

    try:
        response = httpx.get(
            "https://aviationweather.gov/api/data/metar",
            params={"ids": ",".join(missing), "format": "raw"},
            headers={"User-Agent": "aviation-shared-sdk"},
            timeout=20,
        )
        if response.status_code == 204:
            return result
        response.raise_for_status()
        found: Dict[str, str] = {}
        for line in response.text.splitlines():
            raw = line.strip()
            code = raw.split(maxsplit=1)[0].upper() if raw else ""
            if code in result:
                found[code] = raw
        for station in missing:
            raw = found.get(station)
            if raw:
                result[station] = raw
                weather_cache.set(f"metar:{station}", raw, ttl_s=300)
        return result
    except Exception:
        for station in missing:
            cached = stale[f"metar:{station}"]
            if cached is not None:
                result[station] = cached
        return result


def fetch_metar_raw(station: str) -> Optional[str]:
    """Fetch the first raw METAR for one station."""
    normalized = str(station).strip().upper()
    if not normalized:
        return None
    return fetch_metar_raws([normalized]).get(normalized)


def _signed(token: str) -> int:
    return -int(token[1:]) if token.startswith("M") else int(token)


def _visibility(token: str) -> Optional[float]:
    token = token.strip()
    if token.startswith("P"):
        token = token[1:]
    try:
        if " " in token:
            whole, fraction = token.split(maxsplit=1)
            return float(whole) + float(Fraction(fraction))
        if "/" in token:
            return float(Fraction(token))
        return float(token)
    except (ValueError, ZeroDivisionError):
        return None


def parse_metar(raw: str) -> Dict[str, Any]:
    """Parse common METAR fields into the cross-language Aviation shape."""
    result: Dict[str, Any] = {
        "raw": raw,
        "station": None,
        "time": None,
        "wind_dir": None,
        "wind_direction": None,
        "wind_speed_kt": None,
        "wind_gust_kt": None,
        "visibility_sm": None,
        "temperature_c": None,
        "temperature_f": None,
        "dewpoint_c": None,
        "altimeter_inhg": None,
        "ceiling_ft": None,
        "clouds": [],
        "weather": [],
    }
    if not raw:
        return result

    tokens = raw.split()
    if tokens and re.fullmatch(r"[A-Z]{4}", tokens[0]):
        result["station"] = tokens[0]
    if len(tokens) > 1 and re.fullmatch(r"\d{6}Z", tokens[1]):
        result["time"] = tokens[1]

    wind = _WIND_RE.search(raw)
    if wind:
        direction = None if wind.group("dir") == "VRB" else int(wind.group("dir"))
        result["wind_dir"] = direction
        result["wind_direction"] = direction
        result["wind_speed_kt"] = int(wind.group("speed"))
        if wind.group("gust"):
            result["wind_gust_kt"] = int(wind.group("gust"))

    visibility = _VIS_RE.search(raw)
    if visibility:
        result["visibility_sm"] = _visibility(visibility.group("vis"))

    temperatures = _TEMP_RE.search(raw)
    if temperatures:
        temperature_c = _signed(temperatures.group("t"))
        result["temperature_c"] = temperature_c
        result["temperature_f"] = round((temperature_c * 9 / 5) + 32)
        result["dewpoint_c"] = _signed(temperatures.group("d"))

    ceilings: list[int] = []
    for cloud in _CLOUD_RE.finditer(raw):
        altitude_ft = int(cloud.group("hundreds")) * 100
        kind = cloud.group("kind")
        result["clouds"].append({"coverage": kind, "altitude_ft": altitude_ft})
        if kind in {"BKN", "OVC", "VV"}:
            ceilings.append(altitude_ft)
    if ceilings:
        result["ceiling_ft"] = min(ceilings)

    result["weather"] = [token for token in tokens if _WEATHER_RE.fullmatch(token)]
    altimeter = re.search(r"\bA(?P<value>\d{4})\b", raw)
    if altimeter:
        result["altimeter_inhg"] = int(altimeter.group("value")) / 100
    return result
