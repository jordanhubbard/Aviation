from __future__ import annotations

import os
import re
from fractions import Fraction
from typing import Any, Dict, Optional, Sequence

import httpx

from app.utils.ttl_cache import weather_cache


def fetch_metar_raws(stations: Sequence[str]) -> Dict[str, Optional[str]]:
    if os.environ.get("DISABLE_METAR_FETCH") == "1":
        return {str(s).strip().upper(): None for s in stations if str(s).strip()}

    # Normalize and de-dupe while preserving order.
    stations_u: list[str] = []
    seen: set[str] = set()
    for s in stations:
        su = str(s).strip().upper()
        if not su or su in seen:
            continue
        seen.add(su)
        stations_u.append(su)

    out: Dict[str, Optional[str]] = {s: None for s in stations_u}

    missing: list[str] = []
    stale: Dict[str, Optional[str]] = {}
    for s in stations_u:
        key = f"metar:{s}"
        cached = weather_cache.get(key)
        if cached is not None:
            out[s] = cached
            continue
        missing.append(s)
        stale[key] = weather_cache.get_stale(key)

    if not missing:
        return out

    try:
        resp = httpx.get(
            "https://aviationweather.gov/api/data/metar",
            params={"ids": ",".join(missing), "format": "raw"},
            headers={"User-Agent": "flightplanner"},
            timeout=20,
        )

        if resp.status_code == 204:
            return out

        resp.raise_for_status()
        lines = [ln.strip() for ln in resp.text.splitlines() if ln.strip()]

        found: Dict[str, str] = {}
        for ln in lines:
            # Expected: "KSFO 201356Z ..." (station code first)
            code = ln.split(maxsplit=1)[0].strip().upper() if ln else ""
            if code and code in out:
                found[code] = ln

        for s in missing:
            raw = found.get(s)
            if raw:
                out[s] = raw
                weather_cache.set(f"metar:{s}", raw, ttl_s=300)

        return out
    except Exception:
        # Best-effort: fall back to stale values if present, otherwise keep None.
        for s in missing:
            skey = f"metar:{s}"
            if stale.get(skey) is not None:
                out[s] = stale[skey]
        return out


def fetch_metar_raw(station: str) -> Optional[str]:
    if os.environ.get("DISABLE_METAR_FETCH") == "1":
        return None

    station_u = station.upper()
    cache_key = f"metar:{station_u}"

    def _fetch() -> Optional[str]:
        resp = httpx.get(
            "https://aviationweather.gov/api/data/metar",
            params={"ids": station_u, "format": "raw"},
            headers={"User-Agent": "flightplanner"},
            timeout=20,
        )

        if resp.status_code == 204:
            return None

        resp.raise_for_status()
        text = resp.text.strip()
        if not text:
            return None

        # API may return multiple lines; we only requested a single station.
        return text.splitlines()[0].strip() or None

    return weather_cache.get_or_set(cache_key, ttl_s=300, fn=_fetch, allow_stale_on_error=True)


_WIND_RE = re.compile(r"\b(?P<dir>\d{3}|VRB)(?P<speed>\d{2,3})(G(?P<gust>\d{2,3}))?KT\b")
_TEMP_RE = re.compile(r"\b(?P<t>M?\d{2})/(?P<d>M?\d{2})\b")
_VIS_RE = re.compile(r"\b(?P<vis>(P?\d+)(?:\s\d/\d)?|\d+/\d)SM\b")
_CEIL_RE = re.compile(r"\b(?P<kind>BKN|OVC|VV)(?P<hundreds>\d{3})\b")


def _parse_signed_int(token: str) -> int:
    if token.startswith("M"):
        return -int(token[1:])
    return int(token)


def _parse_visibility_sm(token: str) -> Optional[float]:
    token = token.strip().removesuffix("SM")
    if token.startswith("P"):
        try:
            return float(token[1:])
        except Exception:
            return None

    if " " in token:
        whole, frac = token.split(" ", 1)
        try:
            return float(int(whole) + float(Fraction(frac)))
        except Exception:
            return None

    if "/" in token:
        try:
            return float(Fraction(token))
        except Exception:
            return None

    try:
        return float(token)
    except Exception:
        return None


def parse_metar(raw: str) -> Dict[str, Any]:
    out: Dict[str, Any] = {}

    wind_m = _WIND_RE.search(raw)
    if wind_m:
        d = wind_m.group("dir")
        out["wind_direction"] = None if d == "VRB" else int(d)
        out["wind_speed_kt"] = int(wind_m.group("speed"))

    vis_m = _VIS_RE.search(raw)
    if vis_m:
        vis = _parse_visibility_sm(vis_m.group("vis"))
        if vis is not None:
            out["visibility_sm"] = vis

    temps = _TEMP_RE.search(raw)
    if temps:
        try:
            c = _parse_signed_int(temps.group("t"))
            out["temperature_f"] = round((c * 9 / 5) + 32)
        except Exception:
            pass

    ceilings = []
    for m in _CEIL_RE.finditer(raw):
        try:
            ceilings.append(int(m.group("hundreds")) * 100)
        except Exception:
            continue
    if ceilings:
        out["ceiling_ft"] = min(ceilings)

    return out
