from __future__ import annotations

from dataclasses import dataclass


def _require_positive(name: str, value: float) -> None:
    if value <= 0:
        raise ValueError(f"{name} must be positive (got {value}).")


def _require_non_negative(name: str, value: float) -> None:
    if value < 0:
        raise ValueError(f"{name} must be non-negative (got {value}).")


@dataclass(frozen=True)
class CGLimits:
    forward_in: float
    aft_in: float

    def __post_init__(self) -> None:
        if self.forward_in >= self.aft_in:
            raise ValueError(
                f"cg_limits_in forward ({self.forward_in}) must be less than aft ({self.aft_in})."
            )


@dataclass(frozen=True)
class InertiaTensor:
    ix_slug_ft2: float
    iy_slug_ft2: float
    iz_slug_ft2: float
    ixz_slug_ft2: float = 0.0

    def __post_init__(self) -> None:
        _require_positive("ix_slug_ft2", self.ix_slug_ft2)
        _require_positive("iy_slug_ft2", self.iy_slug_ft2)
        _require_positive("iz_slug_ft2", self.iz_slug_ft2)


@dataclass(frozen=True)
class MassProperties:
    empty_weight_lbs: float
    max_gross_weight_lbs: float
    reference_cg_in: float
    cg_limits_in: CGLimits
    inertia: InertiaTensor
    max_payload_lbs: float | None = None

    def __post_init__(self) -> None:
        _require_positive("empty_weight_lbs", self.empty_weight_lbs)
        _require_positive("max_gross_weight_lbs", self.max_gross_weight_lbs)
        if self.empty_weight_lbs >= self.max_gross_weight_lbs:
            raise ValueError(
                "empty_weight_lbs must be less than max_gross_weight_lbs "
                f"({self.empty_weight_lbs} >= {self.max_gross_weight_lbs})."
            )
        if not (self.cg_limits_in.forward_in <= self.reference_cg_in <= self.cg_limits_in.aft_in):
            raise ValueError(
                "reference_cg_in must fall within cg_limits_in "
                f"({self.cg_limits_in.forward_in} to {self.cg_limits_in.aft_in})."
            )
        if self.max_payload_lbs is not None:
            _require_non_negative("max_payload_lbs", self.max_payload_lbs)
