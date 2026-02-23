from __future__ import annotations

import math
from dataclasses import dataclass
from enum import Enum


class CDIMode(Enum):
    GPS = "GPS"
    VOR = "VOR"
    LOC = "LOC"


@dataclass
class HSIState:
    bearing_pointer_nav1: float
    bearing_pointer_nav2: float
    cdi_mode: CDIMode
    cdi_deviation: float
    obs_setting: float
    glideslope_deviation: float
    to_from_flag: str  # "TO", "FROM", or "OFF"


def calculate_bearing_pointer(navaid_position: tuple[float, float], aircraft_position: tuple[float, float], aircraft_heading: float) -> float:
    """Calculate bearing pointer angle relative to aircraft heading."""
    dx = navaid_position[0] - aircraft_position[0]
    dy = navaid_position[1] - aircraft_position[1]
    absolute_bearing = math.degrees(math.atan2(dy, dx)) % 360
    relative_bearing = (absolute_bearing - aircraft_heading + 360) % 360
    return relative_bearing


def calculate_cdi_deviation(course: float, radial: float, mode: CDIMode) -> float:
    """Calculate CDI deviation based on mode."""
    deviation = (course - radial + 180) % 360 - 180
    if mode == CDIMode.LOC:
        # Localizer is more sensitive (2.5 degrees full scale)
        return max(-2.5, min(2.5, deviation))
    elif mode == CDIMode.VOR:
        # VOR is 10 degrees full scale
        return max(-10, min(10, deviation))
    else:  # GPS
        # GPS is typically 2 nm full scale en route, 0.3 nm terminal
        return deviation


def calculate_to_from_flag(course: float, radial: float) -> str:
    """Determine TO/FROM flag based on course and radial."""
    diff = (course - radial + 180) % 360 - 180
    if abs(diff) <= 90:
        return "TO"
    else:
        return "FROM"


class HSIIntegrationService:
    def __init__(self, hsi_state: HSIState):
        self.hsi_state = hsi_state

    def update_state(
        self,
        nav1_position: tuple[float, float],
        nav2_position: tuple[float, float],
        aircraft_position: tuple[float, float],
        aircraft_heading: float,
        obs_setting: float,
        radial: float,
        cdi_mode: CDIMode,
        glideslope_angle: float = 0.0,
        aircraft_glideslope_angle: float = 0.0
    ) -> None:
        self.hsi_state.bearing_pointer_nav1 = calculate_bearing_pointer(nav1_position, aircraft_position, aircraft_heading)
        self.hsi_state.bearing_pointer_nav2 = calculate_bearing_pointer(nav2_position, aircraft_position, aircraft_heading)
        self.hsi_state.cdi_mode = cdi_mode
        self.hsi_state.cdi_deviation = calculate_cdi_deviation(obs_setting, radial, cdi_mode)
        self.hsi_state.obs_setting = obs_setting
        self.hsi_state.to_from_flag = calculate_to_from_flag(obs_setting, radial)
        self.hsi_state.glideslope_deviation = glideslope_angle - aircraft_glideslope_angle

    def get_state(self) -> HSIState:
        return self.hsi_state
