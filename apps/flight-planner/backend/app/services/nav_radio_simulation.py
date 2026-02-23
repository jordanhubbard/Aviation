from __future__ import annotations

import math
from dataclasses import dataclass


def calculate_vor_radial(course: float, radial: float) -> float:
    """Calculate VOR radial deviation."""
    return (course - radial + 360) % 360


def calculate_ils_deviation(localizer: float, glideslope: float, aircraft_position: tuple[float, float]) -> tuple[float, float]:
    """Calculate ILS localizer and glideslope deviation."""
    localizer_deviation = localizer - aircraft_position[0]
    glideslope_deviation = glideslope - aircraft_position[1]
    return localizer_deviation, glideslope_deviation


def calculate_adf_bearing(navaid_position: tuple[float, float], aircraft_position: tuple[float, float]) -> float:
    """Calculate ADF bearing to the station."""
    dx = navaid_position[0] - aircraft_position[0]
    dy = navaid_position[1] - aircraft_position[1]
    return math.degrees(math.atan2(dy, dx)) % 360


def calculate_dme_range(navaid_position: tuple[float, float], aircraft_position: tuple[float, float]) -> float:
    """Calculate DME range to the station."""
    dx = navaid_position[0] - aircraft_position[0]
    dy = navaid_position[1] - aircraft_position[1]
    return math.sqrt(dx ** 2 + dy ** 2)


@dataclass
class NavRadioState:
    vor_radial: float
    ils_localizer: float
    ils_glideslope: float
    adf_bearing: float
    dme_range: float


class NavRadioSimulationService:
    # TODO: Implement COM1/COM2 transceivers with frequency selection
    # TODO: Implement Audio panel simulation (speaker, headphone, intercom)
    # TODO: Implement Optional simulated ATC communication
    # TODO: Implement Transponder Mode A/C and Mode S
    # TODO: Implement Squawk code entry
    # TODO: Implement Ident function
    # TODO: Implement Audio Panel Marker beacon lights (outer/middle/inner)
    # TODO: Implement Volume controls for COM/NAV/ADF
    # TODO: Implement Intercom and music input simulation
    def __init__(self, nav_radio_state: NavRadioState):
        self.nav_radio_state = nav_radio_state

    def update_state(self, course: float, radial: float, localizer: float, glideslope: float,
                      navaid_position: tuple[float, float], aircraft_position: tuple[float, float]) -> None:
        self.nav_radio_state.vor_radial = calculate_vor_radial(course, radial)
        self.nav_radio_state.ils_localizer, self.nav_radio_state.ils_glideslope = calculate_ils_deviation(localizer, glideslope, aircraft_position)
        self.nav_radio_state.adf_bearing = calculate_adf_bearing(navaid_position, aircraft_position)
        self.nav_radio_state.dme_range = calculate_dme_range(navaid_position, aircraft_position)

    def get_state(self) -> NavRadioState:
        return self.nav_radio_state
