from __future__ import annotations

from app.utils.paths import add_package_path

add_package_path("shared-sdk/python")

from aviation.cache import TTLCache

__all__ = ["TTLCache", "weather_cache"]

weather_cache = TTLCache()
