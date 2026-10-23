"""
Secrets management for Flight School.

This module provides centralized secret loading using the Aviation keystore.
"""

import sys
from pathlib import Path
from typing import Optional

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
    _secrets = create_secret_loader('flightschool')
    KEYSTORE_AVAILABLE = True
except Exception as e:
    print(f"Warning: Keystore not available: {e}")
    _secrets = None
    KEYSTORE_AVAILABLE = False


def get_secret(key: str, default: Optional[str] = None, required: bool = False) -> Optional[str]:
    """
    Get a secret value from keystore or environment.
    
    Args:
        key: Secret key name
        default: Default value if not found
        required: Whether the secret is required (raises error if not found)
        
    Returns:
        Secret value or None
        
    Raises:
        ValueError: If required=True and secret not found
    """
    if not KEYSTORE_AVAILABLE:
        # Fallback to environment variables
        import os
        value = os.getenv(key, default)
        if required and value is None:
            raise ValueError(f"Required secret not found: {key}")
        return value
    
    if required:
        return _secrets.get_required(key)
    elif default is not None:
        return _secrets.get_with_default(key, str(default))
    else:
        return _secrets.get(key)


# Application secrets
def get_secret_key() -> str:
    """Get the Flask SECRET_KEY."""
    return get_secret('SECRET_KEY', default='dev')


def get_database_url() -> str:
    """Get the database URL."""
    return get_secret('DATABASE_URL', default='sqlite:///flightschool.db')


def get_csrf_secret_key() -> str:
    """Get the WTF CSRF secret key."""
    return get_secret('WTF_CSRF_SECRET_KEY', default='csrf-key')


# Mail configuration
def get_mail_server() -> Optional[str]:
    """Get the mail server."""
    return get_secret('MAIL_SERVER')


def get_mail_port() -> int:
    """Get the mail port."""
    port = get_secret('MAIL_PORT', default='25')
    return int(port) if port else 25


def get_mail_username() -> Optional[str]:
    """Get the mail username."""
    return get_secret('MAIL_USERNAME')


def get_mail_password() -> Optional[str]:
    """Get the mail password."""
    return get_secret('MAIL_PASSWORD')


# Google Calendar configuration
def get_google_client_id() -> Optional[str]:
    """Get Google OAuth client ID."""
    return get_secret('GOOGLE_CLIENT_ID')


def get_google_client_secret() -> Optional[str]:
    """Get Google OAuth client secret."""
    return get_secret('GOOGLE_CLIENT_SECRET')


def get_google_redirect_uri() -> Optional[str]:
    """Get Google OAuth redirect URI."""
    return get_secret('GOOGLE_REDIRECT_URI')

