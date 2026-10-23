"""Flight envelope protection — limits and violation detection."""
from __future__ import annotations

from dataclasses import dataclass


@dataclass
class EnvelopeLimits:
    """Structural and aerodynamic limits used by envelope protection.

    Speeds are in knots; angles are in degrees.
    """

    max_bank_deg: float = 30.0
    max_pitch_deg: float = 20.0
    min_speed_kt: float = 50.0
    max_speed_kt: float = 200.0

    def __post_init__(self) -> None:
        if self.max_bank_deg <= 0.0:
            raise ValueError("max_bank_deg must be positive.")
        if self.max_pitch_deg <= 0.0:
            raise ValueError("max_pitch_deg must be positive.")
        if self.min_speed_kt < 0.0:
            raise ValueError("min_speed_kt must be non-negative.")
        if self.max_speed_kt <= self.min_speed_kt:
            raise ValueError("max_speed_kt must be greater than min_speed_kt.")


@dataclass(frozen=True)
class ProtectionStatus:
    """Result of an envelope check.

    Each flag is True when the corresponding limit has been exceeded.
    """

    bank_exceeded: bool
    pitch_exceeded: bool
    overspeed: bool
    underspeed: bool

    @property
    def any_exceeded(self) -> bool:
        """Return True if any protection limit has been exceeded."""
        return self.bank_exceeded or self.pitch_exceeded or self.overspeed or self.underspeed


class EnvelopeProtection:
    """Checks aircraft state against configured envelope limits.

    The class does not modify any state; it only reports violations.
    """

    def __init__(self, limits: EnvelopeLimits | None = None) -> None:
        self.limits: EnvelopeLimits = limits if limits is not None else EnvelopeLimits()

    def check(
        self,
        bank_deg: float,
        pitch_deg: float,
        airspeed_kt: float,
    ) -> ProtectionStatus:
        """Evaluate current state against envelope limits.

        Args:
            bank_deg: Current bank (roll) angle in degrees (absolute value used).
            pitch_deg: Current pitch angle in degrees (absolute value used).
            airspeed_kt: Current indicated airspeed in knots.

        Returns:
            ProtectionStatus with a flag for each exceeded limit.
        """
        lim = self.limits
        return ProtectionStatus(
            bank_exceeded=abs(bank_deg) > lim.max_bank_deg,
            pitch_exceeded=abs(pitch_deg) > lim.max_pitch_deg,
            overspeed=airspeed_kt > lim.max_speed_kt,
            underspeed=airspeed_kt < lim.min_speed_kt,
        )
