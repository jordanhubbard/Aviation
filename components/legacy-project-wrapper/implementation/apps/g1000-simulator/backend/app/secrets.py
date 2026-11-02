"""G1000's legacy key names adapt to the common configuration provider."""
from __future__ import annotations

from typing import Optional
from app.utils.paths import add_package_path

add_package_path("aviation-config/python")
from aviation_config import AviationConfig, get_services_by_app
from keystore import create_secret_loader

APP_ID = "g1000-simulator"


def get_secret(key: str, default: Optional[str] = None, required: bool = False) -> Optional[str]:
    config = AviationConfig(APP_ID)
    field = next(((service.id, field.key) for service in get_services_by_app(APP_ID)
                  for field in service.fields if field.env_var == key), None)
    if field is not None:
        value = config.get(*field)
    elif config.isolated_run is None:
        # Retain app-specific historical aliases without an isolated fallback.
        value = create_secret_loader(APP_ID).get(key)
    else:
        value = None
    if required and value is None:
        raise ValueError(f"Required secret not found: {key}")
    return value if value is not None else default


def get_stream_api_key() -> Optional[str]:
    return get_secret("G1000_STREAM_API_KEY") or get_secret("G1000_SIMULATOR_API_KEY")
