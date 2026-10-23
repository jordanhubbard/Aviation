from __future__ import annotations

import os
import sys
from pathlib import Path
from typing import Optional


def _resolve_packages_root() -> Path:
    """Walk up from this file until we find a 'packages' directory."""
    for parent in Path(__file__).resolve().parents:
        candidate = parent / "packages"
        if candidate.exists():
            return candidate
    return Path("/packages")


def _add_package_path(relative_path: str) -> Path:
    packages_root = _resolve_packages_root()
    package_path = packages_root / relative_path
    if str(package_path) not in sys.path:
        sys.path.insert(0, str(package_path))
    return package_path


# Add keystore Python package to sys.path so we can import it
_add_package_path("keystore/python")

try:
    from keystore import create_secret_loader  # type: ignore[import]

    _KEYSTORE_AVAILABLE = True
except Exception as _exc:
    print(f"Warning: Keystore not available: {_exc}")
    _KEYSTORE_AVAILABLE = False

from .registry import SERVICE_REGISTRY, Service, get_services_by_app


class AviationConfig:
    """Unified config loader for Aviation suite apps.

    Replaces per-app secrets.py / config.py patterns.
    Uses the keystore first, then falls back to environment variables.

    Usage::

        config = AviationConfig("weather-briefing")
        api_key = config.get("openweather", "api_key")
        dsn = config.get_required("sentry", "dsn")
    """

    def __init__(self, app_id: str) -> None:
        self.app_id = app_id
        self._loaders: dict[str, object] = {}

        if _KEYSTORE_AVAILABLE:
            # Create one loader per service that is in scope for this app.
            for service in get_services_by_app(app_id):
                try:
                    self._loaders[service.id] = create_secret_loader(service.id)
                except Exception as exc:
                    print(f"Warning: Could not create loader for {service.id}: {exc}")

    # ------------------------------------------------------------------
    # Internal helpers
    # ------------------------------------------------------------------

    def _env_var_for(self, service_id: str, key: str) -> Optional[str]:
        """Return the configured envVar name for (service_id, key), or None."""
        from .registry import get_service_by_id

        service = get_service_by_id(service_id)
        if service is None:
            return None
        for field in service.fields:
            if field.key == key:
                return field.env_var
        return None

    def _raw_get(self, service_id: str, key: str) -> Optional[str]:
        """Try keystore first, then fall back to the registered env var."""
        loader = self._loaders.get(service_id)
        if loader is not None:
            try:
                value = loader.get(key)  # type: ignore[attr-defined]
                if value is not None:
                    return value
            except Exception:
                pass

        env_var = self._env_var_for(service_id, key)
        if env_var:
            return os.environ.get(env_var)

        # Last resort: try the raw key name directly as an env var
        return os.environ.get(key)

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    def get(self, service_id: str, key: str, default: Optional[str] = None) -> Optional[str]:
        """Get a config value. Returns *default* if not found."""
        value = self._raw_get(service_id, key)
        return value if value is not None else default

    def get_required(self, service_id: str, key: str) -> str:
        """Get a config value or raise ValueError if missing."""
        value = self._raw_get(service_id, key)
        if not value:
            env_var = self._env_var_for(service_id, key) or key
            raise ValueError(
                f"Required config not found: {service_id}/{key}. "
                f"Set the {env_var} environment variable or configure it in the keystore."
            )
        return value

    def is_configured(self, service_id: str, key: str) -> bool:
        """Check if a key is configured (non-empty value exists)."""
        value = self._raw_get(service_id, key)
        return bool(value)

    def get_service_status(self) -> list[dict]:
        """Return the configuration status for all services relevant to this app.

        Format matches the /api/settings GET endpoint::

            [
                {
                    "id": "openweather",
                    "configured": True,
                    "fields": [
                        {"key": "api_key", "configured": True}
                    ]
                },
                ...
            ]
        """
        result = []
        for service in get_services_by_app(self.app_id):
            field_statuses = [
                {"key": field.key, "configured": self.is_configured(service.id, field.key)}
                for field in service.fields
            ]
            all_required_configured = all(
                fs["configured"]
                for fs, field in zip(field_statuses, service.fields)
                if field.required
            )
            result.append(
                {
                    "id": service.id,
                    "configured": all_required_configured,
                    "fields": field_statuses,
                }
            )
        return result
