from __future__ import annotations

import os
import json
import time
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

from .registry import SERVICE_REGISTRY, Service, build_service_status, get_services_by_app


class AviationConfig:
    """Unified config loader for Aviation suite apps.

    Replaces per-app secrets.py / config.py patterns.
    Uses the keystore first, then falls back to environment variables.

    Usage::

        config = AviationConfig("weather-briefing")
        api_key = config.get("openweather", "api_key")
        dsn = config.get_required("sentry", "dsn")
    """

    def __init__(self, app_id: str, *, keystore_path: Optional[str] = None,
                 bridge_path: Optional[str] = None, fallback_to_env: bool = True,
                 legacy_aliases: dict[tuple[str, str], tuple[str, ...]] | None = None) -> None:
        self.app_id = app_id
        self.isolated_run = os.environ.get("AVIATION_E2E_RUN_ID")
        selected_path = keystore_path or os.environ.get("KEYSTORE_PATH")
        if self.isolated_run is not None:
            from aviation.e2e import parse_e2e_run_id
            self.isolated_run = parse_e2e_run_id(self.isolated_run)
            if not selected_path or Path(selected_path).resolve().parent.name != self.isolated_run:
                raise ValueError("Isolated settings require an explicit run-owned store")
        self.fallback_to_env = fallback_to_env and self.isolated_run is None
        self._loaders: dict[str, object] = {}
        self._options = {"keystore_path": selected_path, "bridge_path": bridge_path,
                         "fallback_to_env": False}
        self._run_record_loader = None
        self._legacy_loader = None
        self._legacy_aliases = dict(legacy_aliases or {})

        if _KEYSTORE_AVAILABLE:
            # Create one loader per service that is in scope for this app.
            for service in get_services_by_app(app_id):
                try:
                    self._loaders[service.id] = create_secret_loader(service.id, **self._options)
                except Exception:
                    raise RuntimeError("Could not initialize the settings provider") from None
            if self.isolated_run is None:
                self._legacy_loader = create_secret_loader(app_id, **self._options)
            else:
                self._run_record_loader = create_secret_loader("e2e_runs", **self._options)

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

    def _raw_get(self, service_id: str, key: str, *, refresh: bool = False) -> Optional[str]:
        """Try keystore first, then fall back to the registered env var."""
        loader = self._loaders.get(service_id)
        if loader is not None:
            try:
                value = loader.get(key, use_cache=not (refresh or self.isolated_run is not None))  # type: ignore[attr-defined]
                if value is not None:
                    return value
            except Exception:
                pass

        env_var = self._env_var_for(service_id, key)
        aliases = ((env_var,) if env_var else ()) + self._legacy_aliases.get((service_id, key), ())
        if self._legacy_loader is not None:
            for alias in aliases:
                value = self._legacy_loader.get(alias, use_cache=not refresh)
                if value is not None:
                    return value
        if not self.fallback_to_env:
            return None
        for alias in aliases or (key,):
            value = os.environ.get(alias)
            if value is not None:
                return value
        return None

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    @property
    def writes_available(self) -> bool:
        """Writes require the compiled provider, never the legacy npm reader."""
        return bool(self._loaders) and all(
            getattr(loader, "bridge_path", None) is not None
            and loader.bridge_path.is_file() for loader in self._loaders.values()
        )

    def _field_loader(self, service_id: str, key: str):
        service = next((s for s in get_services_by_app(self.app_id) if s.id == service_id), None)
        if service is None or not any(f.key == key for f in service.fields):
            raise ValueError("Unknown settings field")
        loader = self._loaders.get(service_id)
        if loader is None or not self.writes_available:
            raise RuntimeError("Settings provider is unavailable")
        return loader

    def set(self, service_id: str, key: str, value: str) -> None:
        """Persist a canonical app-scoped field before updating any cached view."""
        if not isinstance(value, str) or not value.strip() or len(value.encode("utf-8")) > 16384:
            raise ValueError("Invalid settings value")
        loader = self._field_loader(service_id, key)
        if self.isolated_run is not None:
            self.initialize_test_run()
        loader.set(key, value)

    def delete(self, service_id: str, key: str) -> bool:
        """Delete a canonical field through the same fail-closed provider."""
        return self._field_loader(service_id, key).delete(key)

    def _checked_test_state(self, *, check_expiry: bool = False):
        from aviation.e2e import assert_test_record_for_run, MAX_AGE_MS
        if self.isolated_run is None or self._run_record_loader is None:
            raise RuntimeError("No isolated settings run")
        entries = self._run_record_loader.entries()
        known = {(s.id, f.key) for s in get_services_by_app(self.app_id) for f in s.fields}
        for entry in entries:
            assert_test_record_for_run(entry, self.isolated_run)
            if (entry.get("service"), entry.get("key")) not in known | {("e2e_runs", self.isolated_run)}:
                raise RuntimeError("Unrecognized isolated settings entry")
        metadata = None
        if any(e["service"] == "e2e_runs" for e in entries):
            try:
                metadata = json.loads(self._run_record_loader.get(self.isolated_run, use_cache=False))
                assert_test_record_for_run(metadata, self.isolated_run)
                created, expires = metadata["created_at_ms"], metadata["expires_at_ms"]
                if (metadata.get("schema") != "aviation/settings-test-run@1"
                    or metadata.get("app_id") != self.app_id
                    or type(created) is not int or type(expires) is not int
                    or not 0 < expires - created <= MAX_AGE_MS):
                    raise ValueError()
                if check_expiry and expires <= int(time.time() * 1000):
                    raise ValueError()
            except (ValueError, TypeError, KeyError):
                raise RuntimeError("Invalid or expired isolated settings run") from None
        elif entries:
            raise RuntimeError("Missing isolated settings run metadata")
        return entries, metadata

    def initialize_test_run(self) -> dict:
        """Persist an SDK-tagged run record before any isolated field write."""
        from aviation.e2e import tag_test_record, MAX_AGE_MS
        _, metadata = self._checked_test_state(check_expiry=True)
        if metadata is None:
            now = int(time.time() * 1000)
            metadata = tag_test_record(self.isolated_run, {
                "schema": "aviation/settings-test-run@1", "app_id": self.app_id,
                "created_at_ms": now, "expires_at_ms": now + MAX_AGE_MS,
            })
            self._run_record_loader.set(self.isolated_run, json.dumps(metadata))
        return metadata

    def test_run_state(self) -> dict:
        """Redacted residual counts; never expose stored configuration values."""
        from aviation.e2e import tag_test_record
        entries, metadata = self._checked_test_state()
        return tag_test_record(self.isolated_run, {
            "app_id": self.app_id, "run_id": self.isolated_run, "count": len(entries),
            "run_records": int(metadata is not None),
            "records": len([e for e in entries if e["service"] != "e2e_runs"]),
            "entries": entries,
        })

    def cleanup_test_run(self) -> dict:
        """Validate every entry and app/run owner before deleting any test data."""
        entries, _ = self._checked_test_state()
        for entry in entries:
            if entry["service"] != "e2e_runs":
                self.delete(entry["service"], entry["key"])
        self._run_record_loader.delete(self.isolated_run)
        return self.test_run_state()

    def get(self, service_id: str, key: str, default: Optional[str] = None) -> Optional[str]:
        """Get a config value. Returns *default* if not found."""
        if self.isolated_run is not None:
            self._checked_test_state(check_expiry=True)
        value = self._raw_get(service_id, key)
        return value if value is not None else default

    def get_required(self, service_id: str, key: str) -> str:
        """Get a config value or raise ValueError if missing."""
        value = self.get(service_id, key)
        if not value or not value.strip():
            env_var = self._env_var_for(service_id, key) or key
            raise ValueError(
                f"Required config not found: {service_id}/{key}. "
                f"Set the {env_var} environment variable or configure it in the keystore."
            )
        return value

    def is_configured(self, service_id: str, key: str) -> bool:
        """Check if a key is configured (non-empty value exists)."""
        value = self.get(service_id, key)
        return bool(value and value.strip())

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
        if self.isolated_run is not None:
            self._checked_test_state(check_expiry=True)
        result = []
        for service in get_services_by_app(self.app_id):
            result.append(
                build_service_status(
                    service,
                    [
                        field.key
                        for field in service.fields
                        if (self._raw_get(service.id, field.key, refresh=True) or "").strip()
                    ],
                )
            )
        return result
