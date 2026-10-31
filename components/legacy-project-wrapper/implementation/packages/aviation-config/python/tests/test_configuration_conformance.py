"""Conformance adapter for Component-owned aviation.configuration semantics."""

from __future__ import annotations

import json
from pathlib import Path

import pytest
import aviation_config.loader as loader_module

from aviation_config import (
    SERVICE_REGISTRY,
    ConfigurationValidationError,
    Service,
    build_service_status,
    get_service_by_id,
    get_services_by_app,
    normalize_service_catalog,
    normalize_service_definition,
)


PACKAGED = Path(__file__).resolve().parents[2] / "conformance" / "configuration.json"
REPOSITORY_ROOT = Path(__file__).resolve().parents[7]
AUTHORITY = REPOSITORY_ROOT / "components" / "aviation-configuration" / "acceptance" / "vectors.json"
CONTRACT = json.loads(PACKAGED.read_text(encoding="utf-8"))
if (REPOSITORY_ROOT / ".git").exists():
    assert CONTRACT == json.loads(AUTHORITY.read_text(encoding="utf-8"))


def _portable(service: Service) -> dict[str, object]:
    result = {
        "id": service.id, "name": service.name, "description": service.description,
        "category": service.category,
        "fields": [{
            "key": field.key, "label": field.label, "description": field.description,
            "required": field.required, "secret": field.secret, "envVar": field.env_var,
        } for field in service.fields],
        "appScope": service.app_scope,
    }
    if service.docs_url:
        result["docsUrl"] = service.docs_url
    return result


def _catalog_projection(service: Service) -> dict[str, object]:
    return {
        "id": service.id, "category": service.category,
        "fields": [[field.key, field.env_var, field.required, field.secret] for field in service.fields],
        "appScope": service.app_scope,
    }


def test_schema_and_shipped_catalog() -> None:
    assert CONTRACT["schema"] == "aviation/configuration-acceptance-vectors@1"
    assert [_catalog_projection(service) for service in SERVICE_REGISTRY] == CONTRACT["catalog"]


@pytest.mark.parametrize("vector", CONTRACT["normalizationCases"], ids=lambda value: value["id"])
def test_normalization(vector: dict[str, object]) -> None:
    before = json.loads(json.dumps(vector["input"]))
    assert _portable(normalize_service_definition(vector["input"])) == vector["expected"]
    assert vector["input"] == before


@pytest.mark.parametrize("vector", CONTRACT["invalidDefinitionCases"], ids=lambda value: value["id"])
def test_invalid_definition(vector: dict[str, object]) -> None:
    with pytest.raises(ConfigurationValidationError) as raised:
        normalize_service_definition(vector["input"])
    assert raised.value.code == vector["expectedErrorCode"]


@pytest.mark.parametrize("vector", CONTRACT["invalidCatalogCases"], ids=lambda value: value["id"])
def test_invalid_catalog(vector: dict[str, object]) -> None:
    base = CONTRACT["normalizationCases"][0]["input"]
    definitions = []
    for index, name in enumerate(vector["definitions"]):
        value = json.loads(json.dumps(base))
        if name == "same-env":
            value["id"] = f"service-{index}"
        definitions.append(value)
    with pytest.raises(ConfigurationValidationError) as raised:
        normalize_service_catalog(definitions)
    assert raised.value.code == vector["expectedErrorCode"]


@pytest.mark.parametrize("vector", CONTRACT["filterCases"])
def test_filter(vector: dict[str, object]) -> None:
    assert [service.id for service in get_services_by_app(vector["appId"])] == vector["expectedIds"]


@pytest.mark.parametrize("vector", CONTRACT["lookupCases"])
def test_lookup(vector: dict[str, object]) -> None:
    service = get_service_by_id(vector["id"])
    assert (service.id if service else None) == vector["expectedId"]


@pytest.mark.parametrize("vector", CONTRACT["statusCases"])
def test_status(vector: dict[str, object]) -> None:
    service = get_service_by_id(vector["serviceId"])
    assert service is not None
    assert build_service_status(service, vector["configuredKeys"]) == vector["expected"]


def test_environment_adapter_uses_registry_and_required_status(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(loader_module, "_KEYSTORE_AVAILABLE", False)
    monkeypatch.setenv("MAIL_SERVER", "smtp.example.test")
    config = loader_module.AviationConfig("flightschool")
    assert config.get("smtp", "server") == "smtp.example.test"
    smtp_status = next(item for item in config.get_service_status() if item["id"] == "smtp")
    assert smtp_status == {
        "id": "smtp",
        "configured": True,
        "fields": [
            {"key": "server", "configured": True},
            {"key": "port", "configured": False},
            {"key": "username", "configured": False},
            {"key": "password", "configured": False},
        ],
    }
