from __future__ import annotations

from dataclasses import dataclass
import math
from typing import Dict, Iterable


ADF_TUNING_TOLERANCE_KHZ = 1.0
ADF_MAX_RANGE_NM = 75.0
ADF_MIN_SIGNAL = 0.05

DME_TUNING_TOLERANCE_MHZ = 0.05
DME_MAX_RANGE_NM = 120.0
DME_MIN_SIGNAL = 0.05


@dataclass(frozen=True)
class AdfStation:
    ident: str
    name: str
    latitude_deg: float
    longitude_deg: float
    frequency_khz: float


@dataclass(frozen=True)
class DmeStation:
    ident: str
    name: str
    latitude_deg: float
    longitude_deg: float
    frequency_mhz: float
    elevation_ft: float


DEFAULT_ADF_STATIONS: tuple[AdfStation, ...] = (
    AdfStation(
        ident="SFO",
        name="San Francisco NDB",
        latitude_deg=37.6190,
        longitude_deg=-122.3738,
        frequency_khz=365.0,
    ),
    AdfStation(
        ident="SJC",
        name="San Jose NDB",
        latitude_deg=37.3626,
        longitude_deg=-121.9290,
        frequency_khz=305.0,
    ),
)

DEFAULT_DME_STATIONS: tuple[DmeStation, ...] = (
    DmeStation(
        ident="SFO",
        name="San Francisco VORTAC",
        latitude_deg=37.6190,
        longitude_deg=-122.3738,
        frequency_mhz=115.80,
        elevation_ft=13.0,
    ),
    DmeStation(
        ident="SJC",
        name="San Jose VOR/DME",
        latitude_deg=37.3626,
        longitude_deg=-121.9290,
        frequency_mhz=113.10,
        elevation_ft=62.0,
    ),
)

DEFAULT_ADF_FREQUENCY_KHZ = DEFAULT_ADF_STATIONS[0].frequency_khz
DEFAULT_DME_FREQUENCY_MHZ = DEFAULT_DME_STATIONS[0].frequency_mhz


@dataclass
class AdfSolution:
    tuned_frequency_khz: float
    station_ident: str
    station_name: str
    bearing_deg: float
    relative_bearing_deg: float
    distance_nm: float
    signal_strength: float
    receiving: bool

    def to_dict(self) -> Dict[str, float | str | bool]:
        return {
            "tuned_frequency_khz": self.tuned_frequency_khz,
            "station_ident": self.station_ident,
            "station_name": self.station_name,
            "bearing_deg": self.bearing_deg,
            "relative_bearing_deg": self.relative_bearing_deg,
            "distance_nm": self.distance_nm,
            "signal_strength": self.signal_strength,
            "receiving": self.receiving,
        }


@dataclass
class DmeSolution:
    tuned_frequency_mhz: float
    station_ident: str
    station_name: str
    slant_range_nm: float
    ground_speed_kt: float
    signal_strength: float
    receiving: bool

    def to_dict(self) -> Dict[str, float | str | bool]:
        return {
            "tuned_frequency_mhz": self.tuned_frequency_mhz,
            "station_ident": self.station_ident,
            "station_name": self.station_name,
            "slant_range_nm": self.slant_range_nm,
            "ground_speed_kt": self.ground_speed_kt,
            "signal_strength": self.signal_strength,
            "receiving": self.receiving,
        }


def _clamp(value: float, minimum: float, maximum: float) -> float:
    return max(minimum, min(maximum, value))


def _find_adf_station(
    frequency_khz: float, stations: Iterable[AdfStation] = DEFAULT_ADF_STATIONS
) -> AdfStation | None:
    for station in stations:
        if abs(station.frequency_khz - frequency_khz) <= ADF_TUNING_TOLERANCE_KHZ:
            return station
    return None


def _find_dme_station(
    frequency_mhz: float, stations: Iterable[DmeStation] = DEFAULT_DME_STATIONS
) -> DmeStation | None:
    for station in stations:
        if abs(station.frequency_mhz - frequency_mhz) <= DME_TUNING_TOLERANCE_MHZ:
            return station
    return None


