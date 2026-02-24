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
    VerticalSpeedController,
)
from .modes import (
    AutopilotMode,
    LateralMode,
    VerticalMode,
    AutopilotState,
    AutopilotModeManager,
)
from .envelope import (
    EnvelopeProtection,
    EnvelopeLimits,
    ProtectionStatus,
)
from .autotrim import AutotrimController
from .autopilot import Autopilot, AutopilotConfig, AutopilotOutput

__all__ = [
    # PID
    "PIDController",
    "PIDGains",
    # Controllers
    "PitchController",
    "RollController",
    "AltitudeHoldController",
    "HeadingHoldController",
    "VerticalSpeedController",
    # Modes
    "AutopilotMode",
    "LateralMode",
    "VerticalMode",
    "AutopilotState",
    "AutopilotModeManager",
    # Envelope Protection
    "EnvelopeProtection",
    "EnvelopeLimits",
    "ProtectionStatus",
    # Autotrim
    "AutotrimController",
    # Main Autopilot
    "Autopilot",
    "AutopilotConfig",
    "AutopilotOutput",
]
