"""Exercise the shipped factory and real HTTP adapter with deterministic wire failures."""

import httpx
import pytest
from fastapi.testclient import TestClient

from app import create_app
from app.config import Settings
from app.routers.navigation import NavigationResult, NavigationService
from app.services.nav_database import NavigationDatabaseService
from app.services.procedures import ProceduresService


def wire():
    return {
        "airport": "KSFO",
        "total": 1,
        "page": 1,
        "limit": 20,
        "procedures": [
            {
                "record": {
                    "identifier": "TEST1",
                    "airport_icao": "KSFO",
                    "procedure_type": "SID",
                    "runway": None,
                    "initial_altitude_ft": None,
                    "transitions": [],
                    "legs": [
                        {
                            "fix": "TEST",
                            "path_type": "TF",
                            "altitude_constraint": "FL180",
                            "speed_constraint": None,
                            "altitude_ft": None,
                            "course_deg": None,
                        }
                    ],
                },
                "provider": {
                    "id": "synthetic-source-one",
                    "route_type": "1",
                    "records": [
                        {
                            "fields": {"Altitude": "FL180"},
                            "raw": "synthetic ARINC source",
                            "primary": True,
                        }
                    ],
                    "omitted_from_common_legs": 1,
                    "usage": "Reference; incomplete guidance",
                },
            }
        ],
        "status": {"metadata": {"source": "synthetic-test-source"}},
        "source": {
            "cycle": "synthetic-cycle",
            "url": "https://example.test/fixture.zip",
            "effective_from": "2026-10-29T09:01:00Z",
            "effective_to": "2026-11-26T09:01:00Z",
            "retrieved_at": "2026-11-16T20:00:00Z",
            "records_sha256": "a" * 64,
            "freshness": "current",
            "verification_state": "verified",
            "source_checked_at": "2026-11-16T20:00:00Z",
        },
        "parse_receipt": {"rejected": [], "unknown_constraints": ["pressure altitude"]},
        "navaids": [],
        "limitations": "Missing values remain unknown. Incomplete guidance.",
    }


def client(handler):
    service = NavigationService(
        "https://planning.test/api/v1/planning", transport=httpx.MockTransport(handler)
    )
    return TestClient(
        create_app(Settings(_env_file=None, stream_api_key=None), navigation_service=service)
    )


def test_shipped_factory_no_startup_fetch_preserves_source_unknowns_and_legacy_context():
    calls = []

    def handler(request):
        calls.append(request)
        assert request.url.path == "/api/v1/planning/api/navigation/KSFO"
        assert request.url.params["limit"] == "20"
        assert request.headers["accept-encoding"] == "identity"
        assert "authorization" not in request.headers and "cookie" not in request.headers
        return httpx.Response(200, json=wire())

    with client(handler) as http:
        assert calls == []
        assert http.get("/api/health").status_code == 200
        assert calls == []
        response = http.get(
            "/api/navigation/ksfo?limit=20",
            headers={
                "Authorization": "Bearer caller-private-key",
                "Cookie": "private=not-forwarded",
            },
        )
        assert response.status_code == 200
        assert response.json() == wire()
        legacy = http.get("/api/procedures/KSFO?limit=20").json()
        assert legacy["airport_identifier"] == "KSFO"
        assert legacy["navigation"] == wire()
        assert legacy["sids"][0]["initial_altitude"] is None
        assert legacy["sids"][0]["waypoints"] == ["TEST"]
        schema = http.get("/openapi.json").json()
        assert schema["paths"]["/api/navigation/{airport}"]["get"]["responses"]["200"]["content"][
            "application/json"
        ]["schema"]["$ref"].endswith("/NavigationResult")
        assert "/api/procedures/{airport}" in schema["paths"]


@pytest.mark.parametrize("status", [301, 401, 404, 429, 500, 503])
def test_failed_or_redirected_provider_never_becomes_empty_success(status):
    calls = []

    def handler(request):
        calls.append(request)
        return httpx.Response(
            status,
            headers={"Location": "https://untrusted.test/redirect"},
            text="private upstream diagnostic must not leak",
        )

    with client(handler) as http:
        r = http.get("/api/navigation/KSFO?limit=20")
        assert r.status_code == 503
        assert str(status) in r.json()["detail"]
        assert "private upstream" not in r.text
        assert "procedures" not in r.json()
        assert len(calls) == 1


