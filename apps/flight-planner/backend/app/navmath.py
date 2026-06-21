"""Pure-Python navigation / aviation math helpers for the flight planner.

Stdlib-only (no app dependencies), so each helper is unit-testable in isolation.
New helpers register here; this module plus tests/test_navmath.py are the
integration points that independently authored helpers converge on.
"""

from __future__ import annotations

import math  # noqa: F401  (used by helpers appended below)


def normalize_heading(deg: float) -> float:
    """Wrap a compass heading into the half-open range [0, 360) degrees."""
    return float(deg) % 360.0
