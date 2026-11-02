from __future__ import annotations

import subprocess
import sys
from pathlib import Path

import pytest

PYTHON_CLIENT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(PYTHON_CLIENT))

from keystore import KeystoreError, SecretLoader, SecretNotFoundError  # noqa: E402


def completed(stdout: str = "", returncode: int = 0) -> subprocess.CompletedProcess[str]:
    return subprocess.CompletedProcess([], returncode, stdout=stdout, stderr="")


def test_loader_uses_explicit_store_and_caches_keystore_value(tmp_path, monkeypatch):
    store_path = tmp_path / "selected.keystore"
    calls = []

    def run(command, **kwargs):
        calls.append((command, kwargs))
        return completed("\n🔐 flight-planner:API_KEY\n   stored-value\n")

    monkeypatch.setattr(subprocess, "run", run)
    loader = SecretLoader("flight-planner", keystore_path=str(store_path))

    assert loader.get("API_KEY") == "stored-value"
    assert loader.get("API_KEY") == "stored-value"
    assert len(calls) == 1
    assert calls[0][1]["env"]["KEYSTORE_PATH"] == str(store_path.resolve())


def test_loader_falls_back_to_environment_and_enforces_required(tmp_path, monkeypatch):
    monkeypatch.setattr(subprocess, "run", lambda *args, **kwargs: completed(returncode=1))
    monkeypatch.setenv("ENV_ONLY", "environment-value")
    loader = SecretLoader("weather", keystore_path=str(tmp_path / ".keystore"))

    assert loader.get("ENV_ONLY") == "environment-value"
    assert loader.get_with_default("MISSING", "default-value") == "default-value"
    with pytest.raises(SecretNotFoundError, match="weather:MISSING"):
        loader.get_required("MISSING")

    isolated = SecretLoader(
        "weather",
        keystore_path=str(tmp_path / ".keystore"),
        fallback_to_env=False,
    )
    assert isolated.get("ENV_ONLY") is None


def test_list_keys_parses_cli_output_and_forwards_store_path(tmp_path, monkeypatch):
    store_path = tmp_path / ".keystore"
    seen = {}

    def run(command, **kwargs):
        seen.update(kwargs)
        return completed("\n🔑 Secrets for service: weather\n\n   • API_KEY\n   • TOKEN\n")

    monkeypatch.setattr(subprocess, "run", run)
    loader = SecretLoader("weather", keystore_path=str(store_path))

    assert loader.list_keys() == ["API_KEY", "TOKEN"]
    assert seen["env"]["KEYSTORE_PATH"] == str(store_path.resolve())


@pytest.fixture
def runtime_bridge(tmp_path, monkeypatch):
    bridge = PYTHON_CLIENT.parent / "dist" / "bridge.js"
    assert bridge.is_file(), "Build @aviation/shared-sdk and @aviation/keystore before the runtime bridge tests"
    monkeypatch.setenv("KEYSTORE_ENCRYPTION_KEY", "synthetic-runtime-provider-key-at-least-32-bytes")
    monkeypatch.delenv("AVIATION_E2E_RUN_ID", raising=False)
    return bridge, tmp_path / ".keystore"


def test_actual_node_bridge_roundtrip_and_redacted_metadata(runtime_bridge):
    bridge, store = runtime_bridge
    value = "  synthetic\nsecret 🔐  "
    writer = SecretLoader("openweather", keystore_path=str(store), bridge_path=str(bridge), fallback_to_env=False)
    writer.set("api_key", value)
    reader = SecretLoader("openweather", keystore_path=str(store), bridge_path=str(bridge), fallback_to_env=False)
    assert reader.get("api_key") == value
    assert value not in store.read_text()
    assert reader.list_keys() == ["api_key"]
    entries = reader.entries()
    assert [(entry["service"], entry["key"]) for entry in entries] == [("openweather", "api_key")]
    assert all("value" not in entry for entry in entries)
    assert writer.delete("api_key") is True
    assert writer.get("api_key") is None
    assert writer.delete("api_key") is False


