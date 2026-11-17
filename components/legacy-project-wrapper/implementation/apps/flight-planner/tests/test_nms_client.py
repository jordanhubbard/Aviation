"""Wire contract, credential boundaries and failure handling for the NMS adapter."""

import base64

import httpx
import pytest

from app.services.nms_client import NMSClient, NMSUnavailable

KEY, SECRET = "fixture-client", "fixture-secret"


def client(handler, **kwargs):
    return NMSClient(
        "staging",
        KEY,
        SECRET,
        transport=httpx.MockTransport(handler),
        pause=lambda _: None,
        **kwargs,
    )


def token(value="first", expires="1799"):
    return httpx.Response(200, json={"access_token": value, "expires_in": expires})


def test_distinct_basic_credentials_form_and_cached_bearer():
    seen = []

    def handler(request):
        seen.append(request)
        assert request.url.host == "api-staging.cgifederal-aim.com"
        if request.url.path == "/v1/auth/token":
            assert (
                base64.b64decode(request.headers["authorization"].split()[1]).decode()
                == KEY + ":" + SECRET
            )
            assert request.content == b"grant_type=client_credentials"
            assert request.headers["content-type"] == "application/x-www-form-urlencoded"
            return token()
        assert request.url.path == "/nmsapi/v1/notams"
        assert request.url.params["location"] == "KPAO"
        assert request.headers["authorization"] == "Bearer first"
        assert request.headers["nmsResponseFormat"] == "GEOJSON"
        assert KEY not in str(request.url) and SECRET not in str(request.url)
        return httpx.Response(200, json={"status": "Success", "data": {"geojson": []}})

    c = client(handler)
    try:
        assert c.get_json("notams", params={"location": "KPAO"}) == {"geojson": []}
        c.get_json("notams", params={"location": "KPAO"})
        assert len(seen) == 3
    finally:
        c.close()
    assert c._token is None


def test_expiry_refreshes_before_data_and_401_retries_once():
    now = [0]
    auths, gets = [], []

    def handler(request):
        if request.method == "POST":
            auths.append(request)
            return token(str(len(auths)), "100")
        gets.append(request.headers["authorization"])
        if len(gets) in [2, 4, 5]:
            return httpx.Response(401, text=SECRET)
        return httpx.Response(200, json={"status": "Success", "data": {"geojson": []}})

    c = client(handler, clock=lambda: now[0])
    c.get_json("notams")
    now[0] = 91
    c.get_json("notams")
    assert gets == ["Bearer 1", "Bearer 2", "Bearer 3"]
    assert len(auths) == 3
    with pytest.raises(NMSUnavailable, match="HTTP 401") as error:
        c.get_json("notams")
    assert SECRET not in str(error.value)
    assert len(gets) == 5 and len(auths) == 4
    c.close()


def test_rate_limit_retains_retry_after_without_blind_retry():
    calls = []

    def handler(request):
        calls.append(request)
        return (
            token()
            if request.method == "POST"
            else httpx.Response(429, headers={"Retry-After": "600"}, text=SECRET)
        )

    c = client(handler)
    with pytest.raises(NMSUnavailable) as error:
        c.get_json("notams")
    assert error.value.status == 429 and error.value.retry_after == 600
    assert len(calls) == 2 and SECRET not in str(error.value)
    c.close()


@pytest.mark.parametrize("status", [301, 302, 307, 308])
def test_auth_redirects_never_receive_credentials(status):
    seen = []

    def handler(request):
        seen.append(request)
        return httpx.Response(status, headers={"Location": "https://untrusted.example/steal"})

    c = client(handler)
    with pytest.raises(NMSUnavailable):
        c.get_json("notams")
    assert len(seen) == 1
    c.close()


@pytest.mark.parametrize(
    "payload",
    [
        {"status": "Failure", "data": {"geojson": []}},
        {"status": "Success", "errors": [{"message": SECRET}], "data": {"geojson": []}},
        {"status": "Success", "data": []},
        [],
    ],
)
def test_partial_failed_or_malformed_envelopes_are_unavailable(payload):
    c = client(lambda r: token() if r.method == "POST" else httpx.Response(200, json=payload))
    with pytest.raises(NMSUnavailable, match="invalid or partial") as error:
        c.get_json("notams")
    assert SECRET not in str(error.value)
    c.close()


@pytest.mark.parametrize(
    "value,expires", [("bad\nheader", 100), ("ok", True), ("ok", "nan"), ("ok", 0), ("", 100)]
)
def test_malformed_token_envelope_never_reaches_data(value, expires):
    calls = []

    def handler(request):
        calls.append(request)
        return token(value, expires)

    c = client(handler)
    with pytest.raises(NMSUnavailable, match="invalid token envelope"):
        c.get_json("notams")
    assert len(calls) == 1
    c.close()


def test_decoded_response_bound_and_redacted_connection_error():
    c = client(lambda r: httpx.Response(200, content=b"a" * 65537))
    with pytest.raises(NMSUnavailable, match="allowed size"):
        c.get_json("notams")
    c.close()

    def fail(request):
        raise httpx.ConnectError("leaked upstream " + SECRET, request=request)

    c = client(fail)
    with pytest.raises(NMSUnavailable, match="connection failed") as error:
        c.get_json("notams")
    assert SECRET not in str(error.value)
    c.close()


@pytest.mark.parametrize(
    "path",
    [
        "https://evil.example/nmsapi/v1/content/a",
        "//evil.example/nmsapi/v1/content/a",
        "/nmsapi/v1/content/../other",
        "/nmsapi/v1/content/a?token=secret",
        "/nmsapi/v1/content/a#fragment",
        "/nmsapi/v1/content/%2e%2e",
        "/nmsapi/v1/content/",
        "//[invalid",
    ],
)
def test_content_paths_cannot_redirect_authorization(path):
    c = client(lambda r: pytest.fail("validation must not make requests"))
    with pytest.raises(NMSUnavailable):
        c.content_path(path)
    assert (
        c.content_path("/nmsapi/v1/content/opaque_token-123=")
        == "/nmsapi/v1/content/opaque_token-123="
    )
    c.close()


def test_http_date_retry_after_is_retained_without_echoing_headers():
    c = client(
        lambda r: (
            token()
            if r.method == "POST"
            else httpx.Response(429, headers={"Retry-After": "Thu, 01 Jan 1970 00:05:00 GMT"})
        ),
        wall_clock=lambda: 0,
    )
    with pytest.raises(NMSUnavailable) as error:
        c.get_json("notams")
    assert error.value.retry_after == 300
    c.close()


def test_wire_requests_are_spaced_including_auth_refresh():
    now, seen = [0.0], []

    def pause(seconds):
        now[0] += seconds

    def handler(request):
        seen.append(now[0])
        return (
            token()
            if request.method == "POST"
            else httpx.Response(200, json={"status": "Success", "data": {}})
        )

    c = NMSClient(
        "staging",
        KEY,
        SECRET,
        transport=httpx.MockTransport(handler),
        clock=lambda: now[0],
        pause=pause,
    )
    c.get_json("notams")
    c.get_json("notams")
    assert seen == [0, 1.05, 2.1]
    c.close()
