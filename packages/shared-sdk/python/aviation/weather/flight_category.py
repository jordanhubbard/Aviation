"""
Flight category calculations based on FAA criteria

Calculates VFR/MVFR/IFR/LIFR based on visibility and ceiling.

FAA Criteria:
- VFR: Visibility >= 5 SM, Ceiling >= 3000 ft
- MVFR: Visibility 3-5 SM, or Ceiling 1000-3000 ft
- IFR: Visibility 1-3 SM, or Ceiling 500-1000 ft
- LIFR: Visibility < 1 SM, or Ceiling < 500 ft
"""

from typing import List, Literal, Optional

FlightCategory = Literal['VFR', 'MVFR', 'IFR', 'LIFR']

# Standard FAA thresholds
STANDARD_THRESHOLDS = {
    'vfr_visibility': 5.0,
    'vfr_ceiling': 3000,
    'mvfr_visibility': 3.0,
    'mvfr_ceiling': 1000,
    'ifr_visibility': 1.0,
    'ifr_ceiling': 500
}


def calculate_flight_category(
    visibility: float,
    ceiling: Optional[float],
    thresholds: Optional[dict] = None
) -> FlightCategory:
    """
    Calculate flight category based on visibility and ceiling
    
    Args:
        visibility: Visibility in statute miles
        ceiling: Ceiling in feet AGL (None if unlimited)
        thresholds: Custom thresholds (optional)
    
    Returns:
        Flight category (VFR, MVFR, IFR, or LIFR)
    
    Examples:
        >>> calculate_flight_category(10, 5000)
        'VFR'
        >>> calculate_flight_category(4, 2000)
        'MVFR'
        >>> calculate_flight_category(2, 800)
        'IFR'
        >>> calculate_flight_category(0.5, 300)
        'LIFR'
    """
    if thresholds is None:
        thresholds = STANDARD_THRESHOLDS
    
    # Treat None ceiling as unlimited (very high)
    effective_ceiling = ceiling if ceiling is not None else 999999
    
    # LIFR: Visibility < 1 SM OR Ceiling < 500 ft
    if visibility < thresholds['ifr_visibility'] or effective_ceiling < thresholds['ifr_ceiling']:
        return 'LIFR'
    
    # IFR: Visibility 1-3 SM OR Ceiling 500-1000 ft
    if visibility < thresholds['mvfr_visibility'] or effective_ceiling < thresholds['mvfr_ceiling']:
        return 'IFR'
    
    # MVFR: Visibility 3-5 SM OR Ceiling 1000-3000 ft
    if visibility < thresholds['vfr_visibility'] or effective_ceiling < thresholds['vfr_ceiling']:
        return 'MVFR'
    
    # VFR: Visibility >= 5 SM AND Ceiling >= 3000 ft
    return 'VFR'


def get_flight_category_recommendation(category: FlightCategory) -> str:
    """Get flight category recommendation text"""
    recommendations = {
        'VFR': 'Visual flight rules - Good flying conditions',
        'MVFR': 'Marginal VFR - Caution advised, monitor conditions closely',
        'IFR': 'Instrument flight rules required - Poor visibility or low ceiling',
        'LIFR': 'Low IFR - Very poor conditions, flight not recommended for VFR'
    }
    return recommendations[category]


def get_flight_category_color(category: FlightCategory) -> str:
    """Get flight category color code (hex)"""
    colors = {
        'VFR': '#00A000',   # Green
        'MVFR': '#0080FF',  # Blue
        'IFR': '#FF0000',   # Red
        'LIFR': '#C000C0'   # Magenta
    }
    return colors[category]


def is_vfr_recommended(category: FlightCategory) -> bool:
    """Determine if VFR flight is recommended"""
    return category in ('VFR', 'MVFR')


def get_weather_warnings(
    visibility: float,
    ceiling: Optional[float],
    wind_speed: float,
    wind_gust: Optional[float] = None
) -> List[str]:
    """
    Get weather warnings based on conditions
    
    Args:
        visibility: Visibility in statute miles
        ceiling: Ceiling in feet AGL (None if unlimited)
        wind_speed: Wind speed in knots
        wind_gust: Wind gust speed in knots (optional)
    
    Returns:
        List of warning messages
    """
    warnings = []
    
    # Flight category warnings
    category = calculate_flight_category(visibility, ceiling)
    if category in ('IFR', 'LIFR'):
        warnings.append(f'{category} conditions')
    
    # Visibility warnings
    if visibility < 1:
        warnings.append('Very low visibility (< 1 SM)')
    elif visibility < 3:
        warnings.append('Low visibility (< 3 SM)')
    
    # Ceiling warnings
    if ceiling is not None:
        if ceiling < 500:
            warnings.append('Very low ceiling (< 500 ft)')
        elif ceiling < 1000:
            warnings.append('Low ceiling (< 1000 ft)')
    
    # Wind warnings
    if wind_speed >= 25:
        warnings.append(f'Strong winds ({int(wind_speed)} kts)')
    elif wind_speed >= 15:
        warnings.append(f'Moderate winds ({int(wind_speed)} kts)')
    
    if wind_gust is not None and wind_gust >= 25:
        warnings.append(f'Gusts present ({int(wind_gust)} kts)')
    
    return warnings
