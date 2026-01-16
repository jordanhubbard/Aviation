"""
Secrets management for Flight Planner.

This module provides centralized secret loading using the Aviation keystore.
"""

from typing import Optional

from app.utils.paths import add_package_path

add_package_path("keystore/python")

try:
    from keystore import create_secret_loader, SecretNotFoundError
    
    # Create secret loader for this service
    _secrets = create_secret_loader('flight-planner')
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
        SecretNotFoundError: If required=True and secret not found
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


# Weather API keys
def get_openweather_api_key() -> Optional[str]:
    """Get OpenWeatherMap API key."""
    return get_secret('OPENWEATHERMAP_API_KEY') or get_secret('OPENWEATHER_API_KEY')


def get_opentopography_api_key() -> Optional[str]:
    """Get OpenTopography API key."""
    return get_secret('OPENTOPOGRAPHY_API_KEY')


def get_openaip_api_key() -> Optional[str]:
    """Get OpenAIP API key."""
    return get_secret('OPENAIP_API_KEY')

