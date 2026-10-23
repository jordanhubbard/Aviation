from __future__ import annotations

from dataclasses import dataclass
from math import exp

from .architecture import AtmosphereState, Vector3

GAS_CONSTANT_AIR = 287.05
GRAVITY_MPS2 = 9.80665
DEFAULT_TROPOPAUSE_M = 11000.0
DEFAULT_LAPSE_RATE = -0.0065


@dataclass(frozen=True)
class IsaAtmosphereConfig:
    sea_level_temperature_c: float = 15.0
    sea_level_pressure_pa: float = 101_325.0
    lapse_rate_k_per_m: float = DEFAULT_LAPSE_RATE
    tropopause_altitude_m: float = DEFAULT_TROPOPAUSE_M

    def __post_init__(self) -> None:
        if self.sea_level_pressure_pa <= 0:
            raise ValueError("sea_level_pressure_pa must be positive.")
        if self.tropopause_altitude_m <= 0:
            raise ValueError("tropopause_altitude_m must be positive.")
        if self.lapse_rate_k_per_m == 0:
            raise ValueError("lapse_rate_k_per_m must be non-zero.")


class IsaAtmosphereModel:
    def __init__(self, config: IsaAtmosphereConfig | None = None) -> None:
        self.config = config or IsaAtmosphereConfig()

    def compute_state(
        self,
        altitude_m: float,
        wind_velocity_mps: Vector3 | None = None,
    ) -> AtmosphereState:
        temperature_k, pressure_pa = _compute_isa_temperature_pressure(
            altitude_m,
            self.config,
        )
        density = pressure_pa / (GAS_CONSTANT_AIR * temperature_k)
        wind = wind_velocity_mps or Vector3(0.0, 0.0, 0.0)
        return AtmosphereState(
            density_kg_m3=density,
            pressure_pa=pressure_pa,
            temperature_c=temperature_k - 273.15,
            wind_velocity_mps=wind,
        )

    def density_altitude_m(self, density_kg_m3: float) -> float:
        if density_kg_m3 <= 0:
            raise ValueError("density_kg_m3 must be positive.")
        lower = -1000.0
        upper = 20000.0
        for _ in range(32):
            mid = (lower + upper) * 0.5
            temp_k, pressure = _compute_isa_temperature_pressure(mid, self.config)
            mid_density = pressure / (GAS_CONSTANT_AIR * temp_k)
            if mid_density > density_kg_m3:
                lower = mid
            else:
                upper = mid
        return (lower + upper) * 0.5


def _compute_isa_temperature_pressure(
    altitude_m: float,
    config: IsaAtmosphereConfig,
) -> tuple[float, float]:
    sea_level_temp_k = config.sea_level_temperature_c + 273.15
    sea_level_pressure = config.sea_level_pressure_pa
    lapse_rate = config.lapse_rate_k_per_m
    tropopause_altitude = config.tropopause_altitude_m

    if altitude_m <= tropopause_altitude:
        temperature_k = sea_level_temp_k + lapse_rate * altitude_m
        exponent = -GRAVITY_MPS2 / (lapse_rate * GAS_CONSTANT_AIR)
        pressure_pa = sea_level_pressure * (temperature_k / sea_level_temp_k) ** exponent
        return temperature_k, pressure_pa

    tropopause_temp_k = sea_level_temp_k + lapse_rate * tropopause_altitude
    exponent = -GRAVITY_MPS2 / (lapse_rate * GAS_CONSTANT_AIR)
    pressure_tropopause = sea_level_pressure * (
        tropopause_temp_k / sea_level_temp_k
    ) ** exponent
    delta_altitude = altitude_m - tropopause_altitude
    pressure_pa = pressure_tropopause * exp(
        -GRAVITY_MPS2 * delta_altitude / (GAS_CONSTANT_AIR * tropopause_temp_k)
    )
    return tropopause_temp_k, pressure_pa
