from __future__ import annotations

from dataclasses import asdict, dataclass
import math
from typing import Sequence

from .ahrs import normalize_heading, normalize_signed_angle


EARTH_RADIUS_NM = 3440.065
ADF_TUNING_TOLERANCE_KHZ = 0.5
DME_TUNING_TOLERANCE_MHZ = 0.005


def _finite(name: str, value: float) -> float:
    try:
        result = float(value)
    except (TypeError, ValueError) as error:
        raise ValueError(f"{name} must be finite") from error
    if not math.isfinite(result):
        raise ValueError(f"{name} must be finite")
    return result


def _validate_position(latitude_deg: float, longitude_deg: float) -> None:
    latitude = _finite("latitude_deg", latitude_deg)
    longitude = _finite("longitude_deg", longitude_deg)
    if not -90.0 <= latitude <= 90.0:
        raise ValueError("latitude_deg out of range")
    if not -180.0 <= longitude <= 180.0:
        raise ValueError("longitude_deg out of range")


def _validate_identity(ident: str, name: str) -> None:
    if not isinstance(ident, str) or not ident.strip():
        raise ValueError("station_ident is required")
    if not isinstance(name, str) or not name.strip():
        raise ValueError("station_name is required")


def _validate_range(max_range_nm: float) -> float:
    result = _finite("max_range_nm", max_range_nm)
    if result <= 0.0:
        raise ValueError("max_range_nm must be positive")
    return result


@dataclass(frozen=True)
class AdfStation:
    station_ident: str
    station_name: str
    frequency_khz: float
    latitude_deg: float
    longitude_deg: float
    max_range_nm: float


@dataclass(frozen=True)
class DmeStation:
    station_ident: str
    station_name: str
    frequency_mhz: float
    latitude_deg: float
    longitude_deg: float
    elevation_ft: float
    max_range_nm: float


@dataclass(frozen=True)
class AdfSolution:
    tuned_frequency_khz: float
    station_ident: str
    station_name: str
    bearing_deg: float
    relative_bearing_deg: float
    distance_nm: float
    signal_strength: float
    receiving: bool

    def to_dict(self) -> dict[str, float | str | bool]:
        return asdict(self)


@dataclass(frozen=True)
class DmeSolution:
    tuned_frequency_mhz: float
    station_ident: str
    station_name: str
    slant_range_nm: float
    ground_speed_kt: float
    signal_strength: float
    receiving: bool

    def to_dict(self) -> dict[str, float | str | bool]:
        return asdict(self)


def great_circle_distance_nm(
    from_latitude_deg: float,
    from_longitude_deg: float,
    to_latitude_deg: float,
    to_longitude_deg: float,
) -> float:
    _validate_position(from_latitude_deg, from_longitude_deg)
    _validate_position(to_latitude_deg, to_longitude_deg)
    latitude_1 = math.radians(from_latitude_deg)
    latitude_2 = math.radians(to_latitude_deg)
    delta_latitude = latitude_2 - latitude_1
    delta_longitude = math.radians(to_longitude_deg - from_longitude_deg)
    a = math.sin(delta_latitude / 2.0) ** 2 + (
        math.cos(latitude_1)
        * math.cos(latitude_2)
        * math.sin(delta_longitude / 2.0) ** 2
    )
    return EARTH_RADIUS_NM * 2.0 * math.atan2(
        math.sqrt(a), math.sqrt(max(0.0, 1.0 - a))
    )


def initial_bearing_deg(
    from_latitude_deg: float,
    from_longitude_deg: float,
    to_latitude_deg: float,
    to_longitude_deg: float,
) -> float:
    _validate_position(from_latitude_deg, from_longitude_deg)
    _validate_position(to_latitude_deg, to_longitude_deg)
    latitude_1 = math.radians(from_latitude_deg)
    latitude_2 = math.radians(to_latitude_deg)
    delta_longitude = math.radians(to_longitude_deg - from_longitude_deg)
    y = math.sin(delta_longitude) * math.cos(latitude_2)
    x = math.cos(latitude_1) * math.sin(latitude_2) - (
        math.sin(latitude_1)
        * math.cos(latitude_2)
        * math.cos(delta_longitude)
    )
    return normalize_heading(math.degrees(math.atan2(y, x)))


def _signal_strength(distance_nm: float, max_range_nm: float) -> float:
    return max(0.0, min(1.0, 1.0 - (distance_nm / max_range_nm) ** 2))


