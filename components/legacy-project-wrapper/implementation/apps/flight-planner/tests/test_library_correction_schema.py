"""Structured replacement requests match the existing fail-closed protocol."""

import copy
import json
from concurrent.futures import ThreadPoolExecutor
from threading import Barrier

import httpx
import pytest

from app.services.aircraft_library.models import (
    ANSWER_SCHEMA,
    Models,
    ModelUnavailable,
    verified_completion,
)

EVIDENCE = [{
    "passage_id": 1, "document_id": "doc_correction", "page": 1, "label": "1",
    "method": "text", "metadata": {"icao": "C182"},
    "text": "Power limit is 100 hp. Fuel capacity is 20 gallons.",
}]


def claim(text):
    return {"text": text, "citations": [{"passage_id": 1, "excerpt_id": 0}]}


def response(claims):
    value = {"insufficient_evidence": False, "reason": "", "claims": claims}
    return httpx.Response(200, json={"choices": [{"message": {"content": json.dumps(value)}}]})


def model(handler, output="json_schema"):
    return Models({
        "AIRCRAFT_LIBRARY_LLM_BASE_URL": "https://models.example/v1",
        "AIRCRAFT_LIBRARY_LLM_MODEL": "structured-fixture",
        "AIRCRAFT_LIBRARY_LLM_RESPONSE_FORMAT": output,
    }, transport=httpx.MockTransport(handler))


def properties(payload):
    return payload["response_format"]["json_schema"]["schema"]["properties"]


@pytest.mark.parametrize("count", [1, 3, 12])
def test_only_rejected_positions_get_exact_structured_replacement_count(count):
    requests = []
    retained = [claim("Fuel capacity is 20 gallons.")] if count < 12 else []

    def provider(request):
        payload = json.loads(request.content)
        requests.append(payload)
        shape = properties(payload)
        if len(requests) == 2:
            assert shape["claims"]["minItems"] == shape["claims"]["maxItems"] == count
            assert shape["insufficient_evidence"] == {"type": "boolean", "enum": [False]}
            return response([claim("Power limit is 100 hp.")] * count)
        assert shape["claims"]["maxItems"] == 12
        assert "minItems" not in shape["claims"]
        assert shape["insufficient_evidence"] == {"type": "boolean"}
        if len(requests) == 1:
            return response([claim("Power limit is 999 hp.")] * count + retained)
        return response(retained or [claim("Power limit is 100 hp.")])

    before = copy.deepcopy(ANSWER_SCHEMA)
    models = model(provider)
    options = copy.deepcopy(models.generation_options)
    accepted = verified_completion(models, EVIDENCE, "Summarize", max_attempts=2)
    assert len(accepted["claims"]) == count + len(retained)
    if retained:
        assert accepted["claims"][-1]["text"] == retained[0]["text"]
    models.complete(EVIDENCE, "A later ordinary request")
    assert len(requests) == 3
    assert models.generation_options == options
    assert ANSWER_SCHEMA == before


@pytest.mark.parametrize("bad_shape", [True, False])
def test_exact_schema_never_replaces_actual_cardinality_or_source_validation(bad_shape):
    calls = []

    def provider(request):
        payload = json.loads(request.content)
        calls.append(payload)
        if len(calls) == 1:
            return response([claim("Power limit is 999 hp.")])
        assert properties(payload)["claims"]["maxItems"] == 1
        return response([claim("Power limit is 100 hp.")] * 2 if bad_shape else [claim("Power limit is 999 hp.")])

    with pytest.raises(ModelUnavailable, match="replace all 1" if bad_shape else "numeric values"):
        verified_completion(model(provider), EVIDENCE, "Summarize", max_attempts=2)
    assert len(calls) == 2


def test_plain_json_correction_keeps_existing_wire_format():
    calls = []

    def provider(request):
        payload = json.loads(request.content)
        calls.append(payload)
        assert payload["response_format"] == {"type": "json_object"}
        return response([claim("Power limit is 999 hp." if len(calls) == 1 else "Power limit is 100 hp.")])

    result = verified_completion(model(provider, "json_object"), EVIDENCE, "Summarize", max_attempts=2)
    assert result["claims"][0]["text"] == "Power limit is 100 hp."
    assert len(calls) == 2


@pytest.mark.parametrize("adapter_error", [False, True])
def test_legacy_two_argument_adapter_is_not_reinvoked_after_an_internal_type_error(adapter_error):
    calls = []
    models = model(lambda request: pytest.fail("Legacy adapter bypassed"))

    def legacy(evidence, question):
        calls.append(question)
        if len(calls) == 1:
            text = "Power limit is 999 hp."
        elif adapter_error:
            raise TypeError("Adapter failed after starting its request")
        else:
            text = "Power limit is 100 hp."
        return {"insufficient_evidence": False, "claims": [claim(text)]}

    models.complete = legacy
    if adapter_error:
        with pytest.raises(TypeError, match="Adapter failed"):
            verified_completion(models, EVIDENCE, "Summarize")
    else:
        assert verified_completion(models, EVIDENCE, "Summarize")["claims"]
    assert len(calls) == 2


def test_concurrent_corrections_do_not_change_each_other_or_initial_requests():
    barrier = Barrier(3)
    seen = []

    def provider(request):
        payload = json.loads(request.content)
        question = json.loads(payload["messages"][1]["content"])["question"]
        shape = properties(payload)
        count = int(question) if question != "normal" else None
        assert shape["claims"].get("minItems") == count
        assert shape["claims"]["maxItems"] == (count or 12)
        assert shape["insufficient_evidence"].get("enum") == ([False] if count else None)
        seen.append(question)
        barrier.wait(timeout=5)
        return response([claim("Power limit is 100 hp.")] * (count or 1))

    models = model(provider)
    before = copy.deepcopy(models.generation_options)
    with ThreadPoolExecutor(max_workers=3) as pool:
        futures = [pool.submit(models.complete_replacements, EVIDENCE, str(n), n) for n in (1, 3)]
        futures.append(pool.submit(models.complete, EVIDENCE, "normal"))
        assert [len(f.result()["claims"]) for f in futures] == [1, 3, 1]
    assert sorted(seen) == ["1", "3", "normal"]
    assert models.generation_options == before


@pytest.mark.parametrize("count", [True, False, 0, 13, "1"])
def test_invalid_replacement_count_never_reaches_provider(count):
    def provider(request):
        pytest.fail("Invalid replacement request reached provider")

    with pytest.raises(ValueError, match="one to twelve"):
        model(provider).complete_replacements(EVIDENCE, "Summarize", count)
