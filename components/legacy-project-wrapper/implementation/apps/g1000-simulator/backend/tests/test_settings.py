"""Settings route integration with the packaged shared Node provider."""
from pathlib import Path
import os
import time

import pytest
from fastapi.testclient import TestClient
from app import create_app
from app.config import Settings
from app.secrets import get_stream_api_key
from app.utils.paths import resolve_packages_root
from aviation_config import AviationConfig, get_services_by_app
from aviation.e2e import sign_e2e_headers

BRIDGE = Path(os.environ.get("AVIATION_KEYSTORE_BRIDGE") or resolve_packages_root() / "keystore/dist/bridge.js")
TOKEN = "synthetic-g1000-operator-token-32-characters"
SIGNING = "synthetic-g1000-test-signing-key-32-characters"
RUN = "e2e_" + "c" * 32


@pytest.fixture
def store(tmp_path, monkeypatch):
    assert BRIDGE.is_file(), "Build the common keystore runtime before app tests"
    monkeypatch.delenv("AVIATION_E2E_RUN_ID", raising=False)
    monkeypatch.setenv("AVIATION_KEYSTORE_BRIDGE", str(BRIDGE))
    monkeypatch.setenv("KEYSTORE_ENCRYPTION_KEY", "synthetic-g1000-master-key-32-characters")
    monkeypatch.setenv("AVIATION_SETTINGS_TOKEN", TOKEN)
    monkeypatch.setenv("KEYSTORE_PATH", str(tmp_path / "normal.keystore"))
    for service in get_services_by_app("g1000-simulator"):
        for field in service.fields:
            monkeypatch.delenv(field.env_var, raising=False)
            monkeypatch.delenv(field.key, raising=False)
    monkeypatch.delenv("OPENWEATHER_API_KEY", raising=False)
    monkeypatch.delenv("G1000_SIMULATOR_API_KEY", raising=False)
    return tmp_path / "normal.keystore"


def client():
    return TestClient(create_app(Settings(_env_file=None, stream_api_key=None)))


def field_status(response, service):
    return next(item for item in response.json()["services"] if item["id"] == service)["fields"][0]["configured"]


def test_real_app_uses_shared_fields_and_reads_saved_stream_key_from_a_fresh_app(store):
    secret = "synthetic-stream-key"
    body = {"service": "g1000-stream", "key": "api_key", "value": secret}
    with client() as http:
        response = http.get("/api/settings")
        assert {s["id"] for s in response.json()["services"]} == {
            s.id for s in get_services_by_app("g1000-simulator")}
        assert response.json()["write_access"] == {"enabled": True, "requires_token": True}
        assert http.post("/api/settings/secrets", json=body).status_code == 401
        saved = http.post("/api/settings/secrets", json=body, headers={"Authorization": f"Bearer {TOKEN}"})
        assert saved.status_code == 200
        assert saved.json() == {"success": True, "service": "g1000-stream", "key": "api_key"}
        assert secret not in saved.text
    with client() as fresh:
        assert field_status(fresh.get("/api/settings"), "g1000-stream") is True
    assert get_stream_api_key() == secret
    assert secret.encode() not in store.read_bytes()


def test_legacy_weather_alias_is_preserved_without_changing_the_shared_catalog(store, monkeypatch):
    monkeypatch.setenv("OPENWEATHER_API_KEY", "synthetic-legacy-weather")
    with client() as http:
        assert field_status(http.get("/api/settings"), "openweather") is True
        saved = http.post("/api/settings/secrets", headers={"Authorization": f"Bearer {TOKEN}"},
                          json={"service": "openweather", "key": "api_key", "value": "synthetic-new-weather"})
        assert saved.status_code == 200
    assert AviationConfig("g1000-simulator").get("openweather", "api_key") == "synthetic-new-weather"


def test_app_private_mode_uses_signed_run_credentials_and_ignores_legacy_environment(store, monkeypatch):
    monkeypatch.setenv("AVIATION_E2E_RUN_ID", RUN)
    monkeypatch.setenv("AVIATION_E2E_SECRET", SIGNING)
    monkeypatch.setenv("KEYSTORE_PATH", str(store.parent / RUN / "settings.keystore"))
    monkeypatch.setenv("OPENWEATHER_API_KEY", "synthetic-legacy-production")
    headers = sign_e2e_headers("g1000-simulator", RUN, SIGNING, int(time.time() * 1000))
    with client() as http:
        assert http.get("/api/settings").status_code == 403
        response = http.get("/api/settings", headers=headers)
        assert response.status_code == 200
        assert not field_status(response, "openweather")
        assert response.json()["write_access"] == {"enabled": True, "requires_token": False}
        assert http.post("/api/settings/secrets", headers=headers,
            json={"service": "openweather", "key": "api_key", "value": "synthetic-private"}).status_code == 200
        with client() as fresh:
            assert field_status(fresh.get("/api/settings", headers=headers), "openweather") is True
        assert http.delete("/api/settings/secrets/openweather/api_key", headers=headers).json()["deleted"] is True
        assert not field_status(http.get("/api/settings", headers=headers), "openweather")
        assert http.delete(f"/__e2e/runs/{RUN}", headers=headers).json()["count"] == 0
    assert not store.exists()


def test_missing_operator_configuration_leaves_the_app_read_only(store, monkeypatch):
    monkeypatch.delenv("AVIATION_SETTINGS_TOKEN")
    with client() as http:
        assert not http.get("/api/settings").json()["write_access"]["enabled"]
        assert http.post("/api/settings/secrets", json={}).status_code == 503
    assert not store.exists()
