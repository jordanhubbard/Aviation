from __future__ import annotations

from dataclasses import dataclass, field
import math
import time
from typing import Dict

from app.models.aircraft_state import default_c172_state
from app.services.ahrs import compute_ahrs
from app.services.adc import compute_adc
from app.services.autopilot import (
    AutopilotStatus,
    LATERAL_MODES,
    PidConfig,
    PidController,
    VERTICAL_MODES,
)
from app.services.audio_panel import AudioPanelState, compute_marker_beacons
from app.services.gps import compute_gps
from app.services.nav_radios import (
    DEFAULT_ADF_FREQUENCY_KHZ,
    DEFAULT_DME_FREQUENCY_MHZ,
    compute_adf,
    compute_dme,
)
from app.services.transponder import TRANSPONDER_MODES, TransponderState, normalize_squawk


def clamp(value: float, minimum: float, maximum: float) -> float:
    return max(minimum, min(maximum, value))


def normalize_heading(heading: float) -> float:
    return heading % 360


def heading_difference(target: float, current: float) -> float:
    diff = (target - current + 180) % 360 - 180
    return diff


@dataclass
class AutopilotTargets:
    heading_deg: float
    altitude_ft: float
    airspeed_kt: float

    def to_dict(self) -> Dict[str, float]:
        return {
            "heading_deg": self.heading_deg,
            "altitude_ft": self.altitude_ft,
            "airspeed_kt": self.airspeed_kt,
        }


@dataclass
class FlightState:
    latitude_deg: float
    longitude_deg: float
    altitude_ft: float
    heading_deg: float
    airspeed_kt: float
    vertical_speed_fpm: float
    turn_rate_dps: float
    pitch_deg: float
    roll_deg: float
    timestamp: float


@dataclass
class FlightDynamicsConfig:
    max_climb_rate_fpm: float = 700.0
    max_turn_rate_dps: float = 3.0
    max_accel_kt_per_sec: float = 5.0
    speed_gain: float = 0.5
    altitude_capture_ft: float = 80.0
    autopilot_disconnect_seconds: float = 4.0
    heading_capture_deg: float = 3.0
    roll_pid: PidConfig = field(
        default_factory=lambda: PidConfig(
            kp=0.6,
            ki=0.02,
            kd=0.1,
            integrator_min=-20.0,
            integrator_max=20.0,
            output_min=-25.0,
            output_max=25.0,
        )
    )
    pitch_pid: PidConfig = field(
        default_factory=lambda: PidConfig(
            kp=0.02,
            ki=0.005,
            kd=0.01,
            integrator_min=-10.0,
            integrator_max=10.0,
            output_min=-10.0,
            output_max=10.0,
        )
    )


