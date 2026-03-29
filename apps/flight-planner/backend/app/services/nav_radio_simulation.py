"""
nav_radio_simulation.py — COM/NAV/Transponder/Audio panel simulation.

Implements:
  - COM1/COM2 transceivers (118.000–136.975 MHz, 25 kHz spacing)
  - NAV1/NAV2 receivers (108.000–117.950 MHz)
  - Transponder (Mode A/C/S, squawk code, ident)
  - Audio panel (speaker/headphone routing, per-channel volumes)
  - Marker beacon lights (outer/middle/inner), volume-controlled
  - Volume controls for COM/NAV/ADF
  - Intercom and music input simulation
"""

from __future__ import annotations

import math
import time
from dataclasses import dataclass, field
from enum import Enum
from typing import Optional


# ---------------------------------------------------------------------------
# Geometry helpers (same as before — unchanged public API)
# ---------------------------------------------------------------------------

def calculate_vor_radial(course: float, radial: float) -> float:
    """Return deviation from the selected radial (degrees, ±180)."""
    dev = (course - radial + 360) % 360
    # Normalise to ±180 so positive = right of course
    if dev > 180:
        dev -= 360
    return dev


def calculate_ils_deviation(
    localizer: float,
    glideslope: float,
    aircraft_position: tuple[float, float],
) -> tuple[float, float]:
    """Return (localizer_deviation, glideslope_deviation) in degrees."""
    localizer_deviation = localizer - aircraft_position[0]
    glideslope_deviation = glideslope - aircraft_position[1]
    return localizer_deviation, glideslope_deviation


def calculate_adf_bearing(
    navaid_position: tuple[float, float],
    aircraft_position: tuple[float, float],
) -> float:
    """Return true bearing from aircraft to ADF station (degrees 0–360)."""
    dx = navaid_position[0] - aircraft_position[0]
    dy = navaid_position[1] - aircraft_position[1]
    return math.degrees(math.atan2(dy, dx)) % 360


def calculate_dme_range(
    navaid_position: tuple[float, float],
    aircraft_position: tuple[float, float],
) -> float:
    """Return slant-range distance in the same units as the input coordinates."""
    dx = navaid_position[0] - aircraft_position[0]
    dy = navaid_position[1] - aircraft_position[1]
    return math.sqrt(dx ** 2 + dy ** 2)


# ---------------------------------------------------------------------------
# COM transceiver
# ---------------------------------------------------------------------------

COM_FREQ_MIN = 118.000
COM_FREQ_MAX = 136.975
COM_CHANNEL_SPACING = 0.025  # 25 kHz


def _clamp_com_freq(freq: float) -> float:
    freq = max(COM_FREQ_MIN, min(COM_FREQ_MAX, freq))
    # Round to nearest 25 kHz channel
    channels = round((freq - COM_FREQ_MIN) / COM_CHANNEL_SPACING)
    return round(COM_FREQ_MIN + channels * COM_CHANNEL_SPACING, 3)


@dataclass
class ComTransceiver:
    """Simulates a single COM transceiver (COM1 or COM2)."""

    active_freq: float = 121.500    # Guard / emergency default
    standby_freq: float = 121.500
    transmit: bool = False          # PTT active
    receive: bool = True
    volume: float = 0.8             # 0.0–1.0

    def tune_standby(self, freq: float) -> None:
        """Set standby frequency, clamped to valid COM band."""
        self.standby_freq = _clamp_com_freq(freq)

    def flip_flop(self) -> None:
        """Swap active ↔ standby (FLIP/FLOP button)."""
        self.active_freq, self.standby_freq = self.standby_freq, self.active_freq

    def set_volume(self, volume: float) -> None:
        self.volume = max(0.0, min(1.0, volume))

    def to_dict(self) -> dict:
        return {
            "active_freq": self.active_freq,
            "standby_freq": self.standby_freq,
            "transmit": self.transmit,
            "receive": self.receive,
            "volume": self.volume,
        }


# ---------------------------------------------------------------------------
# NAV receiver
# ---------------------------------------------------------------------------

NAV_FREQ_MIN = 108.000
NAV_FREQ_MAX = 117.950
NAV_CHANNEL_SPACING = 0.050  # 50 kHz


