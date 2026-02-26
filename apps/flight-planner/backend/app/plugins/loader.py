import os
import json
from .base import Plugin, PluginContext, PluginMetadata, PluginLoadError

class PluginLoader:
    def __init__(self, plugin_directory):
        self.plugin_directory = plugin_directory

    def load_plugins(self):
        plugins = []
        for filename in os.listdir(self.plugin_directory):
            if filename.endswith('.json'):
                try:
                    with open(os.path.join(self.plugin_directory, filename), 'r') as f:
                        manifest = json.load(f)
                        self.validate_manifest(manifest)
                        plugin = self.create_plugin(manifest)
                        plugins.append(plugin)
                except (IOError, json.JSONDecodeError, PluginLoadError) as e:
                    print(f"Failed to load plugin {filename}: {e}")
        return plugins

    def validate_manifest(self, manifest):
        required_keys = ['id', 'name', 'version', 'entry_point']
        for key in required_keys:
            if key not in manifest:
                raise PluginLoadError(f"Manifest missing required key: {key}")

    def create_plugin(self, manifest):
        # Placeholder for creating a plugin instance
        return Plugin(manifest['id'], manifest['name'], manifest['version'])
