"""Possible numeric evidence must guide correction without admitting a claim."""

import copy
import json
from concurrent.futures import ThreadPoolExecutor
from threading import Barrier

import pytest

from app.services.aircraft_library.models import (
    ModelUnavailable,
    _numeric_excerpt_options,
    citation_excerpts,
    verified_completion,
)
from .test_library_correction_schema import model, response
from .test_library_numeric_layout import source


@pytest.mark.parametrize("mode", ["correct", "reason_only", "wrong_fact", "shrink"])
@pytest.mark.parametrize("output", ["json_schema", "json_object"])
def test_correction_must_select_missing_source_in_actual_json(mode, output):
    evidence = [
        {**source(f"Unrelated record {i} has value 0."), "passage_id": i} for i in range(1, 9)
    ] + [{**source("Temperature is 34 C."), "passage_id": 9}]
    kept = {"text": "A record has value 0.", "citations": [{"passage_id": 1, "excerpt_id": 0}]}
    failed = {
        "text": "Temperature is 34 C.",
        "citations": [{"passage_id": i, "excerpt_id": 0} for i in range(1, 9)],
    }
    calls = []

    def provider(request):
        payload = json.loads(request.content)
        question = json.loads(payload["messages"][-1]["content"])["question"]
        calls.append(question)
        if len(calls) == 1:
            assert "numeric_evidence_options" not in question
            return response([kept, failed])
        feedback = json.loads(question.rsplit("\n", 1)[-1])
        assert feedback["rejected_claims"][0]["citation_only"]
        if output == "json_schema":
            shape = payload["response_format"]["json_schema"]["schema"]
            assert shape["properties"]["claims"]["items"]["properties"]["text"]["enum"] == [
                failed["text"]
            ]
        options = feedback["rejected_claims"][0]["numeric_evidence_options"]
        assert options == {
            "matches": [{"passage_id": 9, "excerpt_id": 0, "numeric_values": ["34"]}],
            "limited": False,
        }
        replacement = copy.deepcopy(failed)
        if mode != "reason_only":
            replacement["citations"][0] = {"passage_id": 9, "excerpt_id": 0}
        if mode == "wrong_fact":
            replacement["text"] = "Temperature is 35 C."
        if mode == "shrink":
            replacement["text"] = "Temperature is 3 C."
        result = response([replacement])
        if mode == "reason_only":
            value = result.json()
            content = json.loads(value["choices"][0]["message"]["content"])
            content["reason"] = "Added passage 9, excerpt 0."
            value["choices"][0]["message"]["content"] = json.dumps(content)
            result = type(result)(200, json=value)
        return result

    if mode == "correct":
        accepted = verified_completion(
            model(provider, output), evidence, "Summarize", max_attempts=2
        )
        assert accepted["claims"][0]["text"] == kept["text"]
        assert accepted["claims"][1]["text"] == failed["text"]
        assert len(accepted["claims"][1]["citations"]) == 8
        assert accepted["claims"][1]["citations"][0]["quote"] == "Temperature is 34 C."
    else:
        message = "citation-only" if mode in {"wrong_fact", "shrink"} else "numeric values"
        with pytest.raises(ModelUnavailable, match=message):
            verified_completion(model(provider, output), evidence, "Summarize", max_attempts=2)
    assert len(calls) == 2


@pytest.mark.parametrize("endpoint", ["34", "34.0"])
def test_shortened_range_does_not_replace_original_before_the_last_attempt(endpoint):
    evidence = [
        source("Pages 1 through 33 are listed."),
        {**source("Page 34 is also listed."), "passage_id": 2},
    ]
    original = {
        "text": f"Pages 1 through {endpoint} are listed.",
        "citations": [{"passage_id": 1, "excerpt_id": 0}],
    }
    calls = []

    def provider(request):
        payload = json.loads(request.content)
        question = json.loads(payload["messages"][-1]["content"])["question"]
        calls.append(question)
        claim = copy.deepcopy(original)
        if len(calls) == 2:
            claim["text"] = "Pages 1 through 33 are listed."
        if len(calls) == 3:
            feedback = json.loads(question.rsplit("\n", 1)[-1])
            rejected = feedback["rejected_claims"][0]
            assert rejected["claim"]["text"] == original["text"]
            assert rejected["citation_only"]
            claim["citations"].append({"passage_id": 2, "excerpt_id": 0})
        return response([claim])

    result = verified_completion(model(provider), evidence, "Summarize")
    assert result["claims"][0]["text"] == original["text"]
    assert len(result["claims"][0]["citations"]) == 2
    assert len(calls) == 3


@pytest.mark.parametrize("adapter", ["two_args", "count_only", "three_arg_replacements"])
def test_legacy_adapters_cannot_bypass_exact_text_preservation(adapter):
    evidence = [source("Pages 1 through 33 are listed. Page 34 is also listed.")]
    original = {
        "text": "Pages 1 through 34 are listed.",
        "citations": [{"passage_id": 1, "quote": "Pages 1 through 33 are listed."}],
    }
    calls = []
    models = model(lambda request: pytest.fail("Legacy adapter bypassed"))

    def legacy(rows, question):
        calls.append(question)
        claim = copy.deepcopy(original)
        if len(calls) > 1:
            claim["text"] = "Pages 1 through 33 are listed."
        return {"insufficient_evidence": False, "reason": "", "claims": [claim]}

    if adapter == "count_only":

        def count_only(rows, question, *, replacement_count=None):
            return legacy(rows, question)

        models.complete = count_only
    else:
        models.complete = legacy
    if adapter == "three_arg_replacements":
        models.complete_replacements = lambda rows, question, count: legacy(rows, question)
    with pytest.raises(ModelUnavailable, match="citation-only"):
        verified_completion(models, evidence, "Summarize", max_attempts=2)
    assert len(calls) == 2


