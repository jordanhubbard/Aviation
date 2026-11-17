"""Possible numeric evidence must guide correction without admitting a claim."""

import copy
import json

import pytest

from app.services.aircraft_library.models import (
    ModelUnavailable,
    _numeric_excerpt_options,
    citation_excerpts,
    verified_completion,
)
from .test_library_correction_schema import model, response
from .test_library_numeric_layout import source


@pytest.mark.parametrize("mode", ["correct", "reason_only", "wrong_fact"])
def test_correction_must_select_missing_source_in_actual_json(mode):
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
        result = response([replacement])
        if mode == "reason_only":
            value = result.json()
            content = json.loads(value["choices"][0]["message"]["content"])
            content["reason"] = "Added passage 9, excerpt 0."
            value["choices"][0]["message"]["content"] = json.dumps(content)
            result = type(result)(200, json=value)
        return result

    if mode == "correct":
        accepted = verified_completion(model(provider), evidence, "Summarize", max_attempts=2)
        assert accepted["claims"][0]["text"] == kept["text"]
        assert accepted["claims"][1]["text"] == failed["text"]
        assert len(accepted["claims"][1]["citations"]) == 8
        assert accepted["claims"][1]["citations"][0]["quote"] == "Temperature is 34 C."
    else:
        with pytest.raises(ModelUnavailable, match="numeric values"):
            verified_completion(model(provider), evidence, "Summarize", max_attempts=2)
    assert len(calls) == 2


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
