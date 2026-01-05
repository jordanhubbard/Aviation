from __future__ import annotations

import difflib
import math
import re
from typing import Any, Dict, List, Optional, Tuple

from app.utils.data_loader import load_airports


def load_airport_cache() -> List[Dict[str, Any]]:
    return load_airports()


def _normalize_airport_code(value: str) -> str:
    """Extract the leading airport code from user-provided strings.

    Accept inputs like "KPAO - Palo Alto Airport" and return "KPAO".
    """

    if not value:
        return ""

    before_dash = re.split(r"\s*[-–—]\s*", value.strip(), maxsplit=1)[0]
    token = before_dash.strip().split()[0] if before_dash.strip() else ""
    token_u = token.upper()

    if re.fullmatch(r"[A-Z0-9]{3,5}", token_u):
        return token_u

    return value.strip().upper()


def _candidate_codes(code_u: str) -> set[str]:
    codes = {code_u}

    # Our airport cache stores many US local identifiers as pseudo-ICAO codes prefixed with 'K'
    # (e.g., 7S5 -> K7S5). Allow lookups by the FAA/local code.
    if (
        code_u
        and not code_u.startswith("K")
        and (len(code_u) == 3 or (3 <= len(code_u) <= 4 and any(ch.isdigit() for ch in code_u)))
    ):
        codes.add(f"K{code_u}")

    if code_u.startswith("K") and 4 <= len(code_u) <= 5:
        codes.add(code_u[1:])

    return codes


def get_airport_coordinates(code: str) -> Optional[Dict[str, Any]]:
    code_u = _normalize_airport_code(code)
    candidates = _candidate_codes(code_u)

    for airport in load_airport_cache():
        icao_code = (airport.get("icao") or airport.get("icaoCode") or "").upper()
        iata_code = (airport.get("iata") or airport.get("iataCode") or "").upper()

        if not ({icao_code, iata_code} & candidates):
            continue

        lat, lon = _extract_lat_lon(airport)
        if lat is None or lon is None:
            continue

        return {
            "icao": icao_code,
            "iata": iata_code,
            "name": airport.get("name"),
            "city": airport.get("city"),
            "country": airport.get("country"),
            "latitude": float(lat),
            "longitude": float(lon),
            "elevation": airport.get("elevation"),
            "type": airport.get("type"),
        }

    return None


def _extract_lat_lon(airport: Dict[str, Any]) -> Tuple[Optional[float], Optional[float]]:
    if "geometry" in airport and isinstance(airport["geometry"], dict):
        coords = airport["geometry"].get("coordinates")
        if isinstance(coords, list) and len(coords) == 2:
            lon, lat = coords
            return _to_float(lat), _to_float(lon)

    return _to_float(airport.get("lat") or airport.get("latitude")), _to_float(
        airport.get("lon") or airport.get("longitude")
    )


def _to_float(v: Any) -> Optional[float]:
    if v is None:
        return None
    try:
        return float(v)
    except Exception:
        return None


def search_airports(query: str, *, limit: int = 20) -> List[Dict[str, Any]]:
    return search_airports_advanced(query=query, limit=limit)


def _haversine_nm(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    r_nm = 3440.065
    phi1 = math.radians(lat1)
    phi2 = math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlambda = math.radians(lon2 - lon1)
    a = math.sin(dphi / 2) ** 2 + math.cos(phi1) * math.cos(phi2) * math.sin(dlambda / 2) ** 2
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
    return r_nm * c


def search_airports_advanced(
    *,
    query: str | None,
    limit: int = 20,
    lat: float | None = None,
    lon: float | None = None,
    radius_nm: float | None = None,
) -> List[Dict[str, Any]]:
    q = (query or "").strip().lower()
    has_geo = lat is not None and lon is not None

    if not q and not has_geo:
        return []

    candidates: List[Tuple[float, float, Dict[str, Any]]] = []
    seen: set[str] = set()

    for airport in load_airport_cache():
        icao_code = (airport.get("icao") or airport.get("icaoCode") or "").upper()
        iata_code = (airport.get("iata") or airport.get("iataCode") or "").upper()
        alt_codes = _candidate_codes(icao_code)
        name = str(airport.get("name") or "")
        city = str(airport.get("city") or "")
        country = str(airport.get("country") or "")

        lat_v, lon_v = _extract_lat_lon(airport)
        if lat_v is None or lon_v is None:
            continue

        dist_nm: float | None = None
        if has_geo:
            dist_nm = _haversine_nm(float(lat), float(lon), float(lat_v), float(lon_v))
            if radius_nm is not None and dist_nm > float(radius_nm):
                continue

        normalized = {
            "icao": icao_code,
            "iata": iata_code,
            "name": airport.get("name"),
            "city": airport.get("city") or "",
            "country": airport.get("country") or "",
            "latitude": float(lat_v),
            "longitude": float(lon_v),
            "elevation": airport.get("elevation"),
            "type": airport.get("type") or "",
        }

        key = (
            normalized["icao"]
            or normalized["iata"]
            or f"{normalized['latitude']},{normalized['longitude']}"
        )
        if key in seen:
            continue
        seen.add(key)

        score = 0.0
        if q:
            code_hay = " ".join(sorted({icao_code, iata_code, *alt_codes})).lower()
            text_hay = f"{code_hay} {name} {city} {country}".lower()

            if q in {c.lower() for c in {icao_code, iata_code, *alt_codes} if c}:
                score = 1.0
            elif icao_code.lower().startswith(q):
                score = 0.95
            elif iata_code.lower().startswith(q):
                score = 0.9
            elif q in code_hay:
                score = 0.85
            elif q in text_hay:
                score = 0.65
            else:
                ratio = max(
                    difflib.SequenceMatcher(None, q, icao_code.lower()).ratio(),
                    difflib.SequenceMatcher(None, q, iata_code.lower()).ratio(),
                    difflib.SequenceMatcher(None, q, name.lower()).ratio(),
                )
                if ratio < 0.6:
                    continue
                score = 0.5 + (ratio - 0.6) * 0.5

        if dist_nm is not None:
            normalized["distance_nm"] = round(dist_nm, 2)

        candidates.append((score, dist_nm if dist_nm is not None else float("inf"), normalized))

    if has_geo and not q:
        candidates.sort(key=lambda t: t[1])
    else:
        candidates.sort(key=lambda t: (-t[0], t[1]))

    return [item[2] for item in candidates[:limit]]
