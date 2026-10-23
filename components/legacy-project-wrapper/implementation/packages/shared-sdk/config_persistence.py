# Configuration Persistence Layer

import os
import json
from pathlib import Path
from typing import Dict, Any, Optional
import yaml


class ConfigPersistence:
    """Handles loading and persisting configuration from multiple sources."""

    def __init__(self, config_dir: str = "~/.config/aviation"):
        self.config_dir = Path(config_dir).expanduser()
        self.config_dir.mkdir(parents=True, exist_ok=True)

    def load_from_file(self, filename: str) -> Dict[str, Any]:
        """Load configuration from JSON or YAML file."""
        filepath = self.config_dir / filename
        if not filepath.exists():
            return {}
        
        with open(filepath, 'r') as f:
            if filename.endswith('.json'):
                return json.load(f)
            elif filename.endswith('.yaml') or filename.endswith('.yml'):
                return yaml.safe_load(f) or {}
        return {}

    def save_to_file(self, filename: str, config: Dict[str, Any]) -> None:
        """Save configuration to JSON or YAML file."""
        filepath = self.config_dir / filename
        
        with open(filepath, 'w') as f:
            if filename.endswith('.json'):
                json.dump(config, f, indent=2)
            elif filename.endswith('.yaml') or filename.endswith('.yml'):
                yaml.dump(config, f, default_flow_style=False)

    def load_from_env(self, prefix: str = "APP_") -> Dict[str, Any]:
        """Load configuration from environment variables."""
        config = {}
        for key, value in os.environ.items():
            if key.startswith(prefix):
                config_key = key[len(prefix):].lower()
                config[config_key] = value
        return config

    def load_profile(self, profile: str = "default") -> Dict[str, Any]:
        """Load configuration for a specific profile."""
        return self.load_from_file(f"{profile}.json")

    def save_profile(self, profile: str, config: Dict[str, Any]) -> None:
        """Save configuration for a specific profile."""
        self.save_to_file(f"{profile}.json", config)

    def merge_configs(self, *configs: Dict[str, Any]) -> Dict[str, Any]:
        """Merge multiple configuration dictionaries."""
        result = {}
        for config in configs:
            result.update(config)
        return result


class ConfigManager:
    """High-level configuration manager with profile support."""

    def __init__(self, config_dir: str = "~/.config/aviation", default_profile: str = "default"):
        self.persistence = ConfigPersistence(config_dir)
        self.default_profile = default_profile
        self.current_config = {}
        self.load_config()

    def load_config(self, profile: Optional[str] = None) -> None:
        """Load configuration from all sources."""
        profile = profile or self.default_profile
        
        # Load in order of precedence (lowest to highest)
        file_config = self.persistence.load_from_file("config.json")
        profile_config = self.persistence.load_profile(profile)
        env_config = self.persistence.load_from_env()
        
        self.current_config = self.persistence.merge_configs(
            file_config,
            profile_config,
            env_config
        )

    def get(self, key: str, default: Any = None) -> Any:
        """Get a configuration value."""
        return self.current_config.get(key, default)

    def set(self, key: str, value: Any) -> None:
        """Set a configuration value."""
        self.current_config[key] = value

    def save(self, profile: Optional[str] = None) -> None:
        """Save current configuration to a profile."""
        profile = profile or self.default_profile
        self.persistence.save_profile(profile, self.current_config)

    def get_all(self) -> Dict[str, Any]:
        """Get all configuration values."""
        return self.current_config.copy()

    def reset(self, profile: Optional[str] = None) -> None:
        """Reset configuration to defaults."""
        self.current_config = {}
        self.load_config(profile)
