from __future__ import annotations

from pathlib import Path
from typing import List, Optional

from pydantic import AliasChoices, Field
from pydantic_settings import BaseSettings, SettingsConfigDict


REPO_ROOT = Path(__file__).resolve().parents[2]


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=str(REPO_ROOT / ".env"),
        case_sensitive=False,
        extra="ignore",
    )

    app_name: str = Field("flightplanner", description="Application name")
    app_version: str = Field("0.1.0", description="Application version")
    debug: bool = Field(True, description="Debug mode")

    api_prefix: str = Field("/api", description="API prefix")

    cors_origins: List[str] = Field(["*"], description="Allowed CORS origins")
    cors_methods: List[str] = Field(["*"], description="Allowed CORS methods")
    cors_headers: List[str] = Field(["*"], description="Allowed CORS headers")

    openweather_api_key: Optional[str] = Field(
        None,
        description="OpenWeatherMap API key",
        validation_alias=AliasChoices("OPENWEATHERMAP_API_KEY", "OPENWEATHER_API_KEY"),
    )
    opentopography_api_key: Optional[str] = Field(
        None,
        description="OpenTopography API key (for terrain/elevation requests)",
        validation_alias=AliasChoices("OPENTOPOGRAPHY_API_KEY"),
    )
    openaip_api_key: Optional[str] = Field(None, description="OpenAIP API key")

    data_dir: str = Field(str(REPO_ROOT / "backend" / "data"), description="Data directory")
    airport_cache_file: str = Field(
        str(REPO_ROOT / "backend" / "data" / "airports_cache.json"),
        description="Airport cache file path",
    )


settings = Settings()