def _clamp_nav_freq(freq: float) -> float:
    freq = max(NAV_FREQ_MIN, min(NAV_FREQ_MAX, freq))
    channels = round((freq - NAV_FREQ_MIN) / NAV_CHANNEL_SPACING)
    return round(NAV_FREQ_MIN + channels * NAV_CHANNEL_SPACING, 3)


@dataclass
class NavReceiver:
    """Simulates a single NAV receiver (NAV1 or NAV2)."""

    active_freq: float = 108.000
    standby_freq: float = 108.000
    volume: float = 0.5    # ident audio volume 0.0–1.0

    def tune_standby(self, freq: float) -> None:
        self.standby_freq = _clamp_nav_freq(freq)

    def flip_flop(self) -> None:
        self.active_freq, self.standby_freq = self.standby_freq, self.active_freq

    def set_volume(self, volume: float) -> None:
        self.volume = max(0.0, min(1.0, volume))

    def to_dict(self) -> dict:
        return {
            "active_freq": self.active_freq,
            "standby_freq": self.standby_freq,
            "volume": self.volume,
        }


# ---------------------------------------------------------------------------
# Transponder
# ---------------------------------------------------------------------------

class TransponderMode(str, Enum):
    OFF = "off"
    STANDBY = "standby"
    ALT = "alt"      # Mode C — altitude encoding
    ON = "on"        # Mode A — squawk only
    MODE_S = "mode_s"


@dataclass
class Transponder:
    """
    Simulates an aviation transponder.
    Supports Mode A (squawk), Mode C (altitude), and Mode S (extended squitter).
    """

    mode: TransponderMode = TransponderMode.STANDBY
    squawk: str = "1200"        # 4-octal-digit VFR default
    ident_active: bool = False  # True while IDENT is being transmitted
    _ident_until: float = 0.0   # epoch timestamp when ident expires

    # Mode S fields
    flight_id: str = ""         # 8-char ICAO flight ID
    altitude_ft: Optional[float] = None

    def set_squawk(self, code: str) -> None:
        """Set squawk code; must be 4 octal digits (0000–7777)."""
        if not (len(code) == 4 and all(c in "01234567" for c in code)):
            raise ValueError(f"Invalid squawk code: {code!r}. Must be 4 octal digits.")
        self.squawk = code

    def ident(self) -> None:
        """Press IDENT — transmits a special pulse for ~18 seconds."""
        self.ident_active = True
        self._ident_until = time.monotonic() + 18.0

    def tick(self) -> None:
        """Update time-based state (call once per simulation step)."""
        if self.ident_active and time.monotonic() >= self._ident_until:
            self.ident_active = False

    def is_replying(self) -> bool:
        """True if the transponder is actively replying to interrogations."""
        return self.mode not in (TransponderMode.OFF, TransponderMode.STANDBY)

    def to_dict(self) -> dict:
        return {
            "mode": self.mode.value,
            "squawk": self.squawk,
            "ident_active": self.ident_active,
            "flight_id": self.flight_id,
            "altitude_ft": self.altitude_ft,
            "replying": self.is_replying(),
        }


# ---------------------------------------------------------------------------
# Audio panel
# ---------------------------------------------------------------------------

@dataclass
class AudioPanel:
    """
    Simulates a GA-style audio panel.

    Routing:
      - speaker_enabled: audio plays through cabin speaker
      - headphone_enabled: audio plays through headset
    Per-source monitoring (receive) is toggled independently.
    Volume controls are per-source.
    """

    # Source enable toggles (monitoring)
    com1_monitor: bool = True
    com2_monitor: bool = False
    nav1_monitor: bool = False
    nav2_monitor: bool = False
    adf_monitor: bool = False
    marker_monitor: bool = True

    # Output routing
    speaker_enabled: bool = False
    headphone_enabled: bool = True

    # Volume knobs (0.0–1.0)
    com1_volume: float = 0.8
    com2_volume: float = 0.8
    nav1_volume: float = 0.3
    nav2_volume: float = 0.3
    adf_volume: float = 0.3
    marker_volume: float = 0.8

    # Intercom
    intercom_enabled: bool = True
    intercom_volume: float = 0.7

    # Music / entertainment input
    music_enabled: bool = False
    music_volume: float = 0.3

    def set_volume(self, source: str, volume: float) -> None:
        """Set volume for a named source. source: com1|com2|nav1|nav2|adf|marker|intercom|music."""
        attr = f"{source}_volume"
        if not hasattr(self, attr):
            raise ValueError(f"Unknown audio source: {source!r}")
        setattr(self, attr, max(0.0, min(1.0, volume)))

    def toggle_monitor(self, source: str, enabled: bool) -> None:
        """Enable/disable monitoring for a source."""
        attr = f"{source}_monitor"
        if not hasattr(self, attr):
            raise ValueError(f"Unknown audio source for monitoring: {source!r}")
        setattr(self, attr, enabled)

    def to_dict(self) -> dict:
        return {
            "com1_monitor": self.com1_monitor,
            "com2_monitor": self.com2_monitor,
            "nav1_monitor": self.nav1_monitor,
            "nav2_monitor": self.nav2_monitor,
            "adf_monitor": self.adf_monitor,
            "marker_monitor": self.marker_monitor,
            "speaker_enabled": self.speaker_enabled,
            "headphone_enabled": self.headphone_enabled,
            "com1_volume": self.com1_volume,
            "com2_volume": self.com2_volume,
            "nav1_volume": self.nav1_volume,
            "nav2_volume": self.nav2_volume,
            "adf_volume": self.adf_volume,
            "marker_volume": self.marker_volume,
            "intercom_enabled": self.intercom_enabled,
            "intercom_volume": self.intercom_volume,
            "music_enabled": self.music_enabled,
            "music_volume": self.music_volume,
        }