def test_actual_bridge_tags_entries_and_denies_foreign_or_unowned_store(runtime_bridge, monkeypatch):
    bridge, store = runtime_bridge
    run = "e2e_" + "a" * 32
    monkeypatch.setenv("AVIATION_E2E_RUN_ID", run)
    owner = SecretLoader("openweather", keystore_path=str(store), bridge_path=str(bridge), fallback_to_env=False)
    owner.set("api_key", "synthetic-test-only")
    assert [(entry["is_test_data"], entry["test_run_id"]) for entry in owner.entries()] == [(True, run)]
    before = store.read_bytes()
    monkeypatch.setenv("AVIATION_E2E_RUN_ID", "e2e_" + "b" * 32)
    foreign = SecretLoader("openweather", keystore_path=str(store), bridge_path=str(bridge), fallback_to_env=False)
    with pytest.raises(KeystoreError, match="operation failed"):
        foreign.delete("api_key")
    assert store.read_bytes() == before
    monkeypatch.delenv("AVIATION_E2E_RUN_ID")
    plain = SecretLoader("weather", keystore_path=str(store.parent / "plain"), bridge_path=str(bridge), fallback_to_env=False)
    plain.set("API_KEY", "ordinary-fixture")
    before = (store.parent / "plain").read_bytes()
    monkeypatch.setenv("AVIATION_E2E_RUN_ID", run)
    isolated = SecretLoader("weather", keystore_path=str(store.parent / "plain"), bridge_path=str(bridge))
    with pytest.raises(KeystoreError):
        isolated.set("API_KEY", "replacement")
    assert (store.parent / "plain").read_bytes() == before


def test_actual_bridge_wrong_key_preserves_store(runtime_bridge, monkeypatch):
    bridge, store = runtime_bridge
    loader = SecretLoader("weather", keystore_path=str(store), bridge_path=str(bridge), fallback_to_env=False)
    loader.set("API_KEY", "original-private-fixture")
    before = store.read_bytes()
    monkeypatch.setenv("KEYSTORE_ENCRYPTION_KEY", "wrong-key")
    with pytest.raises(KeystoreError, match="operation failed"):
        loader.set("API_KEY", "replacement-private-fixture")
    assert store.read_bytes() == before
    assert loader.get("API_KEY") == "original-private-fixture"  # failed write did not replace the cache
    loader.clear_cache()
    assert loader.get("API_KEY") is None


def test_bridge_protocol_failure_does_not_expose_or_cache_secret(tmp_path, monkeypatch):
    calls = []
    def run(command, **kwargs):
        calls.append((command, kwargs))
        return completed('{"schema":"aviation/keystore-response@1","ok":false,"error":"failure"}')
    monkeypatch.setattr(subprocess, "run", run)
    loader = SecretLoader("weather", keystore_path=str(tmp_path / ".keystore"), bridge_path="/synthetic/bridge.js", fallback_to_env=False)
    with pytest.raises(KeystoreError, match="operation failed"):
        loader.set("API_KEY", "synthetic-sensitive-value")
    assert loader.get("API_KEY") is None
    assert "synthetic-sensitive-value" not in " ".join(calls[0][0])
    assert 'synthetic-sensitive-value' in calls[0][1]["input"]
    assert calls[0][1]["timeout"] == 15


def test_writes_require_explicit_compiled_provider(tmp_path, monkeypatch):
    monkeypatch.delenv("AVIATION_KEYSTORE_BRIDGE", raising=False)
    loader = SecretLoader("weather", keystore_path=str(tmp_path / ".keystore"))
    with pytest.raises(KeystoreError, match="Configure AVIATION_KEYSTORE_BRIDGE"):
        loader.set("API_KEY", "synthetic")
    assert not (tmp_path / ".keystore").exists()



def test_isolated_provider_never_reads_production_environment_or_legacy_store(runtime_bridge, monkeypatch):
    bridge, store = runtime_bridge
    monkeypatch.setenv("AVIATION_E2E_RUN_ID", "e2e_" + "d" * 32)
    monkeypatch.setenv("ENV_ONLY", "production-analog-must-not-leak")
    isolated = SecretLoader("weather", keystore_path=str(store), bridge_path=str(bridge))
    assert isolated.get("ENV_ONLY") is None
    monkeypatch.delenv("AVIATION_KEYSTORE_BRIDGE", raising=False)
    legacy = SecretLoader("weather", keystore_path=str(store))
    assert legacy.get("ENV_ONLY") is None
    with pytest.raises(KeystoreError, match="compiled bridge"):
        legacy.list_keys()
    assert not store.exists()
