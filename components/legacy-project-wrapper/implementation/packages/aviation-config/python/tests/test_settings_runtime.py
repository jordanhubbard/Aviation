"""Real HTTP adapter -> Python loader -> compiled Node -> encrypted file tests."""
from __future__ import annotations

import time
import json
from pathlib import Path

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from aviation.e2e import sign_e2e_headers, assert_test_record_for_run, tag_test_record
from aviation_config import AviationConfig, get_services_by_app
from aviation_config.http import create_settings_router
from keystore import SecretLoader

TOKEN = "synthetic-settings-access-token-32-characters"
MASTER = "synthetic-settings-master-key-32-characters"
RUN = "e2e_" + "a" * 32
OTHER = "e2e_" + "b" * 32
E2E_SECRET = "synthetic-test-signing-key-32-characters"
BRIDGE = Path(__file__).resolve().parents[3] / "keystore/dist/bridge.js"


@pytest.fixture
def runtime(tmp_path, monkeypatch):
    assert BRIDGE.is_file(), "Build shared-sdk and keystore before these runtime tests"
    monkeypatch.delenv("AVIATION_E2E_RUN_ID", raising=False)
    monkeypatch.setenv("KEYSTORE_ENCRYPTION_KEY", MASTER)
    monkeypatch.setenv("AVIATION_KEYSTORE_BRIDGE", str(BRIDGE))
    store = tmp_path / "normal.keystore"
    monkeypatch.setenv("KEYSTORE_PATH", str(store))
    for service in get_services_by_app("g1000-simulator"):
        for field in service.fields:
            monkeypatch.delenv(field.env_var, raising=False)
            monkeypatch.delenv(field.key, raising=False)
    return store


def client(config, **options):
    app = FastAPI()
    app.include_router(create_settings_router(config, **options))
    return TestClient(app)


def configured(response):
    services = response.json()["services"]
    return next(s for s in services if s["id"] == "openweather")["fields"][0]["configured"]


def test_authorized_roundtrip_survives_fresh_provider_and_detects_external_deletion(runtime):
    config = AviationConfig("g1000-simulator")
    secret = "  synthetic unicode ✈\nvalue  "
    body = {"service": "openweather", "key": "api_key", "value": secret}
    with client(config, write_token=TOKEN, encryption_ready=True) as http:
        assert not configured(http.get("/api/settings"))
        assert http.post("/api/settings/secrets", json=body).status_code == 401
        assert not runtime.exists()
        response = http.post("/api/settings/secrets", json=body, headers={"Authorization": f"Bearer {TOKEN}"})
        assert response.json() == {"success": True, "service": "openweather", "key": "api_key"}
        assert secret not in response.text
        assert secret.encode() not in runtime.read_bytes()
        fresh = AviationConfig("g1000-simulator")
        assert fresh.get("openweather", "api_key") == secret
        assert configured(http.get("/api/settings"))
        assert fresh.delete("openweather", "api_key") is True
        assert not configured(http.get("/api/settings"))


@pytest.mark.parametrize("body", [None, [], {}, {"service": "smtp", "key": "password", "value": "synthetic"},
    {"service": "openweather", "key": "OPENWEATHER_API_KEY", "value": "synthetic"},
    {"service": "openweather", "key": "api_key", "value": " "},
    {"service": "openweather", "key": "api_key", "value": 42}])
def test_invalid_or_out_of_app_fields_do_not_create_a_store(runtime, body):
    with client(AviationConfig("g1000-simulator"), write_token=TOKEN, encryption_ready=True) as http:
        response = http.post("/api/settings/secrets", json=body, headers={"Authorization": f"Bearer {TOKEN}"})
        assert response.status_code == 400
    assert not runtime.exists()


def test_malformed_and_oversize_requests_do_not_echo_input_or_persist(runtime):
    sensitive = "synthetic-do-not-echo"
    with client(AviationConfig("g1000-simulator"), write_token=TOKEN, encryption_ready=True) as http:
        for raw in [sensitive, sensitive * 4000]:
            response = http.post("/api/settings/secrets", content=raw, headers={"Authorization": f"Bearer {TOKEN}"})
            assert response.status_code == 400
            assert sensitive not in response.text
    assert not runtime.exists()


def test_failed_decryption_preserves_store_and_never_confirms_a_write(runtime, monkeypatch):
    config = AviationConfig("g1000-simulator")
    config.set("openweather", "api_key", "synthetic-original")
    before = runtime.read_bytes()
    monkeypatch.setenv("KEYSTORE_ENCRYPTION_KEY", "different-synthetic-master-key-32-characters")
    with client(AviationConfig("g1000-simulator"), write_token=TOKEN, encryption_ready=True) as http:
        response = http.post("/api/settings/secrets", json={"service": "openweather", "key": "api_key",
            "value": "synthetic-sensitive-replacement"}, headers={"Authorization": f"Bearer {TOKEN}"})
        assert response.status_code == 503
        assert "synthetic-sensitive" not in response.text
        assert "success" not in response.json()
    assert runtime.read_bytes() == before


