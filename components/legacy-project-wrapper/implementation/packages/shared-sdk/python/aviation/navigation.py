"""
Navigation Utilities for Aviation (Python)

Provides comprehensive navigation calculations for flight planning.
All calculations use standard aviation units: nautical miles, knots, degrees.

Ported from TypeScript implementation in packages/shared-sdk/src/aviation/navigation/
"""

import math
from datetime import datetime, timedelta
from typing import Tuple, Dict, Literal, Optional

# Constants
EARTH_RADIUS_NM = 3440.065
EARTH_RADIUS_KM = 6371.0
EARTH_RADIUS_MI = 3958.8
EARTH_RADIUS_METERS = 6371000.0

FUEL_DENSITY = {
    "AVGAS_100LL": 6.0,
    "JET_A": 6.7,
    "JET_A1": 6.7,
    "MOGAS": 6.0,
}

ISA_SEA_LEVEL_PRESSURE_INHG = 29.92
ISA_SEA_LEVEL_TEMP_C = 15.0
ISA_LAPSE_RATE_C_PER_FT = 0.0019812
KELVIN_OFFSET = 273.15
SPEED_OF_SOUND_FACTOR_KTS = 38.967854


def _validate_coordinate(lat: float, lon: float) -> None:
    if (
        not math.isfinite(lat)
        or not math.isfinite(lon)
        or not -90 <= lat <= 90
        or not -180 <= lon <= 180
    ):
        raise ValueError(f"Invalid WGS-84 coordinate: {lat}, {lon}")


# ============================================================================
# Distance Calculations
# ============================================================================


def to_radians(degrees: float) -> float:
    """Convert degrees to radians."""
    return math.radians(degrees)


def to_degrees(radians: float) -> float:
    """Convert radians to degrees."""
    return math.degrees(radians)


def haversine_distance(
    lat1: float,
    lon1: float,
    lat2: float,
    lon2: float,
    unit: Literal["NM", "KM", "MI", "METERS"] = "NM",
) -> float:
    """
    Calculate haversine distance between two points.

    Args:
        lat1: Starting latitude in degrees
        lon1: Starting longitude in degrees
        lat2: Ending latitude in degrees
        lon2: Ending longitude in degrees
        unit: Unit for result (default: 'NM')

    Returns:
        Distance in specified unit
    """
    _validate_coordinate(lat1, lon1)
    _validate_coordinate(lat2, lon2)
    radius_map = {
        "NM": EARTH_RADIUS_NM,
        "KM": EARTH_RADIUS_KM,
        "MI": EARTH_RADIUS_MI,
        "METERS": EARTH_RADIUS_METERS,
    }
    R = radius_map[unit]

    phi1 = to_radians(lat1)
    phi2 = to_radians(lat2)
    delta_phi = to_radians(lat2 - lat1)
    delta_lambda = to_radians(lon2 - lon1)

    a = (
        math.sin(delta_phi / 2) ** 2
        + math.cos(phi1) * math.cos(phi2) * math.sin(delta_lambda / 2) ** 2
    )

    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))

    return R * c


