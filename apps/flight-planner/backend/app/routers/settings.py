"""
Settings API router for the Flight Planner backend.

Provides GET /api/settings and POST /api/settings/secrets endpoints
that power the ConfigPanel React component.
"""

from __future__ import annotations

import subprocess
from typing import Any, Optional

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from app.utils.paths import resolve_packages_root
from app.secrets import _secrets, KEYSTORE_AVAILABLE

router = APIRouter()

APP_ID = "flight-planner"

# ---------------------------------------------------------------------------
# Service registry — minimal inline definition for this app.
# When packages/aviation-config is available, replace this block with:
#   from aviation_config import AviationConfig, SERVICE_REGISTRY
#   _config = AviationConfig(APP_ID)
# ---------------------------------------------------------------------------

_SERVICE_DEFINITIONS: list[dict[str, Any]] = [
    {
        "id": "openweather",
        "name": "OpenWeatherMap",
        "category": "weather",
        "fields": [{"key": "OPENWEATHER_API_KEY"}],
    },
    {
        "id": "openaip",
        "name": "OpenAIP",
        "category": "aviation",
        "fields": [{"key": "OPENAIP_API_KEY"}],
    },
    {
        "id": "opentopography",
        "name": "OpenTopography",
        "category": "terrain",
        "fields": [{"key": "OPENTOPOGRAPHY_API_KEY"}],
    },
    {
        "id": "sentry",
        "name": "Sentry",
        "category": "monitoring",
        "fields": [{"key": "SENTRY_DSN"}],
    },
    {
        "id": "database",
        "name": "Database",
        "category": "infrastructure",
        "fields": [{"key": "DATABASE_URL"}],
    },
    {
        "id": "redis",
        "name": "Redis",
        "category": "infrastructure",
        "fields": [{"key": "REDIS_URL"}],
    },
]


def _is_configured(key: str) -> bool:
    """Return True if the secret key has a non-empty value."""
    if KEYSTORE_AVAILABLE and _secrets is not None:
        try:
            value = _secrets.get(key)
            return value is not None and value.strip() != ""
        except Exception:
            pass
    import os
    value = os.environ.get(key)
    return value is not None and value.strip() != ""


def _build_services_response() -> list[dict[str, Any]]:
    services = []
    for svc in _SERVICE_DEFINITIONS:
        field_statuses = [
            {"key": f["key"], "configured": _is_configured(f["key"])}
            for f in svc["fields"]
        ]
        all_configured = all(f["configured"] for f in field_statuses)
        services.append(
            {
                "id": svc["id"],
                "name": svc["name"],
                "category": svc["category"],
                "configured": all_configured,
                "fields": field_statuses,
            }
        )
    return services


# ---------------------------------------------------------------------------
# Request / Response models
# ---------------------------------------------------------------------------


class SaveSecretRequest(BaseModel):
    service: str
    key: str
    value: str


class SaveSecretResponse(BaseModel):
    success: bool
    service: Optional[str] = None
    key: Optional[str] = None
    error: Optional[str] = None


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------


@router.get("/api/settings")
def get_settings() -> dict[str, Any]:
    """Return configuration status for all services used by this app."""
    return {
        "app_id": APP_ID,
        "services": _build_services_response(),
    }


@router.post("/api/settings/secrets", response_model=SaveSecretResponse)
def save_secret(body: SaveSecretRequest) -> SaveSecretResponse:
    """Store a secret value in the keystore. Never returns the secret value."""
    # Validate that the requested service/key is known for this app.
    known_service_ids = {svc["id"] for svc in _SERVICE_DEFINITIONS}
    if body.service not in known_service_ids:
        raise HTTPException(status_code=400, detail=f"Unknown service: {body.service}")

    svc_def = next(s for s in _SERVICE_DEFINITIONS if s["id"] == body.service)
    known_keys = {f["key"] for f in svc_def["fields"]}
    if body.key not in known_keys:
        raise HTTPException(
            status_code=400,
            detail=f"Unknown key '{body.key}' for service '{body.service}'",
        )

    if not body.value or body.value.strip() == "":
        raise HTTPException(status_code=400, detail="Secret value must not be empty")

    # Store via keystore CLI.
    keystore_root = resolve_packages_root().parent
    try:
        result = subprocess.run(
            ["npm", "run", "keystore", "set", APP_ID, body.key, body.value],
            cwd=str(keystore_root),
            capture_output=True,
            text=True,
            check=False,
            timeout=15,
        )
        if result.returncode != 0:
            error_detail = (result.stderr or result.stdout or "keystore CLI error").strip()
            return SaveSecretResponse(success=False, error=error_detail)
    except subprocess.TimeoutExpired:
        return SaveSecretResponse(success=False, error="Keystore operation timed out")
    except Exception as exc:
        return SaveSecretResponse(success=False, error=str(exc))

    # Invalidate the in-process cache so subsequent reads reflect the new value.
    if KEYSTORE_AVAILABLE and _secrets is not None:
        try:
            _secrets.clear_cache()
        except Exception:
            pass

    return SaveSecretResponse(success=True, service=body.service, key=body.key)