@pytest.mark.parametrize("token,encrypted", [(None, True), ("short", True), (TOKEN, False)])
def test_unconfigured_write_policy_is_read_only(runtime, token, encrypted):
    with client(AviationConfig("g1000-simulator"), write_token=token, encryption_ready=encrypted) as http:
        assert http.get("/api/settings").json()["write_access"] == {"enabled": False, "requires_token": False}
        assert http.post("/api/settings/secrets", json={}).status_code == 503
    assert not runtime.exists()


def test_legacy_app_namespace_remains_readable_but_canonical_writes_take_precedence(runtime):
    SecretLoader("g1000-simulator").set("OPENWEATHERMAP_API_KEY", "synthetic-legacy")
    config = AviationConfig("g1000-simulator")
    assert config.get("openweather", "api_key") == "synthetic-legacy"
    config.set("openweather", "api_key", "synthetic-canonical")
    assert config.get("openweather", "api_key") == "synthetic-canonical"


def test_private_credentials_and_store_isolation_are_required_and_tagged(runtime, tmp_path, monkeypatch):
    production = AviationConfig("g1000-simulator")
    production.set("openweather", "api_key", "synthetic-production")
    production_bytes = runtime.read_bytes()
    private = tmp_path / RUN / "settings.keystore"
    monkeypatch.setenv("AVIATION_E2E_RUN_ID", RUN)
    monkeypatch.setenv("KEYSTORE_PATH", str(private))
    monkeypatch.setenv("OPENWEATHERMAP_API_KEY", "synthetic-environment-production")
    monkeypatch.setenv("api_key", "synthetic-raw-production")
    isolated = AviationConfig("g1000-simulator")
    assert isolated.get("openweather", "api_key") is None
    headers = sign_e2e_headers("g1000-simulator", RUN, E2E_SECRET, int(time.time() * 1000))
    foreign = sign_e2e_headers("g1000-simulator", OTHER, E2E_SECRET, int(time.time() * 1000))
    with client(isolated, encryption_ready=True, e2e_secret=E2E_SECRET) as http:
        assert http.get("/api/settings").status_code == 403
        assert http.get("/api/settings", headers=foreign).status_code == 403
        assert not configured(http.get("/api/settings", headers=headers))
        saved = http.post("/api/settings/secrets", headers=headers,
                          json={"service": "openweather", "key": "api_key", "value": "synthetic-private"})
        assert saved.status_code == 200
        metadata = SecretLoader("openweather").entries()
        assert len(metadata) == 2
        for entry in metadata:
            assert_test_record_for_run(entry, RUN)
            assert "value" not in entry
        state = http.get("/__e2e/status", headers=headers).json()
        assert state["run_records"] == 1 and state["records"] == 1
        assert http.delete("/api/settings/secrets/openweather/api_key", headers=foreign).status_code == 403
        assert http.delete("/api/settings/secrets/openweather/api_key", headers=headers).json()["deleted"] is True
        assert http.delete(f"/__e2e/runs/{RUN}", headers=headers).json()["count"] == 0
        assert http.get(f"/__e2e/runs/{RUN}", headers=headers).json()["count"] == 0
        assert SecretLoader("openweather").entries() == []
        assert isolated.get("openweather", "api_key") is None
    assert runtime.read_bytes() == production_bytes


def test_normal_server_rejects_test_headers_even_with_operator_access(runtime):
    headers = {"Authorization": f"Bearer {TOKEN}", "x-aviation-test-run": RUN}
    with client(AviationConfig("g1000-simulator"), write_token=TOKEN, encryption_ready=True) as http:
        assert http.get("/api/settings", headers=headers).status_code == 403
        assert http.post("/api/settings/secrets", headers=headers, json={}).status_code == 403
    assert not runtime.exists()


def test_private_mode_cannot_default_to_an_unowned_path(runtime, monkeypatch):
    monkeypatch.setenv("AVIATION_E2E_RUN_ID", RUN)
    with pytest.raises(ValueError, match="run-owned store"):
        AviationConfig("g1000-simulator")


def private_config(runtime, tmp_path, monkeypatch):
    monkeypatch.setenv("AVIATION_E2E_RUN_ID", RUN)
    monkeypatch.setenv("KEYSTORE_PATH", str(tmp_path / RUN / "settings.keystore"))
    headers = sign_e2e_headers("g1000-simulator", RUN, E2E_SECRET, int(time.time() * 1000))
    return AviationConfig("g1000-simulator"), headers, tmp_path / RUN / "settings.keystore"


