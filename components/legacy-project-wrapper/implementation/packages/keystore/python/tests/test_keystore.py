from __future__ import annotations

import subprocess
import sys
from pathlib import Path

import pytest

PYTHON_CLIENT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(PYTHON_CLIENT))

from keystore import SecretLoader, SecretNotFoundError  # noqa: E402


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
