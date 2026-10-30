from .adc import AdcSolution, compute_adc, standard_temperature_c
from .ahrs import (
    AhrsSolution,
    compute_ahrs,
    estimate_magnetic_variation,
    normalize_heading,
    normalize_signed_angle,
)
from .gps import GpsSolution, compute_gps, is_waas_available
from .controls import (
    IDENT_DURATION_SEC,
    TRANSPONDER_MODES,
    AudioPanelState,
    MarkerBeaconSite,
    MarkerBeaconStatus,
    TransponderState,
    compute_marker_beacons,
    normalize_squawk,
)
from .radios import (
    AdfSolution,
    AdfStation,
    DmeSolution,
    DmeStation,
    compute_adf,
    compute_dme,
    great_circle_distance_nm,
    initial_bearing_deg,
)

__all__ = [
    "AdcSolution",
    "AdfSolution",
    "AdfStation",
    "AhrsSolution",
    "DmeSolution",
    "DmeStation",
    "GpsSolution",
    "AudioPanelState",
    "IDENT_DURATION_SEC",
    "MarkerBeaconSite",
    "MarkerBeaconStatus",
    "TRANSPONDER_MODES",
    "TransponderState",
    "compute_adc",
    "compute_adf",
    "compute_ahrs",
    "compute_dme",
    "compute_gps",
    "compute_marker_beacons",
    "estimate_magnetic_variation",
    "great_circle_distance_nm",
    "initial_bearing_deg",
    "is_waas_available",
    "normalize_heading",
    "normalize_squawk",
    "normalize_signed_angle",
    "standard_temperature_c",
]
