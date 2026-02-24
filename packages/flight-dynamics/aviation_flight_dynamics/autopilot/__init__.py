"""Autopilot module for flight dynamics simulation.

This module provides:
- PID controllers for pitch, roll, altitude, and heading
- Mode logic as explicit state machines
- Autotrim simulation
- Envelope protection (pitch/bank limits, overspeed/stall protection)
"""

from .controllers import (
    PIDController,
    PIDGains,
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
from .autotrim import (
    AutotrimController,
    TrimState,
    TrimAxis,
)
from .envelope_protection import (
    EnvelopeProtection,
    EnvelopeLimits,
    ProtectionStatus,
    ProtectionType,
)
from .autopilot import (
    Autopilot,
    AutopilotConfig,
    AutopilotOutput,
)

__all__ = [
    # Controllers
    "PIDController",
    "PIDGains",
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
    # Autotrim
    "AutotrimController",
    "TrimState",
    "TrimAxis",
    # Envelope Protection
    "EnvelopeProtection",
    "EnvelopeLimits",
    "ProtectionStatus",
    "ProtectionType",
    # Main Autopilot
    "Autopilot",
    "AutopilotConfig",
    "AutopilotOutput",
]