def test_fixture_protocol_persists_run_metadata_and_removes_every_owned_record(runtime, tmp_path, monkeypatch):
    config, headers, store = private_config(runtime, tmp_path, monkeypatch)
    with client(config, encryption_ready=True, e2e_secret=E2E_SECRET) as http:
        bad = http.post("/__e2e/fixtures", headers=headers,
            json={"fixture_type": "settings", "record": tag_test_record(OTHER, {})})
        assert bad.status_code == 400 and not store.exists()
        seeded = http.post("/__e2e/fixtures", headers=headers,
            json={"fixture_type": "settings", "record": tag_test_record(RUN, {"purpose": "settings-browser"})})
        assert seeded.status_code == 200 and seeded.json()["run_records"] == 1
        config.set("openweather", "api_key", "synthetic-owned-value")
        fresh = AviationConfig("g1000-simulator")
        assert fresh.test_run_state()["count"] == 2
        before = store.read_bytes()
        assert http.delete(f"/__e2e/runs/{OTHER}", headers=headers).status_code == 403
        assert store.read_bytes() == before
        assert http.delete(f"/__e2e/runs/{RUN}", headers=headers).json()["count"] == 0
        assert fresh.get("openweather", "api_key") is None
        assert http.get(f"/__e2e/runs/{RUN}", headers=headers).json()["count"] == 0


def test_expired_run_cannot_be_renewed_or_read_but_owned_cleanup_remains_available(runtime, tmp_path, monkeypatch):
    config, headers, store = private_config(runtime, tmp_path, monkeypatch)
    config.set("openweather", "api_key", "synthetic-owned-value")
    ledger = SecretLoader("e2e_runs")
    metadata = json.loads(ledger.get(RUN))
    metadata["created_at_ms"] = int(time.time() * 1000) - 2000
    metadata["expires_at_ms"] = metadata["created_at_ms"] + 1000
    ledger.set(RUN, json.dumps(metadata))
    before = store.read_bytes()
    with client(config, encryption_ready=True, e2e_secret=E2E_SECRET) as http:
        assert http.get("/api/settings", headers=headers).status_code == 503
        assert http.post("/api/settings/secrets", headers=headers,
            json={"service": "openweather", "key": "api_key", "value": "synthetic-replacement"}).status_code == 503
        assert store.read_bytes() == before
        assert http.delete(f"/__e2e/runs/{RUN}", headers=headers).json()["count"] == 0


def test_foreign_app_ledger_and_unrecognized_entries_prevent_any_cleanup(runtime, tmp_path, monkeypatch):
    config, headers, store = private_config(runtime, tmp_path, monkeypatch)
    config.set("openweather", "api_key", "synthetic-owned-value")
    ledger = SecretLoader("e2e_runs")
    original = ledger.get(RUN)
    metadata = json.loads(original)
    metadata["app_id"] = "flight-planner"
    ledger.set(RUN, json.dumps(metadata))
    before = store.read_bytes()
    with client(config, encryption_ready=True, e2e_secret=E2E_SECRET) as http:
        assert http.delete(f"/__e2e/runs/{RUN}", headers=headers).status_code == 503
        assert store.read_bytes() == before
        ledger.set(RUN, original)
        foreign = SecretLoader("another-app")
        foreign.set("key", "synthetic-foreign-value")
        before = store.read_bytes()
        assert http.delete(f"/__e2e/runs/{RUN}", headers=headers).status_code == 503
        assert store.read_bytes() == before
        foreign.delete("key")
        assert http.delete(f"/__e2e/runs/{RUN}", headers=headers).json()["count"] == 0


def test_normal_provider_cannot_read_or_overwrite_a_test_tagged_store(runtime, tmp_path, monkeypatch):
    config, headers, store = private_config(runtime, tmp_path, monkeypatch)
    config.set("openweather", "api_key", "synthetic-private-only")
    before = store.read_bytes()
    monkeypatch.delenv("AVIATION_E2E_RUN_ID")
    normal = AviationConfig("g1000-simulator")
    assert normal.get("openweather", "api_key") is None
    with client(normal, write_token=TOKEN, encryption_ready=True) as http:
        assert not configured(http.get("/api/settings"))
        assert http.post("/api/settings/secrets", headers={"Authorization": f"Bearer {TOKEN}"},
            json={"service": "openweather", "key": "api_key", "value": "synthetic-normal"}).status_code == 503
    assert store.read_bytes() == before
    monkeypatch.setenv("AVIATION_E2E_RUN_ID", RUN)
    assert config.cleanup_test_run()["count"] == 0
