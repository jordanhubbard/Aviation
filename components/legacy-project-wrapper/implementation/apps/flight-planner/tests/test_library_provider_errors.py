"""Fixed failure classes and redaction through the actual model HTTP boundary."""

import httpx
import pytest

from app.services.aircraft_library.models import Models, ModelUnavailable

SECRET = "private-provider-value"
LIMIT = 8 * 1024 * 1024


def model(provider):
    calls = []

    def transport(request):
        calls.append(request)
        assert request.extensions["timeout"] == {
            "connect": 10,
            "read": 120,
            "write": 30,
            "pool": 10,
        }
        return provider(request)

    return (
        Models(
            {
                "AIRCRAFT_LIBRARY_LLM_BASE_URL": "https://models.example/v1",
                "AIRCRAFT_LIBRARY_LLM_API_KEY": SECRET,
            },
            transport=httpx.MockTransport(transport),
        ),
        calls,
    )


def refused(provider, expected):
    models, calls = model(provider)
    with pytest.raises(ModelUnavailable) as caught:
        models.post("/chat/completions", {"private_input": SECRET})
    assert str(caught.value) == expected
    assert SECRET not in str(caught.value) and "models.example" not in str(caught.value)
    assert len(calls) == 1


@pytest.mark.parametrize(
    "error_type", [httpx.ConnectError, httpx.RemoteProtocolError, httpx.DecodingError]
)
def test_transport_failure_category_is_fixed_redacted_and_not_retried(error_type):
    def provider(request):
        raise error_type(SECRET + " https://models.example/private", request=request)

    refused(provider, "Aircraft library model provider transport failed")


@pytest.mark.parametrize("body", [SECRET.encode(), b"\xff"])
def test_invalid_json_category_omits_body_and_is_not_retried(body):
    refused(
        lambda request: httpx.Response(200, content=body),
        "Aircraft library model provider returned invalid JSON",
    )


def test_oversized_body_is_classified_before_json_despite_small_declared_length():
    def provider(request):
        response = httpx.Response(200, content=b" " * (LIMIT + 1), headers={"Content-Length": "1"})
        response.json = lambda: pytest.fail("Oversized responses must not be parsed")
        return response

    refused(provider, "Aircraft library model response exceeded the byte limit")


def test_exact_response_byte_limit_remains_accepted():
    models, calls = model(lambda request: httpx.Response(200, content=b" " * (LIMIT - 2) + b"{}"))
    assert models.post("/chat/completions", {}) == {}
    assert len(calls) == 1


def test_http_status_retains_original_message_without_provider_body_or_retry():
    refused(
        lambda request: httpx.Response(503, text=SECRET),
        "Aircraft library model provider failed (HTTP 503)",
    )


def test_timeout_retains_original_message_and_budget_without_transport_details():
    def provider(request):
        raise httpx.ReadTimeout(SECRET, request=request)

    refused(
        provider,
        "Aircraft library model provider timed out (ReadTimeout; configured read limit 120 seconds)",
    )


def test_unclassified_value_error_remains_generic_and_redacted():
    def provider(request):
        raise ValueError(SECRET)

    refused(provider, "Aircraft library model provider failed")
