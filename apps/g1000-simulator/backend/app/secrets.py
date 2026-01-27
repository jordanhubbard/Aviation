"""
Secrets management for the G1000 simulator backend.
"""

from __future__ import annotations

import os
from typing import Optional

from app.utils.paths import add_package_path

add_package_path("keystore/python")

try:
    from keystore import create_secret_loader

    _secrets = create_secret_loader("g1000-simulator")
    KEYSTORE_AVAILABLE = True
except Exception as exc:
    print(f"Warning: Keystore not available: {exc}")
    _secrets = None
    KEYSTORE_AVAILABLE = False


def get_secret(key: str, default: Optional[str] = None, required: bool = False) -> Optional[str]:
    if not KEYSTORE_AVAILABLE:
        value = os.getenv(key, default)
        if required and value is None:
            raise ValueError(f"Required secret not found: {key}")
        return value

    if required:
        return _secrets.get_required(key)
    if default is not None:
        return _secrets.get_with_default(key, str(default))
    return _secrets.get(key)


def get_stream_api_key() -> Optional[str]:
    return get_secret("G1000_STREAM_API_KEY") or get_secret("G1000_SIMULATOR_API_KEY")
