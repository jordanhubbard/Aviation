"""
Aviation Cache Module - Python Implementation

Caching for improved performance:

- :class:`TTLCache` - in-process, dependency-free, with stale-on-error fallback
- :class:`RedisCache` - shared/distributed caching (requires ``redis``)
"""

from .redis_cache import (
    CacheConfig,
    CacheMetrics,
    CacheTTL,
    RedisCache,
    get_cache,
    init_cache,
)
from .ttl_cache import TTLCache

__all__ = [
    "RedisCache",
    "CacheConfig",
    "CacheMetrics",
    "CacheTTL",
    "get_cache",
    "init_cache",
    "TTLCache",
]
