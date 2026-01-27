from __future__ import annotations

from dataclasses import dataclass

from .architecture import AtmosphereState
from .atmosphere import IsaAtmosphereConfig, IsaAtmosphereModel
from .wind import WindComponents, WindModel, WindModelConfig


@dataclass(frozen=True)
class EnvironmentSnapshot:
    atmosphere: AtmosphereState
    wind: WindComponents


class EnvironmentModel:
    def __init__(
        self,
        atmosphere: IsaAtmosphereModel | None = None,
        wind: WindModel | None = None,
    ) -> None:
        self._atmosphere = atmosphere or IsaAtmosphereModel()
        self._wind = wind or WindModel()

    def atmosphere_state(self, altitude_m: float, time_s: float) -> AtmosphereState:
        wind_components = self._wind.wind_components(time_s)
        return self._atmosphere.compute_state(
            altitude_m,
            wind_velocity_mps=wind_components.total,
        )

    def snapshot(self, altitude_m: float, time_s: float) -> EnvironmentSnapshot:
        wind_components = self._wind.wind_components(time_s)
        atmosphere_state = self._atmosphere.compute_state(
            altitude_m,
            wind_velocity_mps=wind_components.total,
        )
        return EnvironmentSnapshot(atmosphere=atmosphere_state, wind=wind_components)

    def update_atmosphere_config(self, config: IsaAtmosphereConfig) -> None:
        self._atmosphere = IsaAtmosphereModel(config)

    def update_wind_config(self, config: WindModelConfig) -> None:
        self._wind = WindModel(config)