# ---------------------------------------------------------------------------
# Marker beacon lights
# ---------------------------------------------------------------------------

class MarkerLight(str, Enum):
    NONE = "none"
    OUTER = "outer"    # Blue — OM, 400 Hz, dashes
    MIDDLE = "middle"  # Amber — MM, 1300 Hz, alternating
    INNER = "inner"    # White — IM, 3000 Hz, dots


@dataclass
class MarkerBeaconReceiver:
    """Simulates the marker beacon receiver and lamp logic."""

    sensitivity_high: bool = True   # True = high sensitivity (low alt)
    active_light: MarkerLight = MarkerLight.NONE

    def update(
        self,
        outer: bool,
        middle: bool,
        inner: bool,
    ) -> None:
        """Update active light from audio_panel compute_marker_beacons output."""
        if inner:
            self.active_light = MarkerLight.INNER
        elif middle:
            self.active_light = MarkerLight.MIDDLE
        elif outer:
            self.active_light = MarkerLight.OUTER
        else:
            self.active_light = MarkerLight.NONE

    def to_dict(self) -> dict:
        return {
            "sensitivity_high": self.sensitivity_high,
            "active_light": self.active_light.value,
            "outer_lit": self.active_light == MarkerLight.OUTER,
            "middle_lit": self.active_light == MarkerLight.MIDDLE,
            "inner_lit": self.active_light == MarkerLight.INNER,
        }


# ---------------------------------------------------------------------------
# Legacy NavRadioState (kept for backward compatibility)
# ---------------------------------------------------------------------------

@dataclass
class NavRadioState:
    vor_radial: float = 0.0
    ils_localizer: float = 0.0
    ils_glideslope: float = 0.0
    adf_bearing: float = 0.0
    dme_range: float = 0.0


# ---------------------------------------------------------------------------
# NavRadioSimulationService — full implementation
# ---------------------------------------------------------------------------