@pytest.mark.parametrize("swap", [False, True])
def test_mixed_general_and_citation_only_repairs_keep_their_original_positions(swap):
    evidence = [source("Power is 100 hp."), {**source("Temperature is 34 C."), "passage_id": 2}]
    initial = [
        {"text": "Temperature is 34 C.", "citations": [{"passage_id": 1, "excerpt_id": 0}]},
        {"text": "Power is 999 hp.", "citations": [{"passage_id": 1, "excerpt_id": 0}]},
    ]
    repaired = [
        {"text": "Temperature is 34 C.", "citations": [{"passage_id": 2, "excerpt_id": 0}]},
        {"text": "Power is 100 hp.", "citations": [{"passage_id": 1, "excerpt_id": 0}]},
    ]
    calls = []

    def provider(request):
        payload = json.loads(request.content)
        calls.append(payload)
        if len(calls) == 1:
            return response(initial)
        shape = payload["response_format"]["json_schema"]["schema"]
        assert "enum" not in shape["properties"]["claims"]["items"]["properties"]["text"]
        return response(list(reversed(repaired)) if swap else repaired)

    if swap:
        with pytest.raises(ModelUnavailable, match="citation-only"):
            verified_completion(model(provider), evidence, "Summarize", max_attempts=2)
    else:
        result = verified_completion(model(provider), evidence, "Summarize", max_attempts=2)
        assert [c["text"] for c in result["claims"]] == [c["text"] for c in repaired]
    assert len(calls) == 2


def test_citation_only_schema_is_isolated_between_concurrent_and_ordinary_requests():
    rendezvous = Barrier(2)
    texts = {"temperature": "Temperature is 34 C.", "power": "Power is 100 hp."}
    evidence = [source("Temperature is 34 C. Power is 100 hp.")]

    def provider(request):
        payload = json.loads(request.content)
        question = json.loads(payload["messages"][-1]["content"])["question"]
        shape = payload["response_format"]["json_schema"]["schema"]["properties"]["claims"]
        if question in texts:
            rendezvous.wait(timeout=10)
            assert shape["items"]["properties"]["text"]["enum"] == [texts[question]]
            assert shape["minItems"] == shape["maxItems"] == 1
        else:
            assert "enum" not in shape["items"]["properties"]["text"]
            assert "minItems" not in shape and shape["maxItems"] == 12
        return response(
            [
                {
                    "text": texts.get(question, texts["power"]),
                    "citations": [{"passage_id": 1, "excerpt_id": 0}],
                }
            ]
        )

    models = model(provider)
    before = copy.deepcopy(models.generation_options)
    with ThreadPoolExecutor(max_workers=2) as pool:
        futures = [
            pool.submit(models.complete_replacements, evidence, q, 1, replacement_texts=[text])
            for q, text in texts.items()
        ]
        for future in futures:
            assert len(future.result()["claims"]) == 1
    models.complete(evidence, "ordinary")
    assert models.generation_options == before


def test_options_preserve_sign_and_ignore_metadata_and_missing_passages():
    evidence = [source("Temperature is −34 C. Maximum value is 340.")]
    evidence[0]["metadata"]["notes"] = "Temperature is 34 C."
    assert _numeric_excerpt_options(["34"], evidence) == {"matches": [], "limited": False}
    assert _numeric_excerpt_options(["-34"], evidence)["matches"] == [
        {"passage_id": 1, "excerpt_id": 0, "numeric_values": ["-34"]}
    ]


def test_options_point_to_the_actual_later_excerpt_without_copying_text():
    evidence = [source("Ordinary source text. " * 70 + "Temperature is 34 C.")]
    options = _numeric_excerpt_options(["34"], evidence)
    assert options["matches"]
    for option in options["matches"]:
        assert option["excerpt_id"] > 0
        assert "34" in citation_excerpts(evidence[0]["text"])[option["excerpt_id"]]
        assert set(option) == {"passage_id", "excerpt_id", "numeric_values"}


def test_options_prefer_more_gaps_and_mark_excerpt_truncation():
    evidence = [{**source("Value is 34."), "passage_id": i} for i in range(1, 11)] + [
        {**source("Values are 34 and -12."), "passage_id": 11}
    ]
    options = _numeric_excerpt_options(["34", "-12"], evidence)
    assert options["limited"] and len(options["matches"]) == 8
    assert options["matches"][0]["passage_id"] == 11
    assert options["matches"][0]["numeric_values"] == ["-12", "34"]


def test_options_bound_numeric_values_and_mark_value_truncation():
    values = [str(i) for i in range(40)]
    options = _numeric_excerpt_options(values, [source("Values " + " ".join(values) + ".")])
    assert options["limited"] and len(options["matches"]) == 1
    assert len(options["matches"][0]["numeric_values"]) == 32