@dataclass
class FlightDynamicsSimulator:
    config: FlightDynamicsConfig = field(default_factory=FlightDynamicsConfig)
    state: FlightState = field(init=False)
    targets: AutopilotTargets = field(init=False)
    adf_frequency_khz: float = field(init=False)
    dme_frequency_mhz: float = field(init=False)
    roll_pid: PidController = field(init=False)
    pitch_pid: PidController = field(init=False)
    autopilot: AutopilotStatus = field(init=False)
    audio_panel: AudioPanelState = field(init=False)
    transponder: TransponderState = field(init=False)
    _roll_hold_deg: float = field(init=False, default=0.0)
    _pitch_hold_deg: float = field(init=False, default=0.0)
    _limit_timer: float = field(init=False, default=0.0)
    _last_update: float = field(init=False, default_factory=time.monotonic)

    def __post_init__(self) -> None:
        self.reset()

    def reset(self) -> None:
        initial_state = default_c172_state()
        self.state = FlightState(
            latitude_deg=initial_state.position.latitude_deg,
            longitude_deg=initial_state.position.longitude_deg,
            altitude_ft=initial_state.position.altitude_ft,
            heading_deg=initial_state.attitude.heading_deg,
            airspeed_kt=initial_state.speeds.airspeed_kt,
            vertical_speed_fpm=initial_state.speeds.vertical_speed_fpm,
            turn_rate_dps=0.0,
            pitch_deg=initial_state.attitude.pitch_deg,
            roll_deg=initial_state.attitude.roll_deg,
            timestamp=initial_state.timestamp,
        )
        self.targets = AutopilotTargets(
            heading_deg=self.state.heading_deg,
            altitude_ft=self.state.altitude_ft,
            airspeed_kt=self.state.airspeed_kt,
        )
        self.adf_frequency_khz = DEFAULT_ADF_FREQUENCY_KHZ
        self.dme_frequency_mhz = DEFAULT_DME_FREQUENCY_MHZ
        self.roll_pid = PidController(self.config.roll_pid)
        self.pitch_pid = PidController(self.config.pitch_pid)
        self.autopilot = AutopilotStatus(
            master_on=True,
            lateral_mode="HDG",
            vertical_mode="ALTS",
            lateral_armed="",
            vertical_armed="ALT",
            target_vertical_speed_fpm=0.0,
            bank_limit_active=False,
            pitch_limit_active=False,
            disconnect_reason="",
        )
        self.audio_panel = AudioPanelState(
            com1_enabled=True,
            com2_enabled=False,
            nav1_enabled=False,
            nav2_enabled=False,
            adf_enabled=False,
            marker_enabled=True,
            speaker_enabled=True,
            headphone_enabled=False,
            com1_volume=0.8,
            com2_volume=0.7,
            nav1_volume=0.7,
            nav2_volume=0.7,
            adf_volume=0.6,
            marker_volume=0.7,
        )
        self.transponder = TransponderState(
            mode="C",
            squawk_code="1200",
            ident_active=False,
            ident_remaining_sec=0.0,
        )
        self._roll_hold_deg = self.state.roll_deg
        self._pitch_hold_deg = self.state.pitch_deg
        self._limit_timer = 0.0
        self._last_update = time.monotonic()

    def set_targets(
        self,
        heading_deg: float | None = None,
        altitude_ft: float | None = None,
        airspeed_kt: float | None = None,
    ) -> None:
        if heading_deg is not None:
            self.targets.heading_deg = normalize_heading(heading_deg)
            self.roll_pid.reset()
        if altitude_ft is not None:
            self.targets.altitude_ft = altitude_ft
            self.pitch_pid.reset()
        if airspeed_kt is not None:
            self.targets.airspeed_kt = max(0.0, airspeed_kt)

    def set_autopilot(
        self,
        master_on: bool | None = None,
        lateral_mode: str | None = None,
        vertical_mode: str | None = None,
        target_vertical_speed_fpm: float | None = None,
    ) -> None:
        if master_on is not None:
            self.autopilot.master_on = master_on
            if master_on:
                self.autopilot.disconnect_reason = ""
            else:
                self.autopilot.disconnect_reason = "manual"
                self.autopilot.lateral_mode = "ROL"
                self.autopilot.vertical_mode = "PIT"
                self.autopilot.lateral_armed = ""
                self.autopilot.vertical_armed = ""
            self._limit_timer = 0.0
        if lateral_mode and lateral_mode in LATERAL_MODES:
            if lateral_mode == "NAV":
                self.autopilot.lateral_armed = "NAV"
                if self.autopilot.lateral_mode == "ROL":
                    self.autopilot.lateral_mode = "HDG"
            else:
                self.autopilot.lateral_mode = lateral_mode
                self.autopilot.lateral_armed = ""
                if lateral_mode == "ROL":
                    self._roll_hold_deg = self.state.roll_deg
            self.roll_pid.reset()
        if vertical_mode and vertical_mode in VERTICAL_MODES:
            self.autopilot.vertical_mode = vertical_mode
            if vertical_mode in {"ALTS", "VS"}:
                self.autopilot.vertical_armed = "ALT"
            else:
                self.autopilot.vertical_armed = ""
            if vertical_mode == "PIT":
                self._pitch_hold_deg = self.state.pitch_deg
            self.pitch_pid.reset()
        if target_vertical_speed_fpm is not None:
            self.autopilot.target_vertical_speed_fpm = target_vertical_speed_fpm
        elif vertical_mode == "VS":
            self.autopilot.target_vertical_speed_fpm = self.state.vertical_speed_fpm

    def set_audio_panel(
        self,
        com1_enabled: bool | None = None,
        com2_enabled: bool | None = None,
        nav1_enabled: bool | None = None,
        nav2_enabled: bool | None = None,
        adf_enabled: bool | None = None,
        marker_enabled: bool | None = None,
        speaker_enabled: bool | None = None,
        headphone_enabled: bool | None = None,
        com1_volume: float | None = None,
        com2_volume: float | None = None,
        nav1_volume: float | None = None,
        nav2_volume: float | None = None,
        adf_volume: float | None = None,
        marker_volume: float | None = None,
    ) -> None:
        if com1_enabled is not None:
            self.audio_panel.com1_enabled = com1_enabled
        if com2_enabled is not None:
            self.audio_panel.com2_enabled = com2_enabled
        if nav1_enabled is not None:
            self.audio_panel.nav1_enabled = nav1_enabled
        if nav2_enabled is not None:
            self.audio_panel.nav2_enabled = nav2_enabled
        if adf_enabled is not None:
            self.audio_panel.adf_enabled = adf_enabled
        if marker_enabled is not None:
            self.audio_panel.marker_enabled = marker_enabled
        if speaker_enabled is not None:
            self.audio_panel.speaker_enabled = speaker_enabled
        if headphone_enabled is not None:
            self.audio_panel.headphone_enabled = headphone_enabled
        if com1_volume is not None:
            self.audio_panel.com1_volume = clamp(com1_volume, 0.0, 1.0)
        if com2_volume is not None:
            self.audio_panel.com2_volume = clamp(com2_volume, 0.0, 1.0)
        if nav1_volume is not None:
            self.audio_panel.nav1_volume = clamp(nav1_volume, 0.0, 1.0)
        if nav2_volume is not None:
            self.audio_panel.nav2_volume = clamp(nav2_volume, 0.0, 1.0)
        if adf_volume is not None:
            self.audio_panel.adf_volume = clamp(adf_volume, 0.0, 1.0)
        if marker_volume is not None:
            self.audio_panel.marker_volume = clamp(marker_volume, 0.0, 1.0)

    def set_transponder(
        self,
        mode: str | None = None,
        squawk_code: str | int | None = None,
        ident: bool | None = None,
    ) -> None:
        if mode and mode in TRANSPONDER_MODES:
            self.transponder.mode = mode
        if squawk_code is not None:
            normalized = normalize_squawk(squawk_code)
            if normalized is not None:
                self.transponder.squawk_code = normalized
        if ident is True:
            self.transponder.trigger_ident()
        elif ident is False:
            self.transponder.clear_ident()

    def set_adf_frequency(self, frequency_khz: float | None) -> None:
        if frequency_khz is None:
            return
        self.adf_frequency_khz = max(0.0, frequency_khz)

    def set_dme_frequency(self, frequency_mhz: float | None) -> None:
        if frequency_mhz is None:
            return
        self.dme_frequency_mhz = max(0.0, frequency_mhz)

    def step(self) -> Dict[str, object]:
        now = time.monotonic()
        delta = max(0.0, now - self._last_update)
        if delta == 0:
            return self.snapshot()

        self._last_update = now
        self.transponder.update(delta)
        if not self.autopilot.master_on:
            self._limit_timer = 0.0
            self.autopilot.bank_limit_active = False
            self.autopilot.pitch_limit_active = False
            self._update_speed(delta)
            self._update_position(delta)
            self.state.turn_rate_dps = 0.0
            self.state.vertical_speed_fpm = 0.0
            self.state.timestamp = time.time()
            return self.snapshot()
        self._update_heading(delta)
        self._update_altitude(delta)
        self._update_speed(delta)
        self._update_position(delta)
        self.state.timestamp = time.time()
        return self.snapshot()

    def snapshot(self) -> Dict[str, object]:
        ahrs = compute_ahrs(
            heading_deg=self.state.heading_deg,
            pitch_deg=self.state.pitch_deg,
            roll_deg=self.state.roll_deg,
            turn_rate_dps=self.state.turn_rate_dps,
            airspeed_kt=self.state.airspeed_kt,
            latitude_deg=self.state.latitude_deg,
            longitude_deg=self.state.longitude_deg,
        )
        adc = compute_adc(
            altitude_ft=self.state.altitude_ft,
            airspeed_kt=self.state.airspeed_kt,
            vertical_speed_fpm=self.state.vertical_speed_fpm,
        )
        gps = compute_gps(
            latitude_deg=self.state.latitude_deg,
            longitude_deg=self.state.longitude_deg,
            altitude_ft=self.state.altitude_ft,
            ground_speed_kt=self.state.airspeed_kt,
            track_deg=self.state.heading_deg,
            timestamp=self.state.timestamp,
        )
        adf = compute_adf(
            latitude_deg=self.state.latitude_deg,
            longitude_deg=self.state.longitude_deg,
            heading_deg=self.state.heading_deg,
            tuned_frequency_khz=self.adf_frequency_khz,
        )
        dme = compute_dme(
            latitude_deg=self.state.latitude_deg,
            longitude_deg=self.state.longitude_deg,
            altitude_ft=self.state.altitude_ft,
            track_deg=self.state.heading_deg,
            ground_speed_kt=self.state.airspeed_kt,
            tuned_frequency_mhz=self.dme_frequency_mhz,
        )
        marker_status = compute_marker_beacons(
            self.state.latitude_deg,
            self.state.longitude_deg,
            self.state.altitude_ft,
        )
        adf_signal = adf.signal_strength if adf.receiving else 0.0
        audio_panel = self.audio_panel.to_status(adf_signal, marker_status)
        return {
            "position": {
                "latitude_deg": self.state.latitude_deg,
                "longitude_deg": self.state.longitude_deg,
                "altitude_ft": self.state.altitude_ft,
            },
            "attitude": ahrs.to_dict(),
            "adc": adc.to_dict(),
            "gps": gps.to_dict(),
            "adf": adf.to_dict(),
            "dme": dme.to_dict(),
            "autopilot": self.autopilot.to_dict(),
            "audio_panel": audio_panel,
            "transponder": self.transponder.to_dict(),
            "velocity": {
                "airspeed_kt": self.state.airspeed_kt,
                "vertical_speed_fpm": self.state.vertical_speed_fpm,
                "turn_rate_dps": self.state.turn_rate_dps,
            },
            "targets": self.targets.to_dict(),
            "timestamp": self.state.timestamp,
        }

    def _update_heading(self, delta: float) -> None:
        if self.autopilot.lateral_mode == "ROL":
            roll_command = self._roll_hold_deg
            heading_error = 0.0
        else:
            heading_error = heading_difference(self.targets.heading_deg, self.state.heading_deg)
            self._update_lateral_capture(heading_error)
            roll_command = self.roll_pid.update(heading_error, delta)
        max_roll = max(abs(self.config.roll_pid.output_min), abs(self.config.roll_pid.output_max), 1e-6)
        roll_command = clamp(roll_command, -max_roll, max_roll)
        desired_turn_rate = clamp(
            (roll_command / max_roll) * self.config.max_turn_rate_dps,
            -self.config.max_turn_rate_dps,
            self.config.max_turn_rate_dps,
        )
        self.state.turn_rate_dps = desired_turn_rate
        self.state.heading_deg = normalize_heading(
            self.state.heading_deg + desired_turn_rate * delta
        )
        self.state.roll_deg = roll_command
        self.autopilot.bank_limit_active = abs(roll_command) >= max_roll * 0.99

    def _update_altitude(self, delta: float) -> None:
        altitude_error = self.targets.altitude_ft - self.state.altitude_ft
        if self.autopilot.vertical_mode == "PIT":
            pitch_command = self._pitch_hold_deg
        elif self.autopilot.vertical_mode == "VS":
            desired_vs = clamp(
                self.autopilot.target_vertical_speed_fpm,
                -self.config.max_climb_rate_fpm,
                self.config.max_climb_rate_fpm,
            )
            max_pitch = max(
                abs(self.config.pitch_pid.output_min),
                abs(self.config.pitch_pid.output_max),
                1e-6,
            )
            pitch_command = clamp(
                (desired_vs / self.config.max_climb_rate_fpm) * max_pitch,
                -max_pitch,
                max_pitch,
            )
        else:
            pitch_command = self.pitch_pid.update(altitude_error, delta)
        max_pitch = max(abs(self.config.pitch_pid.output_min), abs(self.config.pitch_pid.output_max), 1e-6)
        pitch_command = clamp(pitch_command, -max_pitch, max_pitch)
        desired_vs = clamp(
            (pitch_command / max_pitch) * self.config.max_climb_rate_fpm,
            -self.config.max_climb_rate_fpm,
            self.config.max_climb_rate_fpm,
        )
        self.state.vertical_speed_fpm = desired_vs
        self.state.altitude_ft += desired_vs * delta / 60.0
        self.state.pitch_deg = pitch_command
        self.autopilot.pitch_limit_active = abs(pitch_command) >= max_pitch * 0.99
        self._update_vertical_capture(altitude_error)
        self._update_autopilot_limits(delta)

    def _update_speed(self, delta: float) -> None:
        speed_error = self.targets.airspeed_kt - self.state.airspeed_kt
        accel = clamp(
            speed_error * self.config.speed_gain,
            -self.config.max_accel_kt_per_sec,
            self.config.max_accel_kt_per_sec,
        )
        self.state.airspeed_kt = max(0.0, self.state.airspeed_kt + accel * delta)

    def _update_position(self, delta: float) -> None:
        distance_nm = self.state.airspeed_kt * delta / 3600.0
        if distance_nm == 0:
            return
        heading_rad = math.radians(self.state.heading_deg)
        lat_rad = math.radians(self.state.latitude_deg)
        delta_lat = (distance_nm * math.cos(heading_rad)) / 60.0
        delta_lon = (distance_nm * math.sin(heading_rad)) / max(1e-6, 60.0 * math.cos(lat_rad))
        self.state.latitude_deg += delta_lat
        self.state.longitude_deg += delta_lon

    def _update_vertical_capture(self, altitude_error: float) -> None:
        if self.autopilot.vertical_mode not in {"ALTS", "VS"}:
            return
        if abs(altitude_error) <= self.config.altitude_capture_ft:
            self.autopilot.vertical_mode = "ALT"
            self.autopilot.vertical_armed = ""
            self.pitch_pid.reset()

    def _update_lateral_capture(self, heading_error: float) -> None:
        if self.autopilot.lateral_armed != "NAV":
            return
        if abs(heading_error) <= self.config.heading_capture_deg:
            self.autopilot.lateral_mode = "NAV"
            self.autopilot.lateral_armed = ""
            self.roll_pid.reset()

    def _update_autopilot_limits(self, delta: float) -> None:
        if not self.autopilot.master_on:
            self._limit_timer = 0.0
            return
        if self.autopilot.bank_limit_active or self.autopilot.pitch_limit_active:
            self._limit_timer += delta
        else:
            self._limit_timer = 0.0
        if self._limit_timer >= self.config.autopilot_disconnect_seconds:
            self._disconnect_autopilot("limit")

    def _disconnect_autopilot(self, reason: str) -> None:
        self.autopilot.master_on = False
        self.autopilot.disconnect_reason = reason
        self.autopilot.lateral_mode = "ROL"
        self.autopilot.vertical_mode = "PIT"
        self.autopilot.lateral_armed = ""
        self.autopilot.vertical_armed = ""
        self.autopilot.bank_limit_active = False
        self.autopilot.pitch_limit_active = False
        self._limit_timer = 0.0
        self._roll_hold_deg = self.state.roll_deg
        self._pitch_hold_deg = self.state.pitch_deg
        self.roll_pid.reset()
        self.pitch_pid.reset()
