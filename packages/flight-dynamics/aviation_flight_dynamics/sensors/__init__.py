"""Sensor simulation modules for flight dynamics.

This package provides simulated sensor outputs including:
- AHRS (Attitude and Heading Reference System)
- ADC (Air Data Computer)
"""

from .ahrs import (
    AHRSConfig,
    AHRSOutput,
    AHRSSimulator,
    CoordinateFrame,
    EulerAngles,
    MagneticModel,
    SlipSkidIndicator,
    body_to_ned,
    ecef_to_ned,
    ned_to_body,
    ned_to_ecef,
)
from .adc import (
    ADCConfig,
    ADCOutput,
    ADCSimulator,
    AirspeedType,
    AltitudeType,
    cas_to_tas,
    ias_to_cas,
    ias_to_tas,
    pressure_to_altitude,
    altitude_to_pressure,
)

__all__ = [
    # AHRS
    "AHRSConfig",
    "AHRSOutput",
    "AHRSSimulator",
    "CoordinateFrame",
    "EulerAngles",
    "MagneticModel",
    "SlipSkidIndicator",
    "body_to_ned",
    "ecef_to_ned",
    "ned_to_body",
    "ned_to_ecef",
    # ADC
    "ADCConfig",
    "ADCOutput",
    "ADCSimulator",
    "AirspeedType",
    "AltitudeType",
    "cas_to_tas",
    "ias_to_cas",
    "ias_to_tas",
    "pressure_to_altitude",
    "altitude_to_pressure",
]
