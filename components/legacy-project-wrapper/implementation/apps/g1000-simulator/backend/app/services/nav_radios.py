from __future__ import annotations

from dataclasses import asdict, dataclass

DEFAULT_ADF_FREQUENCY_KHZ: float = 190.0
DEFAULT_DME_FREQUENCY_MHZ: float = 108.0


@dataclass
class AdfSolution:
    tuned_frequency_khz: float
    receiving: bool
    bearing_deg: float
    signal_strength: float

    def to_dict(self) -> dict:
        return asdict(self)


@dataclass
class DmeSolution:
    tuned_frequency_mhz: float
    receiving: bool
    distance_nm: float
    ground_speed_kt: float
    time_to_station_min: float

    def to_dict(self) -> dict:
        return asdict(self)


def compute_adf(
    latitude_deg: float,
    longitude_deg: float,
    heading_deg: float,
    tuned_frequency_khz: float,
) -> AdfSolution:
    receiving = 190.0 <= tuned_frequency_khz <= 1750.0
    return AdfSolution(
        tuned_frequency_khz=tuned_frequency_khz,
        receiving=receiving,
        bearing_deg=0.0,
        signal_strength=0.8 if receiving else 0.0,
    )


def compute_dme(
    latitude_deg: float,
    longitude_deg: float,
    altitude_ft: float,
    track_deg: float,
    ground_speed_kt: float,
    tuned_frequency_mhz: float,
) -> DmeSolution:
    receiving = 108.0 <= tuned_frequency_mhz <= 117.95
    return DmeSolution(
        tuned_frequency_mhz=tuned_frequency_mhz,
        receiving=receiving,
        distance_nm=0.0,
        ground_speed_kt=ground_speed_kt,
        time_to_station_min=0.0,
    )


def calculate_vor_radial(bearing: float) -> float:
    return bearing


def calculate_ils_localizer(deviation: float) -> float:
    return deviation


def calculate_adf_bearing(bearing: float) -> float:
    return bearing


def calculate_dme_range(distance: float) -> float:
    return distance
