from __future__ import annotations

from pathlib import Path
from typing import List

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


REPO_ROOT = Path(__file__).resolve().parents[2]


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=str(REPO_ROOT / ".env"),
        case_sensitive=False,
        extra="ignore",
    )

    app_name: str = Field("g1000-simulator", description="Application name")
    app_version: str = Field("0.1.0", description="Application version")
    debug: bool = Field(True, description="Debug mode")

    api_prefix: str = Field("/api", description="API prefix")

    cors_origins: List[str] = Field(["*"], description="Allowed CORS origins")
    cors_methods: List[str] = Field(["*"], description="Allowed CORS methods")
    cors_headers: List[str] = Field(["*"], description="Allowed CORS headers")


settings = Settings()
