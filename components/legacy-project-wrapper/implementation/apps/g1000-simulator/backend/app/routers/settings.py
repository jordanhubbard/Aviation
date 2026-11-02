"""G1000 settings use the common catalog, authenticated HTTP adapter and provider."""
from __future__ import annotations

import os

from app.utils.paths import add_package_path

add_package_path("aviation-config/python")

from aviation_config import AviationConfig
from aviation_config.http import create_settings_router


def build_settings_router():
    config = AviationConfig("g1000-simulator", legacy_aliases={
        ("openweather", "api_key"): ("OPENWEATHER_API_KEY",),
    })
    encryption_key = os.environ.get("KEYSTORE_ENCRYPTION_KEY", "")
    return create_settings_router(
        config, write_token=os.environ.get("AVIATION_SETTINGS_TOKEN"),
        encryption_ready=len(encryption_key) >= 32,
        e2e_secret=os.environ.get("AVIATION_E2E_SECRET"),
    )
