from __future__ import annotations

from dataclasses import dataclass
from typing import List, Optional, Sequence, Set

from app.models.airport import search_airports_advanced
from app.schemas.route import AlternateAirport, AlternateWeather
from app.services import metar


ALLOWED_AIRPORT_TYPES: Set[str] = {
    "large_airport",
    "medium_airport",
    "small_airport",
}


@dataclass(frozen=True)
class AlternateThresholds:
    min_visibility_sm: float = 3.0
    min_ceiling_ft: int = 1000
    preferred_visibility_sm: float = 5.0
    preferred_ceiling_ft: int = 2000


def _airport_code(ap: dict) -> str:
    return str(ap.get("icao") or ap.get("iata") or "").strip().upper()


def recommend_alternates(
    *,
    destination_lat: float,
    destination_lon: float,
    exclude_codes: Sequence[str] = (),
    radius_nm: float = 75.0,
    limit: int = 5,
    max_candidates: int = 30,
    max_metar_fetch: int = 15,
    thresholds: AlternateThresholds = AlternateThresholds(),
) -> List[AlternateAirport]:
    exclude = {c.strip().upper() for c in exclude_codes if c}
    # Match our pseudo-ICAO storage for US local identifiers (e.g. 7S5 <-> K7S5).
    for c in list(exclude):
        if c and not c.startswith("K") and (len(c) == 3 or any(ch.isdigit() for ch in c)):
            exclude.add(f"K{c}")
        if c.startswith("K") and len(c) >= 4:
            exclude.add(c[1:])

    candidates = search_airports_advanced(
        query=None,
        limit=max_candidates,
        lat=float(destination_lat),
        lon=float(destination_lon),
        radius_nm=float(radius_nm),
    )

    scored: List[tuple[float, AlternateAirport]] = []

    filtered: List[dict] = []
    for ap in candidates:
        code = _airport_code(ap)
        if not code or code in exclude:
            continue

        ap_type = str(ap.get("type") or "")
        if ap_type and ap_type not in ALLOWED_AIRPORT_TYPES:
            continue

        filtered.append(ap)

    metar_codes = [_airport_code(ap) for ap in filtered[:max_metar_fetch] if _airport_code(ap)]
    metars = metar.fetch_metar_raws(metar_codes)

    for idx, ap in enumerate(filtered):
        code = _airport_code(ap)
        if not code or code in exclude:
            continue

        ap_type = str(ap.get("type") or "")

        dist = ap.get("distance_nm")
        try:
            dist_nm = float(dist) if dist is not None else 0.0
        except Exception:
            dist_nm = 0.0

        weather: Optional[AlternateWeather] = None
        penalty = 0.0

        raw_metar = None
        parsed = None

        if idx < max_metar_fetch:
            raw_metar = metars.get(code)
            if raw_metar:
                parsed = metar.parse_metar(raw_metar)
        else:
            penalty += 50.0

        if raw_metar and parsed is not None:
            vis = parsed.get("visibility_sm")
            ceil = parsed.get("ceiling_ft")

            if isinstance(vis, (int, float)) and float(vis) < thresholds.min_visibility_sm:
                continue
            if isinstance(ceil, int) and ceil < thresholds.min_ceiling_ft:
                continue

            if isinstance(vis, (int, float)) and float(vis) < thresholds.preferred_visibility_sm:
                penalty += 25.0
            if isinstance(ceil, int) and ceil < thresholds.preferred_ceiling_ft:
                penalty += 25.0

            weather = AlternateWeather(
                metar=raw_metar,
                visibility_sm=float(vis) if isinstance(vis, (int, float)) else None,
                ceiling_ft=int(ceil) if isinstance(ceil, int) else None,
                wind_speed_kt=(
                    int(parsed["wind_speed_kt"])
                    if isinstance(parsed.get("wind_speed_kt"), int)
                    else None
                ),
                wind_direction_deg=(
                    int(parsed["wind_direction"])
                    if isinstance(parsed.get("wind_direction"), int)
                    else None
                ),
                temperature_f=(
                    int(parsed["temperature_f"])
                    if isinstance(parsed.get("temperature_f"), int)
                    else None
                ),
            )
        else:
            penalty += 50.0

        scored.append(
            (
                dist_nm + penalty,
                AlternateAirport(
                    code=code,
                    name=ap.get("name"),
                    type=ap_type or None,
                    distance_nm=round(dist_nm, 1),
                    weather=weather,
                ),
            )
        )

    scored.sort(key=lambda t: t[0])
    return [a for _, a in scored[:limit]]
