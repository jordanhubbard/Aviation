"""
Python client for the Aviation keystore.

This module provides a Python interface to the Aviation monorepo's
encrypted keystore for managing secrets and API keys.
"""

import os
import subprocess
import json
from typing import Optional, List, Dict
from pathlib import Path


class KeystoreError(Exception):
    """Base exception for keystore operations."""
    pass


class SecretNotFoundError(KeystoreError):
    """Raised when a required secret is not found."""
    pass


class SecretLoader:
    """
    Python client for loading secrets from the Aviation keystore.
    
    This class provides a clean Python interface to the encrypted keystore,
    with automatic fallback to environment variables for backward compatibility.
    
    Example:
        >>> secrets = SecretLoader('my-service')
        >>> api_key = secrets.get_required('API_KEY')
        >>> port = secrets.get_with_default('PORT', '5000')
    """
    
    def __init__(
        self,
        service_name: str,
        keystore_path: Optional[str] = None,
        fallback_to_env: bool = True,
        npm_executable: str = "npm"
    ):
        """
        Initialize the secret loader.
        
        Args:
            service_name: Name of the service (e.g., 'flightplanner', 'flightschool')
            keystore_path: Optional path to keystore file (defaults to monorepo root)
            fallback_to_env: Whether to fall back to environment variables if secret not found
            npm_executable: Path to npm executable (defaults to 'npm')
        """
        self.service_name = service_name
        self.fallback_to_env = fallback_to_env
        self.npm_executable = npm_executable
        
        # Determine keystore root (monorepo root)
        if keystore_path:
            self.keystore_root = Path(keystore_path).parent
        else:
            # Try to find the monorepo root by looking for package.json with workspaces
            current = Path(__file__).resolve()
            for parent in current.parents:
                package_json = parent / "package.json"
                if package_json.exists():
                    try:
                        with open(package_json) as f:
                            data = json.load(f)
                            if "workspaces" in data:
                                self.keystore_root = parent
                                break
                    except (json.JSONDecodeError, IOError):
                        continue
            else:
                # Fallback to current directory
                self.keystore_root = Path.cwd()
        
        # Cache for secrets to avoid multiple subprocess calls
        self._cache: Dict[str, str] = {}
    
    def get(self, key: str, use_cache: bool = True) -> Optional[str]:
        """
        Get a secret value.
        
        Args:
            key: Secret key name
            use_cache: Whether to use cached value if available
            
        Returns:
            Secret value or None if not found
        """
        # Check cache first
        if use_cache and key in self._cache:
            return self._cache[key]
        
        # Try keystore
        try:
            value = self._get_from_keystore(key)
            if value is not None:
                self._cache[key] = value
                return value
        except KeystoreError:
            pass  # Continue to fallback
        
        # Fall back to environment variables if enabled
        if self.fallback_to_env:
            value = os.environ.get(key)
            if value is not None:
                return value
        
        return None
    
    def get_required(self, key: str) -> str:
        """
        Get a required secret value.
        
        Args:
            key: Secret key name
            
        Returns:
            Secret value
            
        Raises:
            SecretNotFoundError: If secret not found
        """
        value = self.get(key)
        if value is None:
            raise SecretNotFoundError(
                f"Required secret not found: {self.service_name}:{key}. "
                f"Please set it using: npm run keystore set {self.service_name} {key} <value>"
            )
        return value
    
    def get_with_default(self, key: str, default: str) -> str:
        """
        Get a secret with a default value.
        
        Args:
            key: Secret key name
            default: Default value if secret not found
            
        Returns:
            Secret value or default
        """
        value = self.get(key)
        return value if value is not None else default
    
    def has(self, key: str) -> bool:
        """
        Check if a secret exists.
        
        Args:
            key: Secret key name
            
        Returns:
            True if secret exists, False otherwise
        """
        return self.get(key) is not None
    
    def list_keys(self) -> List[str]:
        """
        List all keys for this service.
        
        Returns:
            List of secret key names
        """
        try:
            result = subprocess.run(
                [self.npm_executable, "run", "keystore", "list", self.service_name],
                cwd=str(self.keystore_root),
                capture_output=True,
                text=True,
                check=False
            )
            
            if result.returncode == 0:
                # Parse the output to extract key names
                keys = []
                for line in result.stdout.split('\n'):
                    line = line.strip()
                    if line.startswith('•'):
                        key = line.lstrip('•').strip()
                        if key:
                            keys.append(key)
                return keys
            
            return []
        except Exception:
            return []
    
    def _get_from_keystore(self, key: str) -> Optional[str]:
        """
        Get a secret from the keystore using the CLI.
        
        Args:
            key: Secret key name
            
        Returns:
            Secret value or None if not found
            
        Raises:
            KeystoreError: If there's an error accessing the keystore
        """
        try:
            result = subprocess.run(
                [self.npm_executable, "run", "keystore", "get", self.service_name, key],
                cwd=str(self.keystore_root),
                capture_output=True,
                text=True,
                check=False
            )
            
            if result.returncode == 0:
                # Parse the output - the value is on the last line
                lines = result.stdout.strip().split('\n')
                if len(lines) >= 2:
                    # The last line contains the value
                    return lines[-1].strip()
            
            return None
        except Exception as e:
            raise KeystoreError(f"Error accessing keystore: {e}")
    
    def clear_cache(self):
        """Clear the internal cache."""
        self._cache.clear()


def create_secret_loader(
    service_name: str,
    **kwargs
) -> SecretLoader:
    """
    Create a secret loader for a service.
    
    Args:
        service_name: Name of the service
        **kwargs: Additional arguments passed to SecretLoader
        
    Returns:
        SecretLoader instance
        
    Example:
        >>> secrets = create_secret_loader('flightplanner')
        >>> api_key = secrets.get('OPENWEATHER_API_KEY')
    """
    return SecretLoader(service_name, **kwargs)


# Convenience function for quick secret access
def get_secret(service_name: str, key: str, default: Optional[str] = None) -> Optional[str]:
    """
    Quick helper to get a single secret.
    
    Args:
        service_name: Name of the service
        key: Secret key name
        default: Optional default value
        
    Returns:
        Secret value, default, or None
        
    Example:
        >>> api_key = get_secret('flightplanner', 'OPENWEATHER_API_KEY', 'fallback-key')
    """
    loader = SecretLoader(service_name)
    if default is not None:
        return loader.get_with_default(key, default)
    return loader.get(key)

