from __future__ import annotations

import threading
import time
from dataclasses import dataclass
from typing import Any, Callable, Dict, Generic, Optional, TypeVar


T = TypeVar("T")


@dataclass
class _Entry(Generic[T]):
    value: T
    stored_at: float
    ttl_s: float


class TTLCache:
    def __init__(self) -> None:
        self._lock = threading.Lock()
        self._cache: Dict[str, _Entry[Any]] = {}

    def clear(self) -> None:
        with self._lock:
            self._cache.clear()

    def get(self, key: str) -> Optional[Any]:
        now = time.time()
        with self._lock:
            entry = self._cache.get(key)
            if not entry:
                return None
            if now - entry.stored_at > entry.ttl_s:
                return None
            return entry.value

    def get_stale(self, key: str) -> Optional[Any]:
        with self._lock:
            entry = self._cache.get(key)
            return entry.value if entry else None

    def set(self, key: str, value: Any, ttl_s: float) -> None:
        with self._lock:
            self._cache[key] = _Entry(value=value, stored_at=time.time(), ttl_s=ttl_s)

    def get_or_set(
        self, key: str, *, ttl_s: float, fn: Callable[[], T], allow_stale_on_error: bool = False
    ) -> T:
        cached = self.get(key)
        if cached is not None:
            return cached

        stale = self.get_stale(key) if allow_stale_on_error else None

        try:
            value = fn()
        except Exception:
            if allow_stale_on_error and stale is not None:
                return stale
            raise

        self.set(key, value, ttl_s)
        return value


weather_cache = TTLCache()
