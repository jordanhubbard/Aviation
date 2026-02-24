"""Sensor simulation modules for AHRS and ADC."""

from .ahrs import (
    AHRSConfig,
    AHRSOutput,
    AHRSSimulator,
    AttitudeAngles,
    CoordinateFrame,
    MagneticVariation,
    SlipSkidIndicator,
    body_to_ned,
    ned_to_body,
    ned_to_ecef,
    ecef_to_ned,
)
from .adc import (
    ADCConfig,
    ADCOutput,
    ADCSimulator,
    AirspeedType,
    AltitudeType,
    compute_cas_from_ias,
    compute_tas_from_cas,
    compute_mach_number,
    compute_density_altitude,
    compute_pressure_altitude,
)

__all__ = [
    # AHRS
    "AHRSConfig",
    "AHRSOutput",
    "AHRSSimulator",
    "AttitudeAngles",
    "CoordinateFrame",
    "MagneticVariation",
    "SlipSkidIndicator",
    "body_to_ned",
    "ned_to_body",
    "ned_to_ecef",
    "ecef_to_ned",
    # ADC
    "ADCConfig",
    "ADCOutput",
    "ADCSimulator",
    "AirspeedType",
    "AltitudeType",
    "compute_cas_from_ias",
    "compute_tas_from_cas",
    "compute_mach_number",
    "compute_density_altitude",
    "compute_pressure_altitude",
]
