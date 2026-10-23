"""
Flight Category Determination and Weather Analysis

Determines VFR/IFR flight categories based on ceiling and visibility,
provides recommendations, warnings, and scoring for departure windows.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Dict, Iterable, List, Literal, Optional, Tuple

FlightCategory = Literal["VFR", "MVFR", "IFR", "LIFR", "UNKNOWN"]


@dataclass(frozen=True)
class FlightCategoryThresholds:
    """
    Thresholds for determining flight categories.
    
    Defaults match FAA definitions:
    - VFR: Ceiling >= 3000ft, Visibility >= 5 SM
    - MVFR: Ceiling >= 1000ft, Visibility >= 3 SM
    - IFR: Ceiling >= 500ft, Visibility >= 1 SM
    - LIFR: Below IFR minimums
    """
    vfr_ceiling_ft: int = 3000
    vfr_visibility_sm: float = 5.0
    mvfr_ceiling_ft: int = 1000
    mvfr_visibility_sm: float = 3.0
    ifr_ceiling_ft: int = 500
    ifr_visibility_sm: float = 1.0


DEFAULT_THRESHOLDS = FlightCategoryThresholds()


def flight_category(
    *,
    visibility_sm: Optional[float],
    ceiling_ft: Optional[float],
    thresholds: FlightCategoryThresholds = DEFAULT_THRESHOLDS,
) -> FlightCategory:
    """
    Determine flight category from ceiling and visibility.
    
    Args:
        visibility_sm: Visibility in statute miles
        ceiling_ft: Ceiling in feet AGL
        thresholds: Custom thresholds (uses FAA defaults if not provided)
        
    Returns:
        Flight category: VFR, MVFR, IFR, LIFR, or UNKNOWN
        
    Example:
        >>> flight_category(visibility_sm=10.0, ceiling_ft=5000)
        'VFR'
        >>> flight_category(visibility_sm=2.0, ceiling_ft=800)
        'IFR'
    """
    if visibility_sm is None or ceiling_ft is None:
        return "UNKNOWN"

    vis = float(visibility_sm)
    ceil = float(ceiling_ft)

    # LIFR: Below IFR minimums
    if vis < thresholds.ifr_visibility_sm or ceil < thresholds.ifr_ceiling_ft:
        return "LIFR"
    
    # IFR: Below MVFR minimums
    if vis < thresholds.mvfr_visibility_sm or ceil < thresholds.mvfr_ceiling_ft:
        return "IFR"
    
    # MVFR: Below VFR minimums
    if vis < thresholds.vfr_visibility_sm or ceil < thresholds.vfr_ceiling_ft:
        return "MVFR"
    
    # VFR: Meets or exceeds VFR minimums
    return "VFR"


def recommendation_for_category(category: FlightCategory) -> str:
    """
    Get flight recommendation based on category.
    
    Args:
        category: Flight category
        
    Returns:
        Human-readable recommendation string
        
    Example:
        >>> recommendation_for_category("VFR")
        'VFR conditions. Routine VFR flight should be feasible.'
    """
    recommendations = {
        "VFR": "VFR conditions. Routine VFR flight should be feasible.",
        "MVFR": "Marginal VFR conditions. Consider delaying, changing route, or filing IFR if qualified.",
        "IFR": "IFR conditions. VFR flight is not recommended.",
        "LIFR": "Low IFR conditions. VFR flight is not recommended.",
        "UNKNOWN": "Insufficient data to assess VFR/IFR suitability.",
    }
    return recommendations.get(category, recommendations["UNKNOWN"])


def warnings_for_conditions(
    *,
    visibility_sm: Optional[float],
    ceiling_ft: Optional[float],
    wind_speed_kt: Optional[float],
) -> List[str]:
    """
    Generate warnings for marginal weather conditions.
    
    Args:
        visibility_sm: Visibility in statute miles
        ceiling_ft: Ceiling in feet AGL
        wind_speed_kt: Wind speed in knots
        
    Returns:
        List of warning messages
        
    Example:
        >>> warnings_for_conditions(visibility_sm=3.0, ceiling_ft=2000, wind_speed_kt=25)
        ['Reduced visibility (3.0 SM).', 'Low ceiling (2000 ft).', 'High winds (25 kt).']
    """
    warnings: List[str] = []
    
    if visibility_sm is not None and visibility_sm < 5:
        warnings.append(f"Reduced visibility ({visibility_sm:.1f} SM).")
    
    if ceiling_ft is not None and ceiling_ft < 3000:
        warnings.append(f"Low ceiling ({ceiling_ft:.0f} ft).")
    
    if wind_speed_kt is not None and wind_speed_kt >= 20:
        warnings.append(f"High winds ({wind_speed_kt:.0f} kt).")
    
    return warnings


def meters_to_sm(meters: Optional[float]) -> Optional[float]:
    """
    Convert meters to statute miles.
    
    Args:
        meters: Distance in meters
        
    Returns:
        Distance in statute miles, or None if input is None
    """
    if meters is None:
        return None
    try:
        return float(meters) / 1609.34
    except Exception:
        return None


def estimate_ceiling_from_cloudcover(cloud_pct: Optional[float]) -> Optional[float]:
    """
    Estimate ceiling height from cloud cover percentage.
    
    This is a rough heuristic when actual ceiling data is unavailable.
    
    Args:
        cloud_pct: Cloud cover percentage (0-100)
        
    Returns:
        Estimated ceiling in feet AGL, or None if input is None
        
    Note:
        This is a fallback estimation and should not replace actual ceiling data
        when available from METAR or other sources.
    """
    if cloud_pct is None:
        return None
    
    try:
        pct = float(cloud_pct)
    except Exception:
        return None

    # Heuristic mapping (very rough approximation)
    if pct >= 75:
        return 1500.0  # Overcast - low ceiling
    if pct >= 50:
        return 3000.0  # Broken - moderate ceiling
    if pct >= 25:
        return 5000.0  # Scattered - high ceiling
    return 10000.0  # Few/clear - very high ceiling


def score_hour(
    *,
    category: FlightCategory,
    precipitation_mm: Optional[float],
    wind_speed_kt: Optional[float],
) -> float:
    """
    Score an hour for flight suitability (higher is better).
    
    Takes into account flight category, precipitation, and wind.
    
    Args:
        category: Flight category for the hour
        precipitation_mm: Precipitation in millimeters
        wind_speed_kt: Wind speed in knots
        
    Returns:
        Numerical score where higher values indicate better conditions
        
    Example:
        >>> score_hour(category="VFR", precipitation_mm=0.0, wind_speed_kt=5.0)
        400.0
    """
    # Base score from flight category
    category_weights = {
        "VFR": 4.0,
        "MVFR": 3.0,
        "IFR": 2.0,
        "LIFR": 1.0,
        "UNKNOWN": 0.5,
    }
    cat_weight = category_weights.get(category, 0.5)
    
    # Penalize precipitation
    precip = max(0.0, float(precipitation_mm)) if precipitation_mm is not None else 0.0
    
    # Penalize winds above 10 knots
    wind = max(0.0, float(wind_speed_kt)) if wind_speed_kt is not None else 0.0
    wind_penalty = max(0.0, wind - 10.0)
    
    # Calculate score (higher is better)
    score = (cat_weight * 100.0) - (precip * 15.0) - (wind_penalty * 2.0)
    
    return score


def best_departure_windows(
    hourly: Iterable[Dict[str, Any]],
    *,
    window_hours: int = 3,
    max_windows: int = 3,
) -> List[Dict[str, Any]]:
    """
    Find the best departure windows from hourly forecast data.
    
    Args:
        hourly: Iterable of hourly forecast dicts with keys:
            - time: ISO timestamp
            - visibility_m: Visibility in meters
            - cloudcover_pct: Cloud cover percentage
            - precipitation_mm: Precipitation in millimeters
            - wind_speed_kt: Wind speed in knots
        window_hours: Hours per window (default: 3)
        max_windows: Maximum number of windows to return (default: 3)
        
    Returns:
        List of best departure windows, each containing:
            - start_time: Window start time
            - end_time: Window end time
            - score: Numeric score (higher is better)
            - flight_category: Predominant flight category
            
    Example:
        >>> hourly_data = [
        ...     {"time": "2024-01-15T06:00:00Z", "visibility_m": 16000, 
        ...      "cloudcover_pct": 20, "precipitation_mm": 0, "wind_speed_kt": 5},
        ...     # ... more hourly data
        ... ]
        >>> windows = best_departure_windows(hourly_data, window_hours=3)
        >>> print(windows[0])  # Best 3-hour window
        {
            'start_time': '2024-01-15T06:00:00Z',
            'end_time': '2024-01-15T08:00:00Z',
            'score': 395.0,
            'flight_category': 'VFR'
        }
    """
    rows = list(hourly)
    
    if window_hours < 1 or len(rows) < window_hours:
        return []

    scored: List[Tuple[float, Dict[str, Any]]] = []
    
    # Slide window through hourly data
    for i in range(0, len(rows) - window_hours + 1):
        window = rows[i : i + window_hours]
        if not window:
            continue

        # Calculate mean values for the window
        def _mean(key: str) -> Optional[float]:
            vals = [w.get(key) for w in window if isinstance(w.get(key), (int, float))]
            if not vals:
                return None
            return float(sum(vals)) / len(vals)

        # Convert visibility from meters to statute miles
        vis_sm = meters_to_sm(_mean("visibility_m"))
        
        # Estimate ceiling from cloud cover
        ceiling_ft = estimate_ceiling_from_cloudcover(_mean("cloudcover_pct"))
        
        # Get precipitation and wind
        precip_mm = _mean("precipitation_mm")
        wind_kt = _mean("wind_speed_kt")

        # Determine flight category and score
        cat = flight_category(visibility_sm=vis_sm, ceiling_ft=ceiling_ft)
        score = score_hour(category=cat, precipitation_mm=precip_mm, wind_speed_kt=wind_kt)

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

    # Sort by score (descending) and return top windows
    scored.sort(key=lambda t: t[0], reverse=True)
    return [row for _, row in scored[:max_windows]]
