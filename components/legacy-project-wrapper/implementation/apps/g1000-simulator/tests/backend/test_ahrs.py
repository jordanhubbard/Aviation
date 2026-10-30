"""Compatibility checks for the G1000 adapter to the common AHRS model."""
from __future__ import annotations

import os
import sys

import pytest

_BACKEND_DIR = os.path.join(os.path.dirname(__file__), "..", "..", "backend")
if _BACKEND_DIR not in sys.path:
    sys.path.insert(0, _BACKEND_DIR)

from app.services.ahrs import AhrsSolution, compute_ahrs


def test_adapter_returns_common_solution_with_telemetry_schema() -> None:
    solution = compute_ahrs(
        heading_deg=370.0,
        pitch_deg=4.0,
        roll_deg=20.0,
        turn_rate_dps=3.0,
        airspeed_kt=100.0,
        latitude_deg=37.6,
        longitude_deg=-122.4,
    )

    assert isinstance(solution, AhrsSolution)
    assert solution.heading_deg == pytest.approx(22.24)
    assert solution.true_heading_deg == 10.0
    assert solution.to_dict()["heading_deg"] == solution.magnetic_heading_deg


def test_adapter_uses_common_input_validation() -> None:
    with pytest.raises(ValueError, match="longitude_deg out of range"):
        compute_ahrs(
            heading_deg=0.0,
            pitch_deg=0.0,
            roll_deg=0.0,
            turn_rate_dps=0.0,
            airspeed_kt=90.0,
            latitude_deg=0.0,
            longitude_deg=181.0,
        )
