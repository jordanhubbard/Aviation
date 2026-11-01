from __future__ import annotations

from dataclasses import dataclass
import time
from typing import Callable, Sequence

from aviation_avionics import (
    great_circle_distance_nm,
    initial_bearing_deg,
    normalize_signed_angle,
    RadioState,
    AudioInputState,
    AudioPanelState,
    TransponderState,
    MarkerBeaconSite,
    compute_marker_beacons,
    resolve_marker_lights,
)


def calculate_vor_radial(course: float, radial: float) -> float:
    """Calculate VOR radial deviation."""
    return normalize_signed_angle(course - radial)


def calculate_ils_deviation(
    localizer: float, glideslope: float, aircraft_position: tuple[float, float]
) -> tuple[float, float]:
    """Preserve legacy scalar offsets; this is not a positional ILS beam model."""
    localizer_deviation = localizer - aircraft_position[0]
    glideslope_deviation = glideslope - aircraft_position[1]
    return localizer_deviation, glideslope_deviation


def calculate_adf_bearing(
    navaid_position: tuple[float, float], aircraft_position: tuple[float, float]
) -> float:
    """Calculate the true ADF bearing to a WGS-84 station."""
    return initial_bearing_deg(*aircraft_position, *navaid_position)


def calculate_dme_range(
    navaid_position: tuple[float, float], aircraft_position: tuple[float, float]
) -> float:
    """Calculate great-circle DME ground range in nautical miles."""
    return great_circle_distance_nm(*aircraft_position, *navaid_position)


@dataclass
class NavRadioState:
    vor_radial: float = 0.0
    ils_localizer: float = 0.0
    ils_glideslope: float = 0.0
    adf_bearing: float = 0.0
    dme_range: float = 0.0


