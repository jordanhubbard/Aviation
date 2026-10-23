# Config Loader and Persistence Layer

import os
import json
from typing import Dict, Any

class ConfigLoader:
    def __init__(self, config_file: str, env_prefix: str = "APP_"):
        self.config_file = config_file
        self.env_prefix = env_prefix
        self.config = self.load_config()

    def load_config(self) -> Dict[str, Any]:
        config = {}
        # Load from file
        if os.path.exists(self.config_file):
            with open(self.config_file, 'r') as f:
                config.update(json.load(f))
        # Load from environment
        for key, value in os.environ.items():
            if key.startswith(self.env_prefix):
                config_key = key[len(self.env_prefix):]
                config[config_key] = value
        # Load from keystore (mocked)
        # In a real implementation, this would interface with the keystore package
        keystore_config = self.load_from_keystore()
        config.update(keystore_config)
        return config

    def load_from_keystore(self) -> Dict[str, Any]:
        # Mocked keystore loading
        return {}

    def persist_config(self, user_settings: Dict[str, Any], profile: str = "default"):
        # Persist user settings to a file
        config_path = f"{self.config_file}.{profile}.json"
        with open(config_path, 'w') as f:
            json.dump(user_settings, f, indent=4)

    def get(self, key: str, default: Any = None) -> Any:
        return self.config.get(key, default)

    def set(self, key: str, value: Any):
        self.config[key] = value

# Example usage
# loader = ConfigLoader('config.json')
# print(loader.get('some_key'))
# loader.persist_config({'user_setting': 'value'})
