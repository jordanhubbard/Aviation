from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Dict, Iterable, List, Literal, Optional, Tuple


FlightCategory = Literal["VFR", "MVFR", "IFR", "LIFR", "UNKNOWN"]


@dataclass(frozen=True)
class FlightCategoryThresholds:
    vfr_ceiling_ft: int = 3000
    vfr_visibility_sm: float = 5.0
    mvfr_ceiling_ft: int = 1000
    mvfr_visibility_sm: float = 3.0
    ifr_ceiling_ft: int = 500
    ifr_visibility_sm: float = 1.0


def flight_category(
    *,
    visibility_sm: Optional[float],
    ceiling_ft: Optional[float],
    thresholds: FlightCategoryThresholds = FlightCategoryThresholds(),
) -> FlightCategory:
    if visibility_sm is None or ceiling_ft is None:
        return "UNKNOWN"

    vis = float(visibility_sm)
    ceil = float(ceiling_ft)

    if vis < thresholds.ifr_visibility_sm or ceil < thresholds.ifr_ceiling_ft:
        return "LIFR"
    if vis < thresholds.mvfr_visibility_sm or ceil < thresholds.mvfr_ceiling_ft:
        return "IFR"
    if vis < thresholds.vfr_visibility_sm or ceil < thresholds.vfr_ceiling_ft:
        return "MVFR"
    return "VFR"


def recommendation_for_category(cat: FlightCategory) -> str:
    if cat == "VFR":
        return "VFR conditions. Routine VFR flight should be feasible."
    if cat == "MVFR":
        return "Marginal VFR conditions. Consider delaying, changing route, or filing IFR if qualified."
    if cat == "IFR":
        return "IFR conditions. VFR flight is not recommended."
    if cat == "LIFR":
        return "Low IFR conditions. VFR flight is not recommended."
    return "Insufficient data to assess VFR/IFR suitability."


def warnings_for_conditions(
    *, visibility_sm: Optional[float], ceiling_ft: Optional[float], wind_speed_kt: Optional[float]
) -> List[str]:
    out: List[str] = []
    if visibility_sm is not None and visibility_sm < 5:
        out.append(f"Reduced visibility ({visibility_sm:.1f} SM).")
    if ceiling_ft is not None and ceiling_ft < 3000:
        out.append(f"Low ceiling ({ceiling_ft:.0f} ft).")
    if wind_speed_kt is not None and wind_speed_kt >= 20:
        out.append(f"High winds ({wind_speed_kt:.0f} kt).")
    return out


def _meters_to_sm(meters: Optional[float]) -> Optional[float]:
    if meters is None:
        return None
    try:
        return float(meters) / 1609.34
    except Exception:
        return None


def estimate_ceiling_ft_from_cloudcover(cloud_pct: Optional[float]) -> Optional[float]:
    if cloud_pct is None:
        return None
    try:
        pct = float(cloud_pct)
    except Exception:
        return None

    # Very rough heuristic mirroring the OpenWeatherMap fallback.
    if pct >= 75:
        return 1500.0
    if pct >= 50:
        return 3000.0
    if pct >= 25:
        return 5000.0
    return 10000.0


def score_hour(
    *, cat: FlightCategory, precipitation_mm: Optional[float], wind_speed_kt: Optional[float]
) -> float:
    cat_weight = {"VFR": 4.0, "MVFR": 3.0, "IFR": 2.0, "LIFR": 1.0, "UNKNOWN": 0.5}[cat]
    precip = max(0.0, float(precipitation_mm)) if precipitation_mm is not None else 0.0
    wind = max(0.0, float(wind_speed_kt)) if wind_speed_kt is not None else 0.0

    # Higher is better.
    return (cat_weight * 100.0) - (precip * 15.0) - (max(0.0, wind - 10.0) * 2.0)


def best_departure_windows(
    hourly: Iterable[Dict[str, Any]],
    *,
    window_hours: int = 3,
    max_windows: int = 3,
) -> List[Dict[str, Any]]:
    rows = list(hourly)
    if window_hours < 1 or len(rows) < window_hours:
        return []

    scored: List[Tuple[float, Dict[str, Any]]] = []
    for i in range(0, len(rows) - window_hours + 1):
        window = rows[i : i + window_hours]
        if not window:
            continue

        # Aggregate using simple means.
        def _mean(key: str) -> Optional[float]:
            vals = [w.get(key) for w in window if isinstance(w.get(key), (int, float))]
            if not vals:
                return None
            return float(sum(vals)) / len(vals)

        vis_sm = _meters_to_sm(_mean("visibility_m"))
        ceiling_ft = estimate_ceiling_ft_from_cloudcover(_mean("cloudcover_pct"))
        precip_mm = _mean("precipitation_mm")
        wind_kt = _mean("wind_speed_kt")

        cat = flight_category(visibility_sm=vis_sm, ceiling_ft=ceiling_ft)
        score = score_hour(cat=cat, precipitation_mm=precip_mm, wind_speed_kt=wind_kt)

        scored.append(
            (
                score,
                {
                    "start_time": str(window[0].get("time")),
                    "end_time": str(window[-1].get("time")),
                    "score": round(score, 1),
                    "flight_category": cat,
                },
            )
        )

    scored.sort(key=lambda t: t[0], reverse=True)
    return [row for _, row in scored[:max_windows]]
