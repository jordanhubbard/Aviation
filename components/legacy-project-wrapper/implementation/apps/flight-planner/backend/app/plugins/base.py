"""Base classes and interfaces for the plugin system."""

from abc import ABC, abstractmethod
from typing import Optional, Dict, Any
from enum import Enum


class PluginState(Enum):
    """Plugin lifecycle states."""
    UNLOADED = "unloaded"
    LOADED = "loaded"
    INITIALIZED = "initialized"
    RUNNING = "running"
    STOPPED = "stopped"
    ERROR = "error"


class PluginError(Exception):
    """Base exception for plugin-related errors."""
    pass


class PluginLoadError(PluginError):
    """Exception raised when plugin loading fails."""
    pass


class PluginInitError(PluginError):
    """Exception raised when plugin initialization fails."""
    pass


class PluginMetadata:
    """Metadata for a plugin."""
    def __init__(self, plugin_id: str, name: str, version: str, 
                 description: str = "", author: str = "", 
                 entry_point: str = "", permissions: Optional[list] = None):
        self.id = plugin_id
        self.name = name
        self.version = version
        self.description = description
        self.author = author
        self.entry_point = entry_point
        self.permissions = permissions or []


class PluginContext:
    """Context provided to plugins for accessing application services."""
    def __init__(self, app_context: Optional[Dict[str, Any]] = None):
        self.app_context = app_context or {}
        self.hooks = {}

    def register_hook(self, hook_name: str, callback):
        """Register a hook callback."""
        if hook_name not in self.hooks:
            self.hooks[hook_name] = []
        self.hooks[hook_name].append(callback)

    def call_hook(self, hook_name: str, *args, **kwargs):
        """Call all registered callbacks for a hook."""
        if hook_name in self.hooks:
            for callback in self.hooks[hook_name]:
                callback(*args, **kwargs)


class Plugin(ABC):
    """Base class for all plugins."""
    def __init__(self, metadata: PluginMetadata):
        self.metadata = metadata
        self.state = PluginState.UNLOADED
        self.context: Optional[PluginContext] = None

    @abstractmethod
    async def initialize(self, context: PluginContext) -> None:
        """Initialize the plugin with the given context."""
        pass

    @abstractmethod
    async def destroy(self) -> None:
        """Clean up and destroy the plugin."""
        pass

    def get_id(self) -> str:
        """Get the plugin ID."""
        return self.metadata.id

    def get_name(self) -> str:
        """Get the plugin name."""
        return self.metadata.name

    def get_version(self) -> str:
        """Get the plugin version."""
        return self.metadata.version


class PluginManager:
    """Manages plugin lifecycle and registration."""
    def __init__(self):
        self.plugins: Dict[str, Plugin] = {}
        self.context = PluginContext()

    async def register_plugin(self, plugin: Plugin) -> None:
        """Register a plugin."""
        plugin_id = plugin.get_id()
        if plugin_id in self.plugins:
            raise PluginError(f"Plugin {plugin_id} is already registered")
        self.plugins[plugin_id] = plugin
        plugin.state = PluginState.LOADED

    async def initialize_plugin(self, plugin_id: str) -> None:
        """Initialize a registered plugin."""
        if plugin_id not in self.plugins:
            raise PluginError(f"Plugin {plugin_id} not found")
        plugin = self.plugins[plugin_id]
        try:
            await plugin.initialize(self.context)
            plugin.state = PluginState.INITIALIZED
        except Exception as e:
            plugin.state = PluginState.ERROR
            raise PluginInitError(f"Failed to initialize plugin {plugin_id}: {e}")

    async def destroy_plugin(self, plugin_id: str) -> None:
        """Destroy a plugin."""
        if plugin_id not in self.plugins:
            raise PluginError(f"Plugin {plugin_id} not found")
        plugin = self.plugins[plugin_id]
        try:
            await plugin.destroy()
            plugin.state = PluginState.STOPPED
        except Exception as e:
            plugin.state = PluginState.ERROR
            raise PluginError(f"Failed to destroy plugin {plugin_id}: {e}")

    def get_plugin(self, plugin_id: str) -> Optional[Plugin]:
        """Get a plugin by ID."""
        return self.plugins.get(plugin_id)

    def list_plugins(self) -> list:
        """List all registered plugins."""
        return list(self.plugins.values())
