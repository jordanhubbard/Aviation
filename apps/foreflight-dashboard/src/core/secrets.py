"""
Secrets management for ForeFlight Dashboard.

This module provides centralized secret loading using the Aviation keystore.
"""

import sys
from pathlib import Path

# Add keystore Python client to path
keystore_python = Path(__file__).resolve().parents[4] / "packages" / "keystore" / "python"
if str(keystore_python) not in sys.path:
    sys.path.insert(0, str(keystore_python))

from keystore import create_secret_loader, SecretNotFoundError

# Create secret loader for this service
secrets = create_secret_loader('foreflight-dashboard')


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
    SECRET_KEY = secrets.get('SECRET_KEY')
    
    # Optional secrets with defaults
    DATABASE_URL = secrets.get_with_default('DATABASE_URL', 'sqlite:///logbook.db')
    
    # External API secrets
    FOREFLIGHT_API_KEY = secrets.get('FOREFLIGHT_API_KEY')
    FOREFLIGHT_API_SECRET = secrets.get('FOREFLIGHT_API_SECRET')
    
    # Email configuration
    SMTP_SERVER = secrets.get('SMTP_SERVER')
    SMTP_USERNAME = secrets.get('SMTP_USERNAME')
    SMTP_PASSWORD = secrets.get('SMTP_PASSWORD')
    
    # External services
    REDIS_URL = secrets.get('REDIS_URL')
    SENTRY_DSN = secrets.get('SENTRY_DSN')


# Load secrets on module import
_load_secrets()

