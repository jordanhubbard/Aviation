"""
Redis Cache Implementation for Aviation Python SDK

Provides a unified caching interface with TTL management,
hit rate monitoring, and automatic serialization.
"""

from __future__ import annotations

import json
import os
from dataclasses import dataclass, field
from typing import Any, Callable, Optional, TypeVar

try:
    import redis
    from redis import Redis
except ImportError:
    redis = None  # type: ignore
    Redis = None  # type: ignore

T = TypeVar("T")


@dataclass
class CacheConfig:
    """Redis cache configuration"""

    host: str = field(default_factory=lambda: os.getenv("REDIS_HOST", "localhost"))
    port: int = field(default_factory=lambda: int(os.getenv("REDIS_PORT", "6379")))
    password: Optional[str] = field(default_factory=lambda: os.getenv("REDIS_PASSWORD"))
    db: int = 0
    key_prefix: str = "aviation:"
    default_ttl: int = 3600  # 1 hour
    enable_metrics: bool = True


@dataclass
class CacheMetrics:
    """Cache performance metrics"""

    hits: int = 0
    misses: int = 0
    sets: int = 0
    deletes: int = 0

    @property
    def hit_rate(self) -> float:
        """Calculate cache hit rate percentage"""
        total = self.hits + self.misses
        return (self.hits / total * 100) if total > 0 else 0.0


class RedisCache:
    """Redis-based cache with metrics and TTL management"""

    def __init__(self, config: Optional[CacheConfig] = None):
        if redis is None:
            raise RuntimeError(
                "redis package not installed. Install with: pip install redis"
            )

        self.config = config or CacheConfig()
        self.metrics = CacheMetrics()
        self._client: Optional[Redis] = None

    def connect(self) -> None:
        """Connect to Redis"""
        if self._client is None:
            self._client = redis.Redis(
                host=self.config.host,
                port=self.config.port,
                password=self.config.password,
                db=self.config.db,
                decode_responses=True,
            )
            # Test connection
            self._client.ping()
            print("✅ Redis cache connected")

    def disconnect(self) -> None:
        """Disconnect from Redis"""
        if self._client:
            self._client.close()
            self._client = None

    @property
    def client(self) -> Redis:
        """Get Redis client, connecting if necessary"""
        if self._client is None:
            self.connect()
        return self._client  # type: ignore

    def _key(self, key: str) -> str:
        """Generate full cache key with prefix"""
        return f"{self.config.key_prefix}{key}"

    def get(self, key: str, serialize: bool = True) -> Optional[Any]:
        """Get value from cache"""
        try:
            value = self.client.get(self._key(key))

            if value is None:
                if self.config.enable_metrics:
                    self.metrics.misses += 1
                return None

            if self.config.enable_metrics:
                self.metrics.hits += 1

            return json.loads(value) if serialize else value
        except Exception as e:
            print(f"Cache get error: {e}")
            return None

    def set(
        self, key: str, value: Any, ttl: Optional[int] = None, serialize: bool = True
    ) -> bool:
        """Set value in cache with TTL"""
        try:
            ttl = ttl if ttl is not None else self.config.default_ttl
            serialized = json.dumps(value) if serialize else str(value)

            self.client.setex(self._key(key), ttl, serialized)

            if self.config.enable_metrics:
                self.metrics.sets += 1
            return True
        except Exception as e:
            print(f"Cache set error: {e}")
            return False

    def get_or_set(
        self, key: str, fn: Callable[[], T], ttl: Optional[int] = None, serialize: bool = True
    ) -> T:
        """Get or set pattern - execute function if cache miss"""
        cached = self.get(key, serialize=serialize)

        if cached is not None:
            return cached

        value = fn()
        self.set(key, value, ttl=ttl, serialize=serialize)

        return value

    def delete(self, key: str) -> bool:
        """Delete key from cache"""
        try:
            result = self.client.delete(self._key(key))
            if self.config.enable_metrics:
                self.metrics.deletes += 1
            return result > 0
        except Exception as e:
            print(f"Cache delete error: {e}")
            return False

    def delete_pattern(self, pattern: str) -> int:
        """Delete keys matching pattern"""
        try:
            keys = self.client.keys(self._key(pattern))
            if not keys:
                return 0

            result = self.client.delete(*keys)
            if self.config.enable_metrics:
                self.metrics.deletes += result
            return result
        except Exception as e:
            print(f"Cache delete pattern error: {e}")
            return 0

    def exists(self, key: str) -> bool:
        """Check if key exists"""
        try:
            return self.client.exists(self._key(key)) > 0
        except Exception as e:
            print(f"Cache exists error: {e}")
            return False

    def ttl(self, key: str) -> int:
        """Get remaining TTL for key (in seconds)"""
        try:
            return self.client.ttl(self._key(key))
        except Exception as e:
            print(f"Cache TTL error: {e}")
            return -1

    def extend(self, key: str, seconds: int) -> bool:
        """Extend TTL for existing key"""
        try:
            return self.client.expire(self._key(key), seconds)
        except Exception as e:
            print(f"Cache extend error: {e}")
            return False

    def get_metrics(self) -> CacheMetrics:
        """Get cache metrics"""
        return self.metrics

    def reset_metrics(self) -> None:
        """Reset cache metrics"""
        self.metrics = CacheMetrics()

    def flush(self) -> None:
        """Flush entire cache (use with caution!)"""
        try:
            self.client.flushdb()
            print("⚠️  Cache flushed")
        except Exception as e:
            print(f"Cache flush error: {e}")

    def info(self) -> str:
        """Get cache info"""
        try:
            return str(self.client.info())
        except Exception as e:
            print(f"Cache info error: {e}")
            return ""


# Cache TTL constants (in seconds)
class CacheTTL:
    """Standard TTL values for different data types"""

    AIRPORT_DATA = 86400  # 24 hours (rarely changes)
    WEATHER_CURRENT = 900  # 15 minutes
    WEATHER_FORECAST = 1800  # 30 minutes
    METAR = 1800  # 30 minutes
    TAF = 3600  # 1 hour
    ROUTE_CALCULATION = 3600  # 1 hour
    MAP_TILES = 604800  # 7 days
    STATIC_ASSETS = 2592000  # 30 days
    USER_SESSION = 86400  # 24 hours
    RATE_LIMIT = 60  # 1 minute


# Global cache instance (singleton)
_global_cache: Optional[RedisCache] = None


def get_cache(config: Optional[CacheConfig] = None) -> RedisCache:
    """Get or create global cache instance"""
    global _global_cache
    if _global_cache is None:
        _global_cache = RedisCache(config)
    return _global_cache


def init_cache(config: Optional[CacheConfig] = None) -> RedisCache:
    """Initialize and connect cache"""
    cache = get_cache(config)
    cache.connect()
    return cache
