"""Compatibility exports for the shared portable transponder model."""

from aviation_avionics import (
    IDENT_DURATION_SEC,
    TRANSPONDER_MODES,
    TransponderState,
    normalize_squawk,
)


__all__ = [
    "IDENT_DURATION_SEC",
    "TRANSPONDER_MODES",
    "TransponderState",
    "normalize_squawk",
]