def compute_adf(
    latitude_deg: float,
    longitude_deg: float,
    heading_deg: float,
    tuned_frequency_khz: float,
    stations: Sequence[AdfStation],
) -> AdfSolution:
    _validate_position(latitude_deg, longitude_deg)
    heading = normalize_heading(heading_deg)
    frequency = _finite("tuned_frequency_khz", tuned_frequency_khz)
    if frequency <= 0.0:
        raise ValueError("tuned_frequency_khz must be positive")
    candidates: list[tuple[float, str, AdfStation]] = []
    for station in stations:
        _validate_identity(station.station_ident, station.station_name)
        _validate_position(station.latitude_deg, station.longitude_deg)
        station_frequency = _finite("frequency_khz", station.frequency_khz)
        max_range = _validate_range(station.max_range_nm)
        if station_frequency <= 0.0:
            raise ValueError("frequency_khz must be positive")
        if abs(station_frequency - frequency) > ADF_TUNING_TOLERANCE_KHZ:
            continue
        distance = great_circle_distance_nm(
            latitude_deg,
            longitude_deg,
            station.latitude_deg,
            station.longitude_deg,
        )
        if distance < max_range:
            candidates.append((distance, station.station_ident, station))
    if not candidates:
        return AdfSolution(frequency, "", "", 0.0, 0.0, 0.0, 0.0, False)
    distance, _, station = min(candidates, key=lambda candidate: candidate[:2])
    bearing = initial_bearing_deg(
        latitude_deg, longitude_deg, station.latitude_deg, station.longitude_deg
    )
    return AdfSolution(
        tuned_frequency_khz=frequency,
        station_ident=station.station_ident,
        station_name=station.station_name,
        bearing_deg=bearing,
        relative_bearing_deg=normalize_signed_angle(bearing - heading),
        distance_nm=distance,
        signal_strength=_signal_strength(distance, station.max_range_nm),
        receiving=True,
    )


def compute_dme(
    latitude_deg: float,
    longitude_deg: float,
    altitude_ft: float,
    track_deg: float,
    ground_speed_kt: float,
    tuned_frequency_mhz: float,
    stations: Sequence[DmeStation],
) -> DmeSolution:
    _validate_position(latitude_deg, longitude_deg)
    altitude = _finite("altitude_ft", altitude_ft)
    track = normalize_heading(track_deg)
    ground_speed = max(0.0, _finite("ground_speed_kt", ground_speed_kt))
    frequency = _finite("tuned_frequency_mhz", tuned_frequency_mhz)
    if frequency <= 0.0:
        raise ValueError("tuned_frequency_mhz must be positive")
    candidates: list[tuple[float, str, float, DmeStation]] = []
    for station in stations:
        _validate_identity(station.station_ident, station.station_name)
        _validate_position(station.latitude_deg, station.longitude_deg)
        station_frequency = _finite("frequency_mhz", station.frequency_mhz)
        _finite("elevation_ft", station.elevation_ft)
        max_range = _validate_range(station.max_range_nm)
        if station_frequency <= 0.0:
            raise ValueError("frequency_mhz must be positive")
        if abs(station_frequency - frequency) > DME_TUNING_TOLERANCE_MHZ:
            continue
        horizontal_distance = great_circle_distance_nm(
            latitude_deg,
            longitude_deg,
            station.latitude_deg,
            station.longitude_deg,
        )
        vertical_distance = (altitude - station.elevation_ft) / 6076.11548556
        slant_range = math.hypot(horizontal_distance, vertical_distance)
        if slant_range < max_range:
            bearing = initial_bearing_deg(
                latitude_deg,
                longitude_deg,
                station.latitude_deg,
                station.longitude_deg,
            )
            candidates.append((slant_range, station.station_ident, bearing, station))
    if not candidates:
        return DmeSolution(frequency, "", "", 0.0, 0.0, 0.0, False)
    slant_range, _, bearing, station = min(
        candidates, key=lambda candidate: candidate[:2]
    )
    station_relative_ground_speed = abs(
        ground_speed * math.cos(math.radians(normalize_signed_angle(bearing - track)))
    )
    return DmeSolution(
        tuned_frequency_mhz=frequency,
        station_ident=station.station_ident,
        station_name=station.station_name,
        slant_range_nm=slant_range,
        ground_speed_kt=station_relative_ground_speed,
        signal_strength=_signal_strength(slant_range, station.max_range_nm),
        receiving=True,
    )
