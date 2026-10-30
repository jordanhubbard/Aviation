"""Compatibility surface for the common aviation.avionics AHRS model."""

from aviation_avionics.ahrs import (
    AhrsSolution,
    compute_ahrs,
    estimate_magnetic_variation,
    normalize_heading,
)

__all__ = [
    "AhrsSolution",
    "compute_ahrs",
    "estimate_magnetic_variation",
    "normalize_heading",
]
