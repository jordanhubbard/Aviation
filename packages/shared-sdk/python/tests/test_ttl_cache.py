"""Unit tests for the in-process TTL cache."""

import sys
import threading
import time
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).parent.parent))

from aviation.cache import TTLCache


def test_returns_value_within_ttl():
    cache = TTLCache()
    cache.set("k", "v", ttl_s=60)
    assert cache.get("k") == "v"


def test_returns_none_for_missing_key():
    assert TTLCache().get("absent") is None


def test_expires_after_ttl():
    cache = TTLCache()
    cache.set("k", "v", ttl_s=0.01)
    time.sleep(0.02)
    assert cache.get("k") is None


def test_get_stale_ignores_expiry():
    cache = TTLCache()
    cache.set("k", "v", ttl_s=0.01)
    time.sleep(0.02)
    assert cache.get("k") is None
    assert cache.get_stale("k") == "v"


def test_clear_removes_entries():
    cache = TTLCache()
    cache.set("k", "v", ttl_s=60)
    cache.clear()
    assert cache.get("k") is None
    assert cache.get_stale("k") is None


def test_get_or_set_computes_and_stores():
    cache = TTLCache()
    calls = []

    def produce():
        calls.append(1)
        return "fresh"

    assert cache.get_or_set("k", ttl_s=60, fn=produce) == "fresh"
    assert cache.get_or_set("k", ttl_s=60, fn=produce) == "fresh"
    assert len(calls) == 1, "second call should be served from cache"


def test_get_or_set_serves_stale_on_error():
    cache = TTLCache()
    cache.set("k", "old", ttl_s=0.01)
    time.sleep(0.02)

    def boom():
        raise RuntimeError("upstream down")

    assert cache.get_or_set("k", ttl_s=60, fn=boom, allow_stale_on_error=True) == "old"


def test_get_or_set_raises_when_no_stale_available():
    cache = TTLCache()

    def boom():
        raise RuntimeError("upstream down")

    with pytest.raises(RuntimeError):
        cache.get_or_set("k", ttl_s=60, fn=boom, allow_stale_on_error=True)


def test_get_or_set_propagates_error_when_stale_disallowed():
    cache = TTLCache()
    cache.set("k", "old", ttl_s=0.01)
    time.sleep(0.02)

    def boom():
        raise RuntimeError("upstream down")

    with pytest.raises(RuntimeError):
        cache.get_or_set("k", ttl_s=60, fn=boom, allow_stale_on_error=False)


def test_concurrent_access_is_thread_safe():
    cache = TTLCache()
    errors = []

    def hammer(n):
        try:
            for i in range(200):
                cache.set(f"k{n}", i, ttl_s=60)
                cache.get(f"k{n}")
        except Exception as exc:  # pragma: no cover - failure path
            errors.append(exc)

    threads = [threading.Thread(target=hammer, args=(n,)) for n in range(8)]
    for t in threads:
        t.start()
    for t in threads:
        t.join()

    assert not errors
    assert cache.get("k0") == 199
