from __future__ import annotations

from dataclasses import asdict, dataclass
import math
from typing import Sequence

from .radios import great_circle_distance_nm


IDENT_DURATION_SEC = 18.0
TRANSPONDER_MODES = ("OFF", "STBY", "A", "C", "S")


def _finite(name: str, value: float) -> float:
    try:
        result = float(value)
    except (TypeError, ValueError) as error:
        raise ValueError(f"{name} must be finite") from error
    if not math.isfinite(result):
        raise ValueError(f"{name} must be finite")
    return result


def _unit_interval(name: str, value: float) -> float:
    result = _finite(name, value)
    if not 0.0 <= result <= 1.0:
        raise ValueError(f"{name} out of range")
    return result


@dataclass(frozen=True)
class MarkerBeaconSite:
    name: str
    latitude_deg: float
    longitude_deg: float
    outer_radius_nm: float
    middle_radius_nm: float
    inner_radius_nm: float
    altitude_limit_ft: float


@dataclass(frozen=True)
class MarkerBeaconStatus:
    outer_active: bool
    middle_active: bool
    inner_active: bool

    def to_dict(self) -> dict[str, bool]:
        return asdict(self)


def _validate_marker_site(site: MarkerBeaconSite) -> None:
    if not isinstance(site.name, str) or not site.name.strip():
        raise ValueError("name is required")
    altitude_limit = _finite("altitude_limit_ft", site.altitude_limit_ft)
    inner = _finite("inner_radius_nm", site.inner_radius_nm)
    middle = _finite("middle_radius_nm", site.middle_radius_nm)
    outer = _finite("outer_radius_nm", site.outer_radius_nm)
    if altitude_limit < 0.0:
        raise ValueError("altitude_limit_ft out of range")
    if inner <= 0.0 or inner > middle or middle > outer:
        raise ValueError("marker radii must be positive and ordered")


def compute_marker_beacons(
    latitude_deg: float,
    longitude_deg: float,
    altitude_ft: float,
    sites: Sequence[MarkerBeaconSite],
) -> MarkerBeaconStatus:
    altitude = _finite("altitude_ft", altitude_ft)
    great_circle_distance_nm(latitude_deg, longitude_deg, latitude_deg, longitude_deg)
    best_priority = 0
    for site in sites:
        _validate_marker_site(site)
        if altitude > site.altitude_limit_ft:
            continue
        distance = great_circle_distance_nm(
            latitude_deg, longitude_deg, site.latitude_deg, site.longitude_deg
        )
        priority = (
            3
            if distance <= site.inner_radius_nm
            else 2
            if distance <= site.middle_radius_nm
            else 1
            if distance <= site.outer_radius_nm
            else 0
        )
        best_priority = max(best_priority, priority)
    return MarkerBeaconStatus(
        outer_active=best_priority == 1,
        middle_active=best_priority == 2,
        inner_active=best_priority == 3,
    )


@dataclass
class AudioPanelState:
    com1_enabled: bool
    com2_enabled: bool
    nav1_enabled: bool
    nav2_enabled: bool
    adf_enabled: bool
    marker_enabled: bool
    speaker_enabled: bool
    headphone_enabled: bool
    com1_volume: float
    com2_volume: float
    nav1_volume: float
    nav2_volume: float
    adf_volume: float
    marker_volume: float

    def to_dict(self) -> dict[str, float | bool]:
        return asdict(self)

    def to_status(
        self, adf_signal_strength: float, marker_status: MarkerBeaconStatus
    ) -> dict[str, float | bool]:
        volumes = {
            name: _unit_interval(name, getattr(self, name))
            for name in (
                "com1_volume",
                "com2_volume",
                "nav1_volume",
                "nav2_volume",
                "adf_volume",
                "marker_volume",
            )
        }
        signal = _unit_interval("adf_signal_strength", adf_signal_strength)
        marker_active = any(
            (
                marker_status.outer_active,
                marker_status.middle_active,
                marker_status.inner_active,
            )
        )
        return {
            **self.to_dict(),
            **volumes,
            "adf_audio_level": volumes["adf_volume"] * signal
            if self.adf_enabled
            else 0.0,
            "marker_audio_level": volumes["marker_volume"]
            if self.marker_enabled and marker_active
            else 0.0,
            "marker_outer_active": marker_status.outer_active,
            "marker_middle_active": marker_status.middle_active,
            "marker_inner_active": marker_status.inner_active,
        }


def normalize_squawk(value: str | int | None) -> str | None:
    if value is None or isinstance(value, bool):
        return None
    if isinstance(value, int):
        if value < 0:
            return None
        code = str(value)
    elif isinstance(value, str):
        code = value.strip()
    else:
        return None
    code = code.zfill(4)
    return code if len(code) == 4 and all(char in "01234567" for char in code) else None


@dataclass
class TransponderState:
    mode: str
    squawk_code: str
    ident_active: bool
    ident_remaining_sec: float

    def __post_init__(self) -> None:
        self._validate()

    def _validate(self) -> None:
        if self.mode not in TRANSPONDER_MODES:
            raise ValueError("invalid transponder mode")
        if normalize_squawk(self.squawk_code) != self.squawk_code:
            raise ValueError("invalid squawk_code")
        remaining = _finite("ident_remaining_sec", self.ident_remaining_sec)
        if remaining < 0.0:
            raise ValueError("ident_remaining_sec out of range")
        if self.ident_active != (remaining > 0.0):
            raise ValueError("IDENT state and remaining time disagree")

    def to_dict(self) -> dict[str, float | str | bool]:
        return asdict(self)

    def transition(
        self,
        *,
        mode: str | None = None,
        squawk_code: str | int | None = None,
        ident: bool | None = None,
        elapsed_sec: float = 0.0,
    ) -> None:
        self._validate()
        elapsed = _finite("elapsed_sec", elapsed_sec)
        if elapsed < 0.0:
            raise ValueError("elapsed_sec out of range")
        next_mode = self.mode
        if mode is not None:
            if mode not in TRANSPONDER_MODES:
                raise ValueError("invalid transponder mode")
            next_mode = mode
        next_squawk = self.squawk_code
        if squawk_code is not None:
            normalized = normalize_squawk(squawk_code)
            if normalized is None:
                raise ValueError("invalid squawk_code")
            next_squawk = normalized
        remaining = max(0.0, self.ident_remaining_sec - elapsed)
        if ident is True:
            remaining = IDENT_DURATION_SEC
        elif ident is False:
            remaining = 0.0
        self.mode = next_mode
        self.squawk_code = next_squawk
        self.ident_remaining_sec = remaining
        self.ident_active = remaining > 0.0

    def trigger_ident(self) -> None:
        self.transition(ident=True)

    def clear_ident(self) -> None:
        self.transition(ident=False)

    def update(self, delta: float) -> None:
        self.transition(elapsed_sec=delta)