class NavRadioSimulationService:
    """Compose common SDK controls; the host owns its clock and hardware I/O."""

    def __init__(
        self,
        nav_radio_state: NavRadioState | None = None,
        *,
        clock: Callable[[], float] = time.monotonic,
        on_transmit: Callable[[int, bool, RadioState], None] | None = None,
    ):
        self.nav_radio_state = nav_radio_state if nav_radio_state is not None else NavRadioState()
        self.com1 = RadioState("COM", 121.5, 121.5)
        self.com2 = RadioState("COM", 121.5, 121.5)
        self.nav1 = RadioState("NAV", 108.0, 108.0, volume=0.5)
        self.nav2 = RadioState("NAV", 108.0, 108.0, volume=0.5)
        self.transponder = TransponderState("STBY", "1200", False, 0.0)
        self.audio_panel = AudioPanelState(
            com1_enabled=True,
            com2_enabled=False,
            nav1_enabled=False,
            nav2_enabled=False,
            adf_enabled=False,
            marker_enabled=True,
            speaker_enabled=False,
            headphone_enabled=True,
            com1_volume=0.8,
            com2_volume=0.8,
            nav1_volume=0.3,
            nav2_volume=0.3,
            adf_volume=0.3,
            marker_volume=0.8,
        )
        self.intercom = AudioInputState(True, 0.7)
        self.music = AudioInputState(False, 0.3)
        self._adf_input = AudioInputState(True, 0.5)
        self.marker_status = resolve_marker_lights(False, False, False)
        self._clock = clock
        self._on_transmit = on_transmit
        self._last_tick = clock()

    def tick(self) -> None:
        now = self._clock()
        self.transponder.update(now - self._last_tick)
        self._last_tick = now

    @staticmethod
    def _radio_name(kind: str, radio: int) -> str:
        if type(radio) is not int or radio not in (1, 2):
            raise ValueError("radio must be 1 or 2")
        return f"{kind}{radio}"

    def _radio_change(self, kind: str, radio: int, **changes: object) -> None:
        name = self._radio_name(kind, radio)
        setattr(self, name, getattr(self, name).transition(**changes))

    def tune_com(self, radio: int, freq: float, standby: bool = True) -> None:
        if type(standby) is not bool:
            raise ValueError("standby must be boolean")
        self._radio_change(
            "com", radio, **{"standby_frequency_mhz" if standby else "active_frequency_mhz": freq}
        )

    def tune_nav(self, radio: int, freq: float, standby: bool = True) -> None:
        if type(standby) is not bool:
            raise ValueError("standby must be boolean")
        self._radio_change(
            "nav", radio, **{"standby_frequency_mhz" if standby else "active_frequency_mhz": freq}
        )

    def flip_com(self, radio: int) -> None:
        self._radio_change("com", radio, swap=True)

    def flip_nav(self, radio: int) -> None:
        self._radio_change("nav", radio, swap=True)

    def set_com_volume(self, radio: int, volume: float) -> None:
        self._radio_change("com", radio, volume=volume)

    def set_nav_volume(self, radio: int, volume: float) -> None:
        self._radio_change("nav", radio, volume=volume)

    def ptt(self, radio: int, pressed: bool) -> None:
        self._radio_change("com", radio, transmit=pressed)
        if self._on_transmit is not None:
            self._on_transmit(radio, pressed, getattr(self, self._radio_name("com", radio)))

    @property
    def adf_volume(self) -> float:
        return self._adf_input.volume

    def set_adf_volume(self, volume: float) -> None:
        self._adf_input = self._adf_input.transition(volume=volume)

    def set_squawk(self, code: str) -> None:
        self.transponder.transition(squawk_code=code)

    def transponder_ident(self) -> None:
        self.tick()
        self.transponder.trigger_ident()

    def set_transponder_mode(self, mode: str) -> None:
        aliases = {"off": "OFF", "standby": "STBY", "on": "A", "alt": "C", "mode_s": "S"}
        self.transponder.transition(mode=aliases.get(mode, mode))

    def _audio_change(self, source: str, **changes: object) -> None:
        if source in ("intercom", "music"):
            setattr(self, source, getattr(self, source).transition(**changes))
        elif source in ("com1", "com2", "nav1", "nav2", "adf", "marker"):
            current = AudioInputState(
                getattr(self.audio_panel, f"{source}_enabled"),
                getattr(self.audio_panel, f"{source}_volume"),
            )
            next_state = current.transition(**changes)
            setattr(self.audio_panel, f"{source}_enabled", next_state.enabled)
            setattr(self.audio_panel, f"{source}_volume", next_state.volume)
        else:
            raise ValueError("unknown audio source")

    def set_audio_volume(self, source: str, volume: float) -> None:
        self._audio_change(source, volume=volume)

    def toggle_audio_monitor(self, source: str, enabled: bool) -> None:
        self._audio_change(source, enabled=enabled)

    def set_audio_output(self, output: str, enabled: bool) -> None:
        if output not in ("speaker", "headphone"):
            raise ValueError("unknown audio output")
        validated = AudioInputState(enabled, 1.0)
        setattr(self.audio_panel, f"{output}_enabled", validated.enabled)

    def update_marker_lights(self, outer: bool, middle: bool, inner: bool) -> None:
        self.marker_status = resolve_marker_lights(outer, middle, inner)

    def update_marker_geometry(
        self,
        aircraft_position: tuple[float, float],
        altitude_ft: float,
        sites: Sequence[MarkerBeaconSite],
    ) -> None:
        self.marker_status = compute_marker_beacons(*aircraft_position, altitude_ft, sites)

    def update_state(
        self,
        course: float,
        radial: float,
        localizer: float,
        glideslope: float,
        navaid_position: tuple[float, float],
        aircraft_position: tuple[float, float],
    ) -> None:
        vor = calculate_vor_radial(course, radial)
        loc, gs = calculate_ils_deviation(localizer, glideslope, aircraft_position)
        adf = calculate_adf_bearing(navaid_position, aircraft_position)
        dme = calculate_dme_range(navaid_position, aircraft_position)
        self.tick()
        self.nav_radio_state.vor_radial = vor
        self.nav_radio_state.ils_localizer = loc
        self.nav_radio_state.ils_glideslope = gs
        self.nav_radio_state.adf_bearing = adf
        self.nav_radio_state.dme_range = dme

    def get_state(self) -> NavRadioState:
        return self.nav_radio_state

    def full_status(self) -> dict:
        self.tick()
        return {
            **{name: getattr(self, name).to_dict() for name in ("com1", "com2", "nav1", "nav2")},
            "transponder": self.transponder.to_dict(),
            "audio_panel": {
                **self.audio_panel.to_dict(),
                "intercom_enabled": self.intercom.enabled,
                "intercom_volume": self.intercom.volume,
                "music_enabled": self.music.enabled,
                "music_volume": self.music.volume,
            },
            "marker_receiver": self.marker_status.to_dict(),
            "adf_volume": self.adf_volume,
            "nav_state": vars(self.nav_radio_state).copy(),
        }
