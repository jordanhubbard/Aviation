"""Portable turn physics and deterministic synthetic engine instrumentation."""

from __future__ import annotations

from dataclasses import asdict, dataclass
import math

STANDARD_GRAVITY_MPS2 = 9.80665
_MIN_CYLINDERS = 1
_MAX_CYLINDERS = 12


def _finite(name: str, value: float) -> float:
    result = float(value)
    if not math.isfinite(result):
        raise ValueError(f"{name} must be finite")
    return result


def _clamp(value: float, minimum: float, maximum: float) -> float:
    return max(minimum, min(maximum, value))


def _round_half_up(value: float) -> int:
    return math.floor(value + 0.5)


def coordinated_turn_bank_deg(speed_mps: float, turn_rate_dps: float) -> float:
    """Return the non-negative bank magnitude implied by a coordinated turn."""
    speed = _finite("speed_mps", speed_mps)
    turn_rate = _finite("turn_rate_dps", turn_rate_dps)
    if speed < 0:
        raise ValueError("speed_mps must be non-negative")
    return math.degrees(
        math.atan(speed * math.radians(abs(turn_rate)) / STANDARD_GRAVITY_MPS2)
    )


@dataclass(frozen=True)
class PistonEngineInstrumentProjection:
    rpm: int
    oil_temp_f: int
    oil_pressure_psi: int
    fuel_flow_gph: float
    bus_volts: float
    alternator_load_amps: int
    manifold_pressure_inhg: float
    battery_temp_f: int
    egt_f: tuple[int, ...]
    cht_f: tuple[int, ...]

    def to_dict(self) -> dict[str, object]:
        value = asdict(self)
        value["egt_f"] = list(self.egt_f)
        value["cht_f"] = list(self.cht_f)
        return value


def project_piston_engine_instruments(
    airspeed_kt: float, cylinder_count: int = 6
) -> PistonEngineInstrumentProjection:
    """Project deterministic synthetic piston-engine telemetry from airspeed."""
    airspeed = _finite("airspeed_kt", airspeed_kt)
    if airspeed < 0:
        raise ValueError("airspeed_kt must be non-negative")
    if (
        isinstance(cylinder_count, bool)
        or not isinstance(cylinder_count, int)
        or not _MIN_CYLINDERS <= cylinder_count <= _MAX_CYLINDERS
    ):
        raise ValueError("cylinder_count must be an integer from 1 through 12")

    egt_base = _clamp(1280.0 + airspeed * 1.6, 1150.0, 1550.0)
    cht_base = _clamp(330.0 + airspeed * 0.45, 300.0, 430.0)
    midpoint = (cylinder_count - 1) / 2.0
    egt = tuple(
        _round_half_up(
            egt_base
            + (index - midpoint) * 12.0
            + math.sin(index + airspeed / 40.0) * 8.0
        )
        for index in range(cylinder_count)
    )
    cht = tuple(
        _round_half_up(
            cht_base
            + (index - midpoint) * 6.0
            + math.cos(index + airspeed / 50.0) * 5.0
        )
        for index in range(cylinder_count)
    )
    return PistonEngineInstrumentProjection(
        rpm=_round_half_up(_clamp(1900.0 + airspeed * 6.0, 1800.0, 2700.0)),
        oil_temp_f=_round_half_up(_clamp(175.0 + airspeed * 0.35, 150.0, 245.0)),
        oil_pressure_psi=_round_half_up(_clamp(50.0 + airspeed * 0.12, 40.0, 85.0)),
        fuel_flow_gph=_clamp(7.0 + airspeed * 0.03, 6.0, 14.0),
        bus_volts=_clamp(27.5 + airspeed * 0.01, 27.5, 28.4),
        alternator_load_amps=_round_half_up(_clamp(20.0 + airspeed * 0.08, 18.0, 32.0)),
        manifold_pressure_inhg=_clamp(18.0 + airspeed * 0.02, 18.0, 29.0),
        battery_temp_f=_round_half_up(_clamp(80.0 + airspeed * 0.1, 70.0, 120.0)),
        egt_f=egt,
        cht_f=cht,
    )