@dataclass
class NavRadioSimulationService:
    """
    Unified nav/com/audio simulation service.

    Replaces the previous stub with full COM/NAV/transponder/audio-panel/
    marker-beacon implementations. NavRadioState is still updated on each
    call to update_state() for backward compatibility with callers that
    read nav_radio_state directly.
    """

    nav_radio_state: NavRadioState = field(default_factory=NavRadioState)

    # Radios
    com1: ComTransceiver = field(default_factory=lambda: ComTransceiver(active_freq=121.500))
    com2: ComTransceiver = field(default_factory=lambda: ComTransceiver(active_freq=121.500))
    nav1: NavReceiver = field(default_factory=lambda: NavReceiver(active_freq=108.000))
    nav2: NavReceiver = field(default_factory=lambda: NavReceiver(active_freq=108.000))

    # Transponder
    transponder: Transponder = field(default_factory=Transponder)

    # Audio
    audio_panel: AudioPanel = field(default_factory=AudioPanel)
    marker_receiver: MarkerBeaconReceiver = field(default_factory=MarkerBeaconReceiver)

    # ADF volume (separate from audio panel — direct knob on the ADF head)
    adf_volume: float = 0.5

    def update_state(
        self,
        course: float,
        radial: float,
        localizer: float,
        glideslope: float,
        navaid_position: tuple[float, float],
        aircraft_position: tuple[float, float],
    ) -> None:
        """Update nav radio state. Maintains backward-compatible interface."""
        self.nav_radio_state.vor_radial = calculate_vor_radial(course, radial)
        (
            self.nav_radio_state.ils_localizer,
            self.nav_radio_state.ils_glideslope,
        ) = calculate_ils_deviation(localizer, glideslope, aircraft_position)
        self.nav_radio_state.adf_bearing = calculate_adf_bearing(
            navaid_position, aircraft_position
        )
        self.nav_radio_state.dme_range = calculate_dme_range(
            navaid_position, aircraft_position
        )
        # Tick transponder (ident timeout)
        self.transponder.tick()

    def get_state(self) -> NavRadioState:
        """Return legacy NavRadioState for backward compatibility."""
        return self.nav_radio_state

    # --- COM ---

    def tune_com(self, radio: int, freq: float, standby: bool = True) -> None:
        """Tune COM1 (radio=1) or COM2 (radio=2). standby=True tunes standby; False tunes active."""
        tr = self.com1 if radio == 1 else self.com2
        if standby:
            tr.tune_standby(freq)
        else:
            tr.active_freq = _clamp_com_freq(freq)

    def flip_com(self, radio: int) -> None:
        (self.com1 if radio == 1 else self.com2).flip_flop()

    def set_com_volume(self, radio: int, volume: float) -> None:
        (self.com1 if radio == 1 else self.com2).set_volume(volume)

    def ptt(self, radio: int, pressed: bool) -> None:
        """Push-to-talk on COM1 (radio=1) or COM2 (radio=2)."""
        tr = self.com1 if radio == 1 else self.com2
        tr.transmit = pressed

    # --- NAV ---

    def tune_nav(self, radio: int, freq: float, standby: bool = True) -> None:
        nr = self.nav1 if radio == 1 else self.nav2
        if standby:
            nr.tune_standby(freq)
        else:
            nr.active_freq = _clamp_nav_freq(freq)

    def flip_nav(self, radio: int) -> None:
        (self.nav1 if radio == 1 else self.nav2).flip_flop()

    def set_nav_volume(self, radio: int, volume: float) -> None:
        (self.nav1 if radio == 1 else self.nav2).set_volume(volume)

    # --- ADF ---

    def set_adf_volume(self, volume: float) -> None:
        self.adf_volume = max(0.0, min(1.0, volume))

    # --- Transponder ---

    def set_squawk(self, code: str) -> None:
        self.transponder.set_squawk(code)

    def transponder_ident(self) -> None:
        self.transponder.ident()

    def set_transponder_mode(self, mode: TransponderMode | str) -> None:
        if isinstance(mode, str):
            mode = TransponderMode(mode)
        self.transponder.mode = mode

    # --- Audio panel ---

    def set_audio_volume(self, source: str, volume: float) -> None:
        """Set audio panel volume. source: com1|com2|nav1|nav2|adf|marker|intercom|music."""
        self.audio_panel.set_volume(source, volume)

    def toggle_audio_monitor(self, source: str, enabled: bool) -> None:
        self.audio_panel.toggle_monitor(source, enabled)

    def update_marker_lights(
        self, outer: bool, middle: bool, inner: bool
    ) -> None:
        """Feed marker beacon detection results into the receiver/lights."""
        self.marker_receiver.update(outer, middle, inner)

    # --- Full status snapshot ---

    def full_status(self) -> dict:
        return {
            "com1": self.com1.to_dict(),
            "com2": self.com2.to_dict(),
            "nav1": self.nav1.to_dict(),
            "nav2": self.nav2.to_dict(),
            "transponder": self.transponder.to_dict(),
            "audio_panel": self.audio_panel.to_dict(),
            "marker_receiver": self.marker_receiver.to_dict(),
            "adf_volume": self.adf_volume,
            "nav_state": {
                "vor_radial": self.nav_radio_state.vor_radial,
                "ils_localizer": self.nav_radio_state.ils_localizer,
                "ils_glideslope": self.nav_radio_state.ils_glideslope,
                "adf_bearing": self.nav_radio_state.adf_bearing,
                "dme_range": self.nav_radio_state.dme_range,
            },
        }
