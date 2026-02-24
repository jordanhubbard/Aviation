"""Plugin system for flight-planner backend.

This module provides a plugin architecture that allows:
- Third-party extensions
- Custom aircraft profiles
- External API integrations
- Hardware device adapters
"""

from .base import (
    Plugin,
    PluginContext,
    PluginManager,
    PluginMetadata,
    PluginState,
    PluginError,
    PluginLoadError,
    PluginInitError,
)
from .registry import PluginRegistry
from .loader import PluginLoader

__all__ = [
    "Plugin",
    "PluginContext",
    "PluginManager",
    "PluginMetadata",
    "PluginState",
    "PluginError",
    "PluginLoadError",
    "PluginInitError",
    "PluginRegistry",
    "PluginLoader",
]
