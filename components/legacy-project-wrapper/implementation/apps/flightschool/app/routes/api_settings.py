"""
API settings routes for the FlightSchool backend.

Provides GET /api/settings and POST /api/settings/secrets endpoints
that power the ConfigPanel React component.

Note: The existing settings_bp (app/routes/settings.py) handles the
/settings/* web UI routes. This module provides the separate /api/settings*
JSON API endpoints for the ConfigPanel component.
"""

from __future__ import annotations

import subprocess
from typing import Any, Optional

from flask import Blueprint, jsonify, request

api_settings_bp = Blueprint("api_settings", __name__)

APP_ID = "flightschool"

# ---------------------------------------------------------------------------
# Service registry — minimal inline definition for this app.
# When packages/aviation-config is available, replace this block with:
#   from aviation_config import AviationConfig, SERVICE_REGISTRY
#   _config = AviationConfig(APP_ID)
# ---------------------------------------------------------------------------

_SERVICE_DEFINITIONS: list[dict[str, Any]] = [
    {
        "id": "google-oauth",
        "name": "Google OAuth",
        "category": "auth",
        "fields": [
            {"key": "GOOGLE_CLIENT_ID"},
            {"key": "GOOGLE_CLIENT_SECRET"},
        ],
    },
    {
        "id": "smtp",
        "name": "SMTP / Email",
        "category": "email",
        "fields": [
            {"key": "MAIL_SERVER"},
            {"key": "MAIL_USERNAME"},
            {"key": "MAIL_PASSWORD"},
        ],
    },
    {
        "id": "database",
        "name": "Database",
        "category": "infrastructure",
        "fields": [{"key": "DATABASE_URL"}],
    },
    {
        "id": "sentry",
        "name": "Sentry",
        "category": "monitoring",
        "fields": [{"key": "SENTRY_DSN"}],
    },
]


def _packages_root():
    """Locate the monorepo packages root."""
    from pathlib import Path
    for parent in Path(__file__).resolve().parents:
        candidate = parent / "packages"
        if candidate.exists():
            return candidate
    return Path("/packages")


def _load_secrets_module():
    """Lazily import the secrets module to avoid circular imports."""
    try:
        from app_secrets import _secrets as s, KEYSTORE_AVAILABLE as ka
        return s, ka
    except Exception:
        return None, False


def _is_configured(key: str) -> bool:
    """Return True if the secret key has a non-empty value."""
    s, ka = _load_secrets_module()
    if ka and s is not None:
        try:
            value = s.get(key)
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
# Endpoints
# ---------------------------------------------------------------------------


@api_settings_bp.route("/api/settings", methods=["GET"])
def get_settings():
    """Return configuration status for all services used by this app."""
    return jsonify(
        {
            "app_id": APP_ID,
            "services": _build_services_response(),
        }
    )


@api_settings_bp.route("/api/settings/secrets", methods=["POST"])
def save_secret():
    """Store a secret value in the keystore. Never returns the secret value."""
    data = request.get_json(silent=True) or {}

    service = data.get("service", "").strip()
    key = data.get("key", "").strip()
    value = data.get("value", "")

    if not service:
        return jsonify({"success": False, "error": "Missing 'service' field"}), 400
    if not key:
        return jsonify({"success": False, "error": "Missing 'key' field"}), 400
    if not value or not value.strip():
        return jsonify({"success": False, "error": "Secret value must not be empty"}), 400

    # Validate that the requested service/key is known for this app.
    known_service_ids = {svc["id"] for svc in _SERVICE_DEFINITIONS}
    if service not in known_service_ids:
        return jsonify({"success": False, "error": f"Unknown service: {service}"}), 400

    svc_def = next(s for s in _SERVICE_DEFINITIONS if s["id"] == service)
    known_keys = {f["key"] for f in svc_def["fields"]}
    if key not in known_keys:
        return jsonify(
            {
                "success": False,
                "error": f"Unknown key '{key}' for service '{service}'",
            }
        ), 400

    # Store via keystore CLI.
    keystore_root = _packages_root().parent
    try:
        result = subprocess.run(
            ["npm", "run", "keystore", "set", APP_ID, key, value],
            cwd=str(keystore_root),
            capture_output=True,
            text=True,
            check=False,
            timeout=15,
        )
        if result.returncode != 0:
            error_detail = (result.stderr or result.stdout or "keystore CLI error").strip()
            return jsonify({"success": False, "error": error_detail})
    except subprocess.TimeoutExpired:
        return jsonify({"success": False, "error": "Keystore operation timed out"})
    except Exception as exc:
        return jsonify({"success": False, "error": str(exc)})

    # Invalidate the in-process cache so subsequent reads reflect the new value.
    s, ka = _load_secrets_module()
    if ka and s is not None:
        try:
            s.clear_cache()
        except Exception:
            pass

    return jsonify({"success": True, "service": service, "key": key})
