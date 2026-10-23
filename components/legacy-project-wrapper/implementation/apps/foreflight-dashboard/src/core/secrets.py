"""
Secrets management for ForeFlight Dashboard.

This module provides centralized secret loading using the Aviation keystore.
"""

import os
import sys
from pathlib import Path

# Add keystore Python client to path
def _packages_root() -> Path:
    for parent in Path(__file__).resolve().parents:
        candidate = parent / "packages"
        if candidate.exists():
            return candidate
    return Path("/packages")


keystore_python = _packages_root() / "keystore" / "python"
if str(keystore_python) not in sys.path:
    sys.path.insert(0, str(keystore_python))

try:
    from keystore import create_secret_loader, SecretNotFoundError

    # Create secret loader for this service
    secrets = create_secret_loader('foreflight-dashboard')
    KEYSTORE_AVAILABLE = True
except Exception as e:
    print(f"Warning: Keystore not available: {e}")
    secrets = None
    KEYSTORE_AVAILABLE = False


def get_secret(key: str, default=None, required: bool = False):
    """
    Get a secret value.
    
    Args:
        key: Secret key name
        default: Default value if not found
        required: Whether the secret is required (raises error if not found)
        
    Returns:
        Secret value
        
    Raises:
        SecretNotFoundError: If required=True and secret not found
    """
    if not KEYSTORE_AVAILABLE:
        value = os.getenv(key, default)
        if required and value is None:
            raise ValueError(f"Required secret not found: {key}")
        return value

    if required:
        return secrets.get_required(key)
    elif default is not None:
        return secrets.get_with_default(key, default)
    else:
        return secrets.get(key)


# Expose common secrets as module-level constants for backward compatibility
def _load_secrets():
    """Load secrets into module-level variables."""
    global SECRET_KEY, DATABASE_URL, FOREFLIGHT_API_KEY, FOREFLIGHT_API_SECRET
    global SMTP_SERVER, SMTP_USERNAME, SMTP_PASSWORD, REDIS_URL, SENTRY_DSN
    
    # Required secrets
    SECRET_KEY = get_secret('SECRET_KEY')
    
    # Optional secrets with defaults
    DATABASE_URL = get_secret('DATABASE_URL', default='sqlite:///logbook.db')
    
    # External API secrets
    FOREFLIGHT_API_KEY = get_secret('FOREFLIGHT_API_KEY')
    FOREFLIGHT_API_SECRET = get_secret('FOREFLIGHT_API_SECRET')
    
    # Email configuration
    SMTP_SERVER = get_secret('SMTP_SERVER')
    SMTP_USERNAME = get_secret('SMTP_USERNAME')
    SMTP_PASSWORD = get_secret('SMTP_PASSWORD')
    
    # External services
    REDIS_URL = get_secret('REDIS_URL')
    SENTRY_DSN = get_secret('SENTRY_DSN')


# Load secrets on module import
_load_secrets()