def _distance_and_bearing(
    latitude_deg: float,
    longitude_deg: float,
    station_latitude_deg: float,
    station_longitude_deg: float,
) -> tuple[float, float]:
    lat1 = math.radians(latitude_deg)
    lat2 = math.radians(station_latitude_deg)
    dlat = lat2 - lat1
    dlon = math.radians(station_longitude_deg - longitude_deg)
    a = (
        math.sin(dlat / 2.0) ** 2
        + math.cos(lat1) * math.cos(lat2) * math.sin(dlon / 2.0) ** 2
    )
    c = 2.0 * math.atan2(math.sqrt(a), math.sqrt(1.0 - a))
    distance_nm = 3440.065 * c
    y = math.sin(dlon) * math.cos(lat2)
    x = math.cos(lat1) * math.sin(lat2) - math.sin(lat1) * math.cos(lat2) * math.cos(dlon)
    bearing_deg = (math.degrees(math.atan2(y, x)) + 360.0) % 360.0
    return distance_nm, bearing_deg


def compute_adf(
    latitude_deg: float,
    longitude_deg: float,
    heading_deg: float,
    tuned_frequency_khz: float,
    stations: Iterable[AdfStation] = DEFAULT_ADF_STATIONS,
) -> AdfSolution:
    station = _find_adf_station(tuned_frequency_khz, stations)
    if not station:
        return AdfSolution(
            tuned_frequency_khz=tuned_frequency_khz,
            station_ident="",
            station_name="",
            bearing_deg=0.0,
            relative_bearing_deg=0.0,
            distance_nm=0.0,
            signal_strength=0.0,
            receiving=False,
        )
    distance_nm, bearing_deg = _distance_and_bearing(
        latitude_deg,
        longitude_deg,
        station.latitude_deg,
        station.longitude_deg,
    )
    signal_strength = _clamp(1.0 - distance_nm / ADF_MAX_RANGE_NM, 0.0, 1.0)
    receiving = signal_strength >= ADF_MIN_SIGNAL
    relative_bearing_deg = (bearing_deg - heading_deg + 360.0) % 360.0 if receiving else 0.0
    return AdfSolution(
        tuned_frequency_khz=tuned_frequency_khz,
        station_ident=station.ident,
        station_name=station.name,
        bearing_deg=bearing_deg if receiving else 0.0,
        relative_bearing_deg=relative_bearing_deg,
        distance_nm=distance_nm,
        signal_strength=signal_strength,
        receiving=receiving,
    )


def compute_dme(
    latitude_deg: float,
    longitude_deg: float,
    altitude_ft: float,
    track_deg: float,
    ground_speed_kt: float,
    tuned_frequency_mhz: float,
    stations: Iterable[DmeStation] = DEFAULT_DME_STATIONS,
) -> DmeSolution:
    station = _find_dme_station(tuned_frequency_mhz, stations)
    if not station:
        return DmeSolution(
            tuned_frequency_mhz=tuned_frequency_mhz,
            station_ident="",
            station_name="",
            slant_range_nm=0.0,
            ground_speed_kt=0.0,
            signal_strength=0.0,
            receiving=False,
        )
    horizontal_distance_nm, bearing_deg = _distance_and_bearing(
        latitude_deg,
        longitude_deg,
        station.latitude_deg,
        station.longitude_deg,
    )
    vertical_distance_nm = abs(altitude_ft - station.elevation_ft) / 6076.12
    slant_range_nm = math.hypot(horizontal_distance_nm, vertical_distance_nm)
    course_delta = math.radians((track_deg - bearing_deg + 360.0) % 360.0)
    radial_speed = ground_speed_kt * math.cos(course_delta)
    signal_strength = _clamp(1.0 - slant_range_nm / DME_MAX_RANGE_NM, 0.0, 1.0)
    receiving = signal_strength >= DME_MIN_SIGNAL
    return DmeSolution(
        tuned_frequency_mhz=tuned_frequency_mhz,
        station_ident=station.ident,
        station_name=station.name,
        slant_range_nm=slant_range_nm if receiving else 0.0,
        ground_speed_kt=abs(radial_speed) if receiving else 0.0,
        signal_strength=signal_strength,
        receiving=receiving,
    )
