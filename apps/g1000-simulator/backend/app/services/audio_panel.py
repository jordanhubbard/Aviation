from __future__ import annotations

from dataclasses import dataclass
import math
from typing import Dict, Iterable


MARKER_MAX_ALTITUDE_FT = 2500.0


@dataclass(frozen=True)
class MarkerBeaconSite:
    name: str
    latitude_deg: float
    longitude_deg: float
    outer_radius_nm: float
    middle_radius_nm: float
    inner_radius_nm: float
    altitude_limit_ft: float = MARKER_MAX_ALTITUDE_FT


DEFAULT_MARKER_SITES: tuple[MarkerBeaconSite, ...] = (
    MarkerBeaconSite(
        name="SFO",
        latitude_deg=37.6190,
        longitude_deg=-122.3738,
        outer_radius_nm=4.0,
        middle_radius_nm=1.0,
        inner_radius_nm=0.35,
    ),
    MarkerBeaconSite(
        name="SJC",
        latitude_deg=37.3626,
        longitude_deg=-121.9290,
        outer_radius_nm=4.0,
        middle_radius_nm=1.0,
        inner_radius_nm=0.35,
    ),
)


@dataclass
class MarkerBeaconStatus:
    outer_active: bool
    middle_active: bool
    inner_active: bool

    def to_dict(self) -> Dict[str, bool]:
        return {
            "outer_active": self.outer_active,
            "middle_active": self.middle_active,
            "inner_active": self.inner_active,
        }


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

    def to_dict(self) -> Dict[str, float | bool]:
        return {
            "com1_enabled": self.com1_enabled,
            "com2_enabled": self.com2_enabled,
            "nav1_enabled": self.nav1_enabled,
            "nav2_enabled": self.nav2_enabled,
            "adf_enabled": self.adf_enabled,
            "marker_enabled": self.marker_enabled,
            "speaker_enabled": self.speaker_enabled,
            "headphone_enabled": self.headphone_enabled,
            "com1_volume": self.com1_volume,
            "com2_volume": self.com2_volume,
            "nav1_volume": self.nav1_volume,
            "nav2_volume": self.nav2_volume,
            "adf_volume": self.adf_volume,
            "marker_volume": self.marker_volume,
        }

    def to_status(
        self, adf_signal_strength: float, marker_status: MarkerBeaconStatus
    ) -> Dict[str, float | bool]:
        marker_active = (
            marker_status.outer_active
            or marker_status.middle_active
            or marker_status.inner_active
        )
        adf_audio_level = (
            self.adf_volume * adf_signal_strength if self.adf_enabled else 0.0
        )
        marker_audio_level = (
            self.marker_volume if self.marker_enabled and marker_active else 0.0
        )
        return {
            **self.to_dict(),
            "adf_audio_level": adf_audio_level,
            "marker_audio_level": marker_audio_level,
            "marker_outer_active": marker_status.outer_active,
            "marker_middle_active": marker_status.middle_active,
            "marker_inner_active": marker_status.inner_active,
        }


def compute_marker_beacons(
    latitude_deg: float,
    longitude_deg: float,
    altitude_ft: float,
    sites: Iterable[MarkerBeaconSite] = DEFAULT_MARKER_SITES,
) -> MarkerBeaconStatus:
    inner_active = False
    middle_active = False
    outer_active = False

    for site in sites:
        if altitude_ft > site.altitude_limit_ft:
            continue
        distance_nm = _distance_nm(
            latitude_deg,
            longitude_deg,
            site.latitude_deg,
            site.longitude_deg,
        )
        if distance_nm <= site.inner_radius_nm:
            inner_active = True
        elif distance_nm <= site.middle_radius_nm:
            middle_active = True
        elif distance_nm <= site.outer_radius_nm:
            outer_active = True

    if inner_active:
        return MarkerBeaconStatus(outer_active=False, middle_active=False, inner_active=True)
    if middle_active:
        return MarkerBeaconStatus(outer_active=False, middle_active=True, inner_active=False)
    if outer_active:
        return MarkerBeaconStatus(outer_active=True, middle_active=False, inner_active=False)
    return MarkerBeaconStatus(outer_active=False, middle_active=False, inner_active=False)


def _distance_nm(
    latitude_deg: float,
    longitude_deg: float,
    target_latitude_deg: float,
    target_longitude_deg: float,
) -> float:
    lat1 = math.radians(latitude_deg)
    lat2 = math.radians(target_latitude_deg)
    dlat = lat2 - lat1
    dlon = math.radians(target_longitude_deg - longitude_deg)
    a = (
        math.sin(dlat / 2.0) ** 2
        + math.cos(lat1) * math.cos(lat2) * math.sin(dlon / 2.0) ** 2
    )
    c = 2.0 * math.atan2(math.sqrt(a), math.sqrt(1.0 - a))
    return 3440.065 * c
