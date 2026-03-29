"""
NAV Radio Simulation Services — G1000 backend.

Replaces the placeholder stubs with correct geometric calculations.
These are thin wrappers used by the G1000 router layer; the richer
COM/transponder/audio-panel simulation lives in the flight-planner's
nav_radio_simulation module and is intentionally not duplicated here.
"""

from __future__ import annotations

import math


def calculate_vor_radial(course: float, radial: float) -> float:
    """
    Return VOR course deviation in degrees (±180).
    Positive = needle deflects right (fly right to re-centre).

    Args:
        course:  OBS-selected course (degrees magnetic)
        radial:  Actual VOR radial the aircraft is on (degrees magnetic)
    """
    dev = (course - radial + 360) % 360
    if dev > 180:
        dev -= 360
    return dev


def calculate_ils_localizer(localizer_course: float, aircraft_track: float) -> float:
    """
    Return ILS localizer deviation in degrees (±).
    Positive = aircraft is right of centreline (fly left).

    Args:
        localizer_course:  Published localizer front-course bearing (degrees)
        aircraft_track:    Aircraft magnetic track (degrees)
    """
    dev = (aircraft_track - localizer_course + 360) % 360
    if dev > 180:
        dev -= 360
    return dev


def calculate_adf_bearing(
    navaid_lat: float,
    navaid_lon: float,
    aircraft_lat: float,
    aircraft_lon: float,
) -> float:
    """
    Return true bearing from aircraft to ADF station (degrees 0–360).
    Uses equirectangular approximation — adequate for short ranges (<200 NM).

    Args:
        navaid_lat/lon:   Station position (decimal degrees)
        aircraft_lat/lon: Aircraft position (decimal degrees)
    """
    dx = math.radians(navaid_lon - aircraft_lon) * math.cos(math.radians(aircraft_lat))
    dy = math.radians(navaid_lat - aircraft_lat)
    return math.degrees(math.atan2(dx, dy)) % 360


def calculate_dme_range(
    navaid_lat: float,
    navaid_lon: float,
    aircraft_lat: float,
    aircraft_lon: float,
) -> float:
    """
    Return slant-range distance in nautical miles (haversine formula).

    Args:
        navaid_lat/lon:   Station position (decimal degrees)
        aircraft_lat/lon: Aircraft position (decimal degrees)
    """
    R_NM = 3440.065  # Earth radius in nautical miles
    lat1 = math.radians(aircraft_lat)
    lat2 = math.radians(navaid_lat)
    dlat = lat2 - lat1
    dlon = math.radians(navaid_lon - aircraft_lon)
    a = (
        math.sin(dlat / 2.0) ** 2
        + math.cos(lat1) * math.cos(lat2) * math.sin(dlon / 2.0) ** 2
    )
    return R_NM * 2.0 * math.atan2(math.sqrt(a), math.sqrt(1.0 - a))