@pytest.mark.parametrize(
    "change",
    [
        "wrong_airport",
        "wrong_child_airport",
        "wrong_page",
        "wrong_limit",
        "truncated",
        "unknown_zero",
        "bad_total",
        "missing_page_record",
        "huge",
    ],
)
def test_invalid_payload_refused(change):
    value = wire()
    if change == "wrong_airport":
        value["airport"] = "KPAO"
    if change == "wrong_child_airport":
        value["procedures"][0]["record"]["airport_icao"] = "KPAO"
    if change == "wrong_page":
        value["page"] = 2
    if change == "wrong_limit":
        value["limit"] = 50
    if change == "truncated":
        del value["procedures"][0]["provider"]["records"]
    if change == "unknown_zero":
        value["procedures"][0]["record"]["legs"][0]["altitude_ft"] = "unknown"
    if change == "bad_total":
        value["total"] = -1
    if change == "missing_page_record":
        value["total"] = 21
    if change == "huge":
        value["extra"] = "x" * (16 * 1024 * 1024)
    with client(lambda _: httpx.Response(200, json=value)) as http:
        r = http.get("/api/navigation/KSFO?limit=20")
        assert r.status_code == 502
        assert (
            r.json()["detail"]
            == "FAA navigation service returned invalid data; no procedure coverage is claimed"
        )


@pytest.mark.parametrize(
    "freshness,verification",
    [
        ("expired", "verified"),
        ("future", "verified"),
        ("cached-unverified", "cached-unverified"),
        ("source-unavailable", "source-unavailable"),
        ("current", "cached-unverified"),
    ],
)
def test_unverified_cycle_refused(freshness, verification):
    value = wire()
    value["source"].update(freshness=freshness, verification_state=verification)
    with client(lambda _: httpx.Response(200, json=value)) as http:
        assert http.get("/api/navigation/KSFO?limit=20").status_code == 503


def test_timeout_has_no_retry_or_sample_result():
    calls = []

    def handler(request):
        calls.append(request)
        raise httpx.ReadTimeout("private exception detail", request=request)

    with client(handler) as http:
        r = http.get("/api/navigation/KSFO?limit=20")
        assert r.status_code == 503 and "private exception" not in r.text
        assert len(calls) == 1


@pytest.mark.parametrize(
    "path",
    [
        "/api/navigation/KSFO?page=0",
        "/api/navigation/KSFO?limit=51",
        "/api/navigation/XX",
        "/api/navigation/KSFO?procedure_type=BAD",
        "/api/navigation/KSFO?runway=too-long",
    ],
)
def test_bounds_fail_before_transport(path):
    calls = []
    with client(lambda r: calls.append(r)) as http:
        assert http.get(path).status_code == 422
        assert calls == []


def test_zero_matches_requires_valid_current_envelope_and_next_page_filters_preserved():
    def handler(request):
        value = wire()
        value.update(page=2, total=0, procedures=[])
        assert dict(request.url.params) == {
            "page": "2",
            "limit": "20",
            "procedure_type": "SID",
            "runway": "28L",
            "query": "SFO",
        }
        return httpx.Response(200, json=value)

    with client(handler) as http:
        r = http.get("/api/navigation/KSFO?page=2&limit=20&procedure_type=SID&runway=28L&query=SFO")
        assert r.status_code == 200 and r.json()["procedures"] == []
        assert r.json()["total"] == 0


def test_dormant_services_do_not_default_to_samples():
    service = NavigationDatabaseService()
    assert service.search("SFO")["navigation_status"] == "unavailable"
    with pytest.raises(ValueError, match="No sourced navigation catalog"):
        service.get_procedures("KSFO")
    with pytest.raises(ValueError, match="No sourced navigation catalog"):
        ProceduresService().get_sid("KSFO")


def test_legacy_entrypoint_uses_same_sourced_adapter(monkeypatch):
    async def injected(self, airport, **kwargs):
        value = wire()
        value["limit"] = kwargs["limit"]
        return NavigationResult.model_validate(value)

    monkeypatch.setattr(NavigationService, "read", injected)
    from app.main import app

    with TestClient(app) as http:
        r = http.get("/api/procedures/KSFO?limit=20")
        assert r.status_code == 200 and r.json()["navigation"] == wire()


@pytest.mark.parametrize("mode", ["bad_json", "wrong_media_type", "compressed", "missing_check"])
def test_invalid_wire_representation_and_missing_verification_refused(mode):
    def handler(request):
        if mode == "bad_json":
            return httpx.Response(200, content=b"{", headers={"content-type": "application/json"})
        if mode == "wrong_media_type":
            return httpx.Response(200, text="not a sourced result")
        if mode == "compressed":
            # A streaming response permits checking headers before any body decoding.
            class Body(httpx.AsyncByteStream):
                async def __aiter__(self):
                    raise AssertionError("Rejected encoding must not be consumed")
                    yield b""

            return httpx.Response(
                200,
                stream=Body(),
                headers={"content-type": "application/json", "content-encoding": "gzip"},
            )
        value = wire()
        value["source"]["source_checked_at"] = None
        return httpx.Response(200, json=value)

    with client(handler) as http:
        r = http.get("/api/navigation/KSFO?limit=20")
        assert r.status_code == (503 if mode == "missing_check" else 502)
