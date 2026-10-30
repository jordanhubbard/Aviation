"""Shared in-process cache for weather provider adapters."""

from aviation.cache import TTLCache

weather_cache = TTLCache()

__all__ = ["weather_cache"]
