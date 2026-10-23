"""Plugin registry for managing plugin metadata and discovery."""

from typing import Dict, List, Optional
from .base import PluginMetadata, PluginError


class PluginRegistry:
    """Registry for managing plugin metadata and discovery."""
    
    def __init__(self):
        self.plugins: Dict[str, PluginMetadata] = {}
        self.categories: Dict[str, List[str]] = {}
    
    def register(self, metadata: PluginMetadata) -> None:
        """Register a plugin in the registry."""
        if metadata.id in self.plugins:
            raise PluginError(f"Plugin {metadata.id} is already registered")
        self.plugins[metadata.id] = metadata
    
    def unregister(self, plugin_id: str) -> None:
        """Unregister a plugin from the registry."""
        if plugin_id not in self.plugins:
            raise PluginError(f"Plugin {plugin_id} not found in registry")
        del self.plugins[plugin_id]
    
    def get(self, plugin_id: str) -> Optional[PluginMetadata]:
        """Get plugin metadata by ID."""
        return self.plugins.get(plugin_id)
    
    def list_all(self) -> List[PluginMetadata]:
        """List all registered plugins."""
        return list(self.plugins.values())
    
    def list_by_category(self, category: str) -> List[PluginMetadata]:
        """List plugins by category."""
        plugin_ids = self.categories.get(category, [])
        return [self.plugins[pid] for pid in plugin_ids if pid in self.plugins]
    
    def add_to_category(self, plugin_id: str, category: str) -> None:
        """Add a plugin to a category."""
        if plugin_id not in self.plugins:
            raise PluginError(f"Plugin {plugin_id} not found")
        if category not in self.categories:
            self.categories[category] = []
        if plugin_id not in self.categories[category]:
            self.categories[category].append(plugin_id)
    
    def remove_from_category(self, plugin_id: str, category: str) -> None:
        """Remove a plugin from a category."""
        if category in self.categories and plugin_id in self.categories[category]:
            self.categories[category].remove(plugin_id)
