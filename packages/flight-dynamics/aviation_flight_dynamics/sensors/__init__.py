"""Sensor simulation modules for AHRS and ADC."""

from .ahrs import (
    AHRSConfig,
    AHRSOutput,
    AHRSSimulator,
    AttitudeAngles,
    CoordinateFrame,
    MagneticConfig,
    body_to_ned,
    ecef_to_ned,
    ned_to_body,
    ned_to_ecef,
    quaternion_to_euler,
    euler_to_quaternion,
)
from .adc import (
    ADCConfig,
    ADCOutput,
    ADCSimulator,
    AirspeedComponents,
    AltitudeComponents,
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
    "MagneticConfig",
    "body_to_ned",
    "ecef_to_ned",
    "ned_to_body",
    "ned_to_ecef",
    "quaternion_to_euler",
    "euler_to_quaternion",
    # ADC
    "ADCConfig",
    "ADCOutput",
    "ADCSimulator",
    "AirspeedComponents",
    "AltitudeComponents",
    "compute_cas_from_ias",
    "compute_tas_from_cas",
    "compute_mach_number",
    "compute_density_altitude",
    "compute_pressure_altitude",
]
