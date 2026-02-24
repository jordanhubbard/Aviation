"""Sensor simulation modules for AHRS and ADC."""

from .ahrs import (
    AHRSConfig,
    AHRSOutput,
    AHRSSimulator,
    CoordinateFrame,
    EulerAngles,
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
    AirspeedType,
    AltitudeType,
    ias_to_cas,
    cas_to_tas,
    ias_to_tas,
    pressure_to_altitude,
    altitude_to_pressure,
    compute_density_altitude,
    compute_mach_number,
)

__all__ = [
    # AHRS
    "AHRSConfig",
    "AHRSOutput",
    "AHRSSimulator",
    "CoordinateFrame",
    "EulerAngles",
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
    "AirspeedType",
    "AltitudeType",
    "ias_to_cas",
    "cas_to_tas",
    "ias_to_tas",
    "pressure_to_altitude",
    "altitude_to_pressure",
    "compute_density_altitude",
    "compute_mach_number",
]
