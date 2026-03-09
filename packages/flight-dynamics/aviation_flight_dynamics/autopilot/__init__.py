"""Autopilot controller module for flight dynamics simulation.

This module provides:
- PID controllers for pitch, roll, altitude, and heading
- Mode logic as explicit state machines
- Autotrim simulation
- Envelope protection (pitch/bank limits, overspeed/stall protection)
"""

from .pid import PIDController, PIDGains
from .controllers import (
    PitchController,
    RollController,
    AltitudeHoldController,
    HeadingHoldController,
)
from .modes import (
    AutopilotMode,
    AutopilotState,
    LateralMode,
    VerticalMode,
    AutopilotModeController,
)
from .envelope import (
    EnvelopeProtection,
    EnvelopeLimits,
    ProtectionStatus,
)
from .autotrim import AutotrimController, TrimState

__all__ = [
    # PID
    "PIDController",
    "PIDGains",
    # Controllers
    "PitchController",
    "RollController",
    "AltitudeHoldController",
    "HeadingHoldController",
    # Modes
    "AutopilotMode",
    "AutopilotState",
    "LateralMode",
    "VerticalMode",
    "AutopilotModeController",
    # Envelope Protection
    "EnvelopeProtection",
    "EnvelopeLimits",
    "ProtectionStatus",
    # Autotrim
    "AutotrimController",
    "TrimState",
]