def distance_nm(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Calculate distance in nautical miles (convenience function)."""
    return haversine_distance(lat1, lon1, lat2, lon2, "NM")


def distance_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Calculate distance in kilometers (convenience function)."""
    return haversine_distance(lat1, lon1, lat2, lon2, "KM")


def distance_mi(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Calculate distance in statute miles (convenience function)."""
    return haversine_distance(lat1, lon1, lat2, lon2, "MI")


def midpoint(lat1: float, lon1: float, lat2: float, lon2: float) -> Tuple[float, float]:
    """
    Calculate midpoint between two coordinates.

    Returns:
        Tuple of (latitude, longitude)
    """
    _validate_coordinate(lat1, lon1)
    _validate_coordinate(lat2, lon2)
    phi1 = to_radians(lat1)
    lambda1 = to_radians(lon1)
    phi2 = to_radians(lat2)
    delta_lambda = to_radians(lon2 - lon1)

    Bx = math.cos(phi2) * math.cos(delta_lambda)
    By = math.cos(phi2) * math.sin(delta_lambda)

    phi3 = math.atan2(
        math.sin(phi1) + math.sin(phi2), math.sqrt((math.cos(phi1) + Bx) ** 2 + By**2)
    )

    lambda3 = lambda1 + math.atan2(By, math.cos(phi1) + Bx)

    return (to_degrees(phi3), to_degrees(lambda3))


def destination(
    lat: float,
    lon: float,
    distance: float,
    bearing: float,
    unit: Literal["NM", "KM", "MI", "METERS"] = "NM",
) -> Tuple[float, float]:
    """
    Calculate destination point given starting point, distance, and bearing.

    Args:
        lat: Starting latitude in degrees
        lon: Starting longitude in degrees
        distance: Distance to travel
        bearing: Bearing in degrees (0-360)
        unit: Unit of distance

    Returns:
        Tuple of (latitude, longitude)
    """
    _validate_coordinate(lat, lon)
    if not math.isfinite(distance) or distance < 0 or not math.isfinite(bearing):
        raise ValueError("Distance must be non-negative and bearing must be finite")
    radius_map = {
        "NM": EARTH_RADIUS_NM,
        "KM": EARTH_RADIUS_KM,
        "MI": EARTH_RADIUS_MI,
        "METERS": EARTH_RADIUS_METERS,
    }
    R = radius_map[unit]

    delta = distance / R
    theta = to_radians(bearing)

    phi1 = to_radians(lat)
    lambda1 = to_radians(lon)

    phi2 = math.asin(
        math.sin(phi1) * math.cos(delta)
        + math.cos(phi1) * math.sin(delta) * math.cos(theta)
    )

    lambda2 = lambda1 + math.atan2(
        math.sin(theta) * math.sin(delta) * math.cos(phi1),
        math.cos(delta) - math.sin(phi1) * math.sin(phi2),
    )

    return (to_degrees(phi2), to_degrees(lambda2))


# ============================================================================
# Bearing Calculations
# ============================================================================


def initial_bearing(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """
    Calculate initial bearing (forward azimuth) from point 1 to point 2.

    Returns:
        Initial bearing in degrees (0-360)
    """
    _validate_coordinate(lat1, lon1)
    _validate_coordinate(lat2, lon2)
    phi1 = to_radians(lat1)
    phi2 = to_radians(lat2)
    delta_lambda = to_radians(lon2 - lon1)

    y = math.sin(delta_lambda) * math.cos(phi2)
    x = math.cos(phi1) * math.sin(phi2) - math.sin(phi1) * math.cos(phi2) * math.cos(
        delta_lambda
    )

    theta = math.atan2(y, x)

    return (to_degrees(theta) + 360) % 360


def final_bearing(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Calculate final bearing (back azimuth) at destination."""
    return (initial_bearing(lat2, lon2, lat1, lon1) + 180) % 360


def normalize_bearing(bearing: float) -> float:
    """Normalize bearing to 0-360 range."""
    normalized = bearing % 360
    return normalized if normalized >= 0 else normalized + 360


def true_to_magnetic(true_heading: float, magnetic_variation: float) -> float:
    """Convert true heading to magnetic heading."""
    return normalize_bearing(true_heading - magnetic_variation)


def magnetic_to_true(magnetic_heading: float, magnetic_variation: float) -> float:
    """Convert magnetic heading to true heading."""
    return normalize_bearing(magnetic_heading + magnetic_variation)


def wind_components(
    wind_direction: float, wind_speed: float, course: float
) -> Tuple[float, float]:
    """Return positive-headwind and positive-from-right crosswind components."""
    if (
        not math.isfinite(wind_direction)
        or not math.isfinite(wind_speed)
        or not math.isfinite(course)
        or wind_speed < 0
    ):
        raise ValueError(
            "Wind direction/course must be finite and wind speed non-negative"
        )
    relative = to_radians(wind_direction - course)
    return wind_speed * math.cos(relative), wind_speed * math.sin(relative)


def _wind_triangle(
    true_airspeed: float, true_course: float, wind_direction: float, wind_speed: float
) -> Tuple[float, float, float]:
    if (
        not math.isfinite(true_airspeed)
        or not math.isfinite(true_course)
        or not math.isfinite(wind_direction)
        or not math.isfinite(wind_speed)
        or true_airspeed <= 0
        or wind_speed < 0
    ):
        raise ValueError(
            "True airspeed must be positive; wind inputs must be finite and non-negative"
        )
    headwind, crosswind = wind_components(wind_direction, wind_speed, true_course)
    ratio = crosswind / true_airspeed
    if abs(ratio) > 1:
        raise ValueError("Crosswind exceeds true airspeed; course cannot be maintained")
    correction = math.asin(ratio)
    speed = true_airspeed * math.cos(correction) - headwind
    if speed <= 0:
        raise ValueError("Wind prevents positive progress along the selected course")
    return correction, speed, headwind


def wind_correction_angle(
    true_airspeed: float, true_course: float, wind_direction: float, wind_speed: float
) -> float:
    """
    Calculate wind correction angle (WCA).

    Returns:
        WCA in degrees (+ right, - left)
    """
    correction, _, _ = _wind_triangle(
        true_airspeed, true_course, wind_direction, wind_speed
    )
    return to_degrees(correction)


def true_heading(
    true_course: float, true_airspeed: float, wind_direction: float, wind_speed: float
) -> float:
    """Calculate true heading with wind correction."""
    wca = wind_correction_angle(true_airspeed, true_course, wind_direction, wind_speed)
    return normalize_bearing(true_course + wca)


def ground_speed(
    true_airspeed: float, true_course: float, wind_direction: float, wind_speed: float
) -> float:
    """Calculate ground speed considering wind."""
    _, speed, _ = _wind_triangle(true_airspeed, true_course, wind_direction, wind_speed)
    return speed


# ============================================================================
# Coordinate Utilities
# ============================================================================


def is_valid_latitude(lat: float) -> bool:
    """Validate latitude value."""
    return -90 <= lat <= 90


def is_valid_longitude(lon: float) -> bool:
    """Validate longitude value."""
    return -180 <= lon <= 180


def is_valid_coordinate(lat: float, lon: float) -> bool:
    """Validate coordinate pair."""
    return is_valid_latitude(lat) and is_valid_longitude(lon)


def normalize_latitude(lat: float) -> float:
    """Normalize latitude to -90 to 90 range."""
    return max(-90, min(90, lat))


def normalize_longitude(lon: float) -> float:
    """Normalize longitude to -180 to 180 range."""
    normalized = (lon + 180) % 360
    if normalized < 0:
        normalized += 360
    return normalized - 180


def dms_to_decimal(
    degrees: int, minutes: int, seconds: float, direction: Literal["N", "S", "E", "W"]
) -> float:
    """Convert DMS (Degrees Minutes Seconds) to decimal degrees."""
    decimal = degrees + minutes / 60 + seconds / 3600
    return -decimal if direction in ("S", "W") else decimal


def format_dms(decimal: float, is_latitude: bool) -> str:
    """Format coordinate as DMS string."""
    absolute = abs(decimal)
    degrees = int(absolute)
    minutes_decimal = (absolute - degrees) * 60
    minutes = int(minutes_decimal)
    seconds = (minutes_decimal - minutes) * 60

    direction = (
        ("N" if decimal >= 0 else "S")
        if is_latitude
        else ("E" if decimal >= 0 else "W")
    )

    return f"{degrees}°{minutes}'{seconds:.1f}\"{direction}"


# ============================================================================
# Fuel Calculations
# ============================================================================


def fuel_consumption(fuel_burn_gph: float, time_hours: float) -> float:
    """Calculate fuel consumption in gallons."""
    if (
        not math.isfinite(fuel_burn_gph)
        or fuel_burn_gph < 0
        or not math.isfinite(time_hours)
        or time_hours < 0
    ):
        raise ValueError("Fuel burn and time must be finite and non-negative")
    return fuel_burn_gph * time_hours


def flight_time(distance_nm: float, ground_speed_kts: float) -> float:
    """Calculate flight time in hours."""
    if (
        not math.isfinite(distance_nm)
        or distance_nm < 0
        or not math.isfinite(ground_speed_kts)
        or ground_speed_kts <= 0
    ):
        raise ValueError(
            "Distance must be non-negative and ground speed must be positive"
        )
    return distance_nm / ground_speed_kts


def fuel_required(
    distance_nm: float,
    ground_speed_kts: float,
    fuel_burn_gph: float,
    fuel_type: str = "AVGAS_100LL",
) -> Dict[str, float]:
    """
    Calculate fuel required for a flight.

    Returns:
        Dict with 'gallons', 'hours', and 'pounds'
    """
    hours = flight_time(distance_nm, ground_speed_kts)
    gallons = fuel_consumption(fuel_burn_gph, hours)
    pounds = gallons * FUEL_DENSITY.get(fuel_type, 6.0)

    return {"gallons": gallons, "hours": hours, "pounds": pounds}


def fuel_range(
    fuel_gallons: float,
    fuel_burn_gph: float,
    ground_speed_kts: float,
    reserve_gallons: float = 0,
) -> float:
    """Calculate range with given fuel in nautical miles."""
    if (
        not math.isfinite(fuel_gallons)
        or fuel_gallons < 0
        or not math.isfinite(reserve_gallons)
        or reserve_gallons < 0
        or reserve_gallons > fuel_gallons
        or not math.isfinite(fuel_burn_gph)
        or fuel_burn_gph <= 0
        or not math.isfinite(ground_speed_kts)
        or ground_speed_kts <= 0
    ):
        raise ValueError(
            "Fuel and reserve must be non-negative, reserve must not exceed fuel, "
            "and burn and speed must be positive"
        )
    usable_fuel = fuel_gallons - reserve_gallons
    endurance = usable_fuel / fuel_burn_gph
    return endurance * ground_speed_kts


def fuel_reserve(fuel_burn_gph: float, reserve_minutes: float) -> float:
    """Calculate reserve fuel for an arbitrary duration in minutes."""
    if (
        not math.isfinite(fuel_burn_gph)
        or fuel_burn_gph < 0
        or not math.isfinite(reserve_minutes)
        or reserve_minutes < 0
    ):
        raise ValueError(
            "Fuel burn and reserve minutes must be finite and non-negative"
        )
    return fuel_consumption(fuel_burn_gph, reserve_minutes / 60)


def vfr_fuel_reserve(fuel_burn_gph: float, is_day_vfr: bool = True) -> float:
    """
    Calculate VFR fuel reserve (FAA regulation).
    30 minutes day VFR, 45 minutes night VFR.
    """
    reserve_minutes = 30 if is_day_vfr else 45
    return fuel_reserve(fuel_burn_gph, reserve_minutes)


def ifr_fuel_reserve(fuel_burn_gph: float) -> float:
    """Calculate IFR fuel reserve (45 minutes)."""
    return fuel_reserve(fuel_burn_gph, 45)


# ============================================================================
# Aircraft Performance Altitudes
# ============================================================================


def pressure_altitude(
    indicated_altitude_ft: float, altimeter_setting_inhg: float
) -> float:
    """Correct indicated altitude to the ISA standard pressure datum."""
    if (
        not math.isfinite(indicated_altitude_ft)
        or not math.isfinite(altimeter_setting_inhg)
        or altimeter_setting_inhg <= 0
    ):
        raise ValueError(
            "Altitude must be finite and altimeter setting must be positive"
        )
    return (
        indicated_altitude_ft
        + (ISA_SEA_LEVEL_PRESSURE_INHG - altimeter_setting_inhg) * 1000.0
    )


def isa_temperature(pressure_altitude_ft: float) -> float:
    """Return ISA standard temperature in Celsius at a pressure altitude in feet."""
    if not math.isfinite(pressure_altitude_ft):
        raise ValueError("Pressure altitude must be finite")
    return ISA_SEA_LEVEL_TEMP_C - ISA_LAPSE_RATE_C_PER_FT * pressure_altitude_ft


def density_altitude(pressure_altitude_ft: float, temperature_c: float) -> float:
    """Correct pressure altitude for non-standard temperature using the 120 ft/C rule."""
    if not math.isfinite(pressure_altitude_ft) or not math.isfinite(temperature_c):
        raise ValueError("Pressure altitude and temperature must be finite")
    return pressure_altitude_ft + 120.0 * (
        temperature_c - isa_temperature(pressure_altitude_ft)
    )


def density_altitude_from_indicated(
    indicated_altitude_ft: float,
    altimeter_setting_inhg: float,
    temperature_c: float,
) -> float:
    """Calculate density altitude directly from indicated altitude and altimeter setting."""
    return density_altitude(
        pressure_altitude(indicated_altitude_ft, altimeter_setting_inhg),
        temperature_c,
    )


# ============================================================================
# Time-Speed-Distance Calculations
# ============================================================================


def tsd_distance(speed_kts: float, time_hours: float) -> float:
    """Calculate distance from speed and time."""
    return speed_kts * time_hours


def tsd_speed(distance_nm: float, time_hours: float) -> float:
    """Calculate speed from distance and time."""
    return distance_nm / time_hours


def tsd_time(distance_nm: float, speed_kts: float) -> float:
    """Calculate time from distance and speed."""
    return distance_nm / speed_kts


def hours_to_hm(hours: float) -> Tuple[int, int]:
    """Convert decimal hours to hours and minutes."""
    h = int(hours)
    m = round((hours - h) * 60)
    return (h, m)


def format_time(hours: float) -> str:
    """Format time as HH:MM string."""
    h, m = hours_to_hm(hours)
    return f"{h}:{m:02d}"


def eta(
    current_time: datetime, distance_remaining_nm: float, ground_speed_kts: float
) -> datetime:
    """Calculate ETA (Estimated Time of Arrival)."""
    time_remaining_hours = tsd_time(distance_remaining_nm, ground_speed_kts)
    time_remaining = timedelta(hours=time_remaining_hours)
    return current_time + time_remaining


def ias_to_tas(
    indicated_airspeed_kts: float, altitude_ft: float, temperature_c: float
) -> float:
    """
    Calculate true airspeed from indicated airspeed.
    Simplified calculation - use E6B for more accuracy.
    """
    if not math.isfinite(indicated_airspeed_kts) or indicated_airspeed_kts < 0:
        raise ValueError("Indicated airspeed must be finite and non-negative")
    if not math.isfinite(temperature_c) or temperature_c <= -KELVIN_OFFSET:
        raise ValueError(
            "Outside-air temperature must be finite and above absolute zero"
        )
    standard_temp_kelvin = isa_temperature(altitude_ft) + KELVIN_OFFSET
    if standard_temp_kelvin <= 0:
        raise ValueError("Pressure altitude is outside the ISA temperature domain")
    temp_ratio = (temperature_c + KELVIN_OFFSET) / standard_temp_kelvin
    altitude_correction = 1 + (altitude_ft / 1000) * 0.02
    if altitude_correction <= 0:
        raise ValueError(
            "Pressure altitude is outside the IAS/TAS approximation domain"
        )

    return indicated_airspeed_kts * altitude_correction * math.sqrt(temp_ratio)


def tas_to_mach(true_airspeed_kts: float, altitude_ft: float) -> float:
    """Calculate Mach number from true airspeed on an ISA standard day."""
    if not math.isfinite(true_airspeed_kts) or true_airspeed_kts < 0:
        raise ValueError("True airspeed must be finite and non-negative")
    standard_temp_kelvin = isa_temperature(altitude_ft) + KELVIN_OFFSET
    if standard_temp_kelvin <= 0:
        raise ValueError("Pressure altitude is outside the ISA temperature domain")
    speed_of_sound_kts = SPEED_OF_SOUND_FACTOR_KTS * math.sqrt(
        standard_temp_kelvin
    )
    return true_airspeed_kts / speed_of_sound_kts


def mach_to_tas(mach_number: float, altitude_ft: float) -> float:
    """Calculate true airspeed from Mach number on an ISA standard day."""
    if not math.isfinite(mach_number) or mach_number < 0:
        raise ValueError("Mach number must be finite and non-negative")
    standard_temp_kelvin = isa_temperature(altitude_ft) + KELVIN_OFFSET
    if standard_temp_kelvin <= 0:
        raise ValueError("Pressure altitude is outside the ISA temperature domain")
    speed_of_sound_kts = SPEED_OF_SOUND_FACTOR_KTS * math.sqrt(
        standard_temp_kelvin
    )
    return mach_number * speed_of_sound_kts


# ============================================================================
# Unit Conversions
# ============================================================================


class Convert:
    """Unit conversion utilities."""

    @staticmethod
    def nm_to_km(nm: float) -> float:
        return nm * 1.852

    @staticmethod
    def nm_to_mi(nm: float) -> float:
        return nm * 1.15078

    @staticmethod
    def nm_to_meters(nm: float) -> float:
        return nm * 1852

    @staticmethod
    def km_to_nm(km: float) -> float:
        return km / 1.852

    @staticmethod
    def mi_to_nm(mi: float) -> float:
        return mi / 1.15078

    @staticmethod
    def knots_to_mph(knots: float) -> float:
        return knots * 1.15078

    @staticmethod
    def knots_to_kph(knots: float) -> float:
        return knots * 1.852

    @staticmethod
    def mph_to_knots(mph: float) -> float:
        return mph / 1.15078

    @staticmethod
    def kph_to_knots(kph: float) -> float:
        return kph / 1.852


# Instantiate for easy access
convert = Convert()
