"""Private native API contract, with outbound provider I/O confined to fixtures."""

from datetime import datetime, timedelta, timezone
import json

from fastapi import FastAPI
from fastapi.testclient import TestClient
import httpx
import pytest

from app.routers.filing import install
from app.services.filing.provider import Client, Configuration
from app.services.filing.store import Store
from app.services.filing.workflow import Workflow

TOKEN = "private-fixture-token-32-characters-minimum"
HEADERS = {"Authorization": "Bearer " + TOKEN}
NOW = datetime(2026, 11, 18, 12, tzinfo=timezone.utc)


@pytest.fixture
def api(tmp_path, monkeypatch):
    monkeypatch.setenv("FLIGHT_SERVICE_TOKEN", TOKEN)
    app = FastAPI()
    install(app)
    calls = []

    def handler(request):
        calls.append(request)
        return httpx.Response(
            200,
            stream=httpx.ByteStream(
                json.dumps(
                    {
                        "returnStatus": True,
                        "flightIdentifier": "fixture_123_456",
                        "versionStamp": "20261118120000000",
                    }
                ).encode()
            ),
        )

    app.state.filing_workflow = Workflow(
        Store(tmp_path / "private"),
        Client(
            Configuration("lab", "fixture-vendor", "fixture-secret", ""),
            transport=httpx.MockTransport(handler),
        ),
        clock=lambda: NOW.timestamp(),
    )
    with TestClient(app) as client:
        yield client, calls


def test_public_capabilities_has_no_startup_network_or_secret(api):
    client, calls = api
    result = client.get("/api/filing/capabilities")
    assert result.status_code == 200
    assert not result.json()["provider_access_verified"]
    assert result.json()["private_api_configured"]
    assert "fixture-secret" not in result.text
    assert not calls


@pytest.mark.parametrize(
    "method,path,body,status",
    [
        ("POST", "/api/filing/validate", {}, 401),
        ("POST", "/api/filing/actions/execute", {"action": "file"}, 401),
        ("GET", "/api/filing/drafts", None, 401),
    ],
)
def test_auth_precedes_body_parsing_and_storage(api, method, path, body, status):
    client, calls = api
    result = client.request(method, path, json=body)
    assert result.status_code == status
    assert result.headers["cache-control"] == "private, no-store"
    assert not calls


@pytest.mark.parametrize(
    "path,body,status",
    [
        ("/api/filing/validate", {"speed_knots": "fast"}, 422),
        ("/api/filing/drafts", {"account": "pilot@example.test", "plan": {}}, 201),
        (
            "/api/filing/actions/prepare",
            {"draft_id": "missing", "revision": 1, "action": "file"},
            404,
        ),
    ],
)
def test_private_responses_include_errors_are_not_cacheable(api, path, body, status):
    client, calls = api
    result = client.post(path, json=body, headers=HEADERS)
    assert result.status_code == status, result.text
    assert result.headers["cache-control"] == "private, no-store"
    assert not calls


def test_request_size_bound_and_unconfigured_access(api, monkeypatch):
    client, calls = api
    result = client.post("/api/filing/validate", content=b" " * 262_145, headers=HEADERS)
    assert result.status_code == 413
    assert result.headers["cache-control"] == "private, no-store"
    monkeypatch.delenv("FLIGHT_SERVICE_TOKEN")
    result = client.get("/api/filing/drafts", headers=HEADERS)
    assert result.status_code == 503
    assert result.headers["cache-control"] == "private, no-store"
    assert not calls


def test_native_prepare_execute_schema_and_receipt(api):
    client, calls = api
    plan = dict(
        flight_rules="VFR",
        aircraft_identifier="N123AB",
        aircraft_type="C172",
        departure="KPAO",
        destination="KSQL",
        departure_instant=(NOW + timedelta(hours=4)).isoformat(),
        flight_duration_minutes=60,
        route="DCT",
        aircraft_equipment="S",
        surveillance_equipment="C",
        fuel_minutes=180,
        pilot_data="Fixture Pilot",
        people_on_board="2",
        speed_knots=110,
        altitude_type="A",
        altitude_value=35,
    )
    assert client.post("/api/filing/validate", json=plan, headers=HEADERS).json()["format_valid"]
    result = client.post(
        "/api/filing/drafts", json={"account": "pilot@example.test", "plan": plan}, headers=HEADERS
    )
    assert result.status_code == 201, result.text
    draft = result.json()
    review = client.post(
        "/api/filing/actions/prepare",
        json={"draft_id": draft["id"], "revision": 1, "action": "file"},
        headers=HEADERS,
    )
    assert review.status_code == 200, review.text
    assert not calls
    body = {
        "confirmation_token": review.json()["confirmation_token"],
        "idempotency_key": "api-fixture-idempotency",
        "action": "file",
        "environment": "lab",
    }
    result = client.post("/api/filing/actions/execute", json=body, headers=HEADERS)
    assert result.status_code == 200, result.text
    receipt = result.json()
    assert receipt["status"] == "accepted"
    assert not {"request", "identity", "idempotency_key"} & receipt.keys()
    assert client.post("/api/filing/actions/execute", json=body, headers=HEADERS).json() == receipt
    assert len(calls) == 1
    assert client.get("/api/filing/filings", headers=HEADERS).json()[0]["snapshot"] is None
    assert (
        client.get("/api/filing/audit/" + receipt["id"], headers=HEADERS).json()[-1]["event"]
        == "provider_accepted"
    )
    schema = client.get("/openapi.json").json()
    assert schema["paths"]["/api/filing/actions/execute"]["post"]["security"] == [
        {"FlightServiceBearer": []}
    ]
    assert schema["components"]["schemas"]["Execute"]["additionalProperties"] is False
