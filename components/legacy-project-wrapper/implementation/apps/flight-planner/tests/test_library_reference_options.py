"""Reference availability is a bounded repair hint, never a validation waiver."""

import copy
import json

import pytest

from app.services.aircraft_library.models import (
    ModelUnavailable,
    _reference_options,
    _rejected_claims,
    model_evidence,
    validate_answer,
    verified_completion,
)
from app.services.aircraft_library.ocr_reviews import VerifiedOCR
from .test_library_correction_schema import model, response


def source(text="Power limit is 100 hp.", identifier=1):
    return {
        "document_id": "doc_reference",
        "passage_id": identifier,
        "page": 1,
        "label": "1",
        "method": "text",
        "text": text,
    }


def claim(citation=None, text="Power limit is 100 hp."):
    return {"text": text, "citations": [citation or {"passage_id": 1, "excerpt_id": 1}]}


def candidate(value):
    return {"insufficient_evidence": False, "reason": "", "claims": [value]}


def test_unavailable_excerpt_names_only_actual_request_availability_without_accepting_it():
    evidence = [source()]
    proposed = claim()
    before = copy.deepcopy((evidence, proposed))
    hint = _reference_options(proposed, evidence)
    assert hint == [
        {
            "citation_number": 1,
            "passage_id": 1,
            "proposed_excerpt_id": 1,
            "reason": "unavailable_excerpt",
            "available_excerpt_count": 1,
            "provided_excerpt_ids": [0],
            "quotable_excerpt_ids": [0],
            "truncated": False,
        }
    ]
    with pytest.raises(ModelUnavailable, match="citation not present"):
        validate_answer(candidate(proposed), evidence)
    assert (evidence, proposed) == before


@pytest.mark.parametrize("value", [True, False, "private-id", -1, 2**100, None, 1.5])
def test_invalid_id_values_are_not_echoed_or_coerced(value):
    evidence = [source()]
    hint = _reference_options(claim({"passage_id": value, "excerpt_id": value}), evidence)[0]
    assert hint["passage_id"] is None and hint["proposed_excerpt_id"] is None
    assert hint["reason"] == "unavailable_passage"
    assert hint["available_passage_ids"] == [1]
    assert hint["provided_excerpt_ids"] == hint["quotable_excerpt_ids"] == []


def test_request_and_excerpt_lists_are_bounded_and_explicitly_truncated():
    evidence = [source("A" * 16000, identifier=i) for i in range(1, 13)]
    hint = _reference_options(claim({"passage_id": 1, "excerpt_id": 99}), evidence)[0]
    assert hint["available_excerpt_count"] == 16 and hint["truncated"]
    assert hint["provided_excerpt_ids"] == hint["quotable_excerpt_ids"] == list(range(8))
    hint = _reference_options(claim({"passage_id": 999, "excerpt_id": 0}), evidence)[0]
    assert hint["available_passage_count"] == 12 and hint["passages_truncated"]
    assert hint["available_passage_ids"] == list(range(1, 9))
    assert (
        len(_reference_options({"citations": [{"passage_id": 1, "excerpt_id": 99}] * 8}, evidence))
        == 8
    )
    assert (
        _reference_options({"citations": [{"passage_id": 1, "excerpt_id": 99}] * 9}, evidence)
        is None
    )


def test_hints_never_copy_source_metadata_quotes_or_extra_id_fields():
    evidence = [
        {
            **source("A private source sentence."),
            "metadata": {"notes": "private-metadata", "other_id": 999},
        }
    ]
    value = claim(
        {
            "passage_id": 999,
            "excerpt_id": "private-index",
            "quote": "private-quote",
            "secret": "private-extra",
        }
    )
    hint = json.dumps(_reference_options(value, evidence))
    assert "private" not in hint and "metadata" not in hint and "999]" not in hint
    assert _reference_options(claim({"passage_id": 1, "excerpt_id": 0}), evidence) is None


def test_conflicting_explicit_quote_remains_rejected():
    evidence = [source()]
    value = claim({"passage_id": 1, "excerpt_id": 0, "quote": "A different unsupported quotation."})
    assert _reference_options(value, evidence)[0]["reason"] == "conflicting_quote"
    with pytest.raises(ModelUnavailable, match="conflicts"):
        validate_answer(candidate(value), evidence)


@pytest.mark.parametrize("provenance", [None, {"review_id": "forged"}])
def test_unreviewed_short_text_cannot_gain_quote_authority_from_hints(provenance):
    evidence = [{**source("SHORT"), "ocr_review": provenance}]
    value = claim({"passage_id": 1, "excerpt_id": 0}, text="SHORT")
    hint = _reference_options(value, evidence)[0]
    assert hint["available_excerpt_count"] == 0 and hint["quotable_excerpt_ids"] == []
    with pytest.raises(ModelUnavailable):
        validate_answer(candidate(value), evidence)


def test_existing_server_verified_short_ocr_is_quotable_without_changing_capability():
    evidence = [
        {**source("SHORT"), "ocr_review": VerifiedOCR({"review_id": "synthetic-server-capability"})}
    ]
    hint = _reference_options(claim({"passage_id": 1, "excerpt_id": 1}), evidence)[0]
    assert hint["provided_excerpt_ids"] == hint["quotable_excerpt_ids"] == [0]


@pytest.mark.parametrize("output", ["json_schema", "json_object"])
@pytest.mark.parametrize("repair", ["correct", "unchanged", "unsupported_number"])
def test_provider_must_actually_correct_reference_and_passing_claims_stay_exact(output, repair):
    evidence = [source()]
    retained = claim({"passage_id": 1, "excerpt_id": 0})
    rejected = claim()
    calls = []
    wire = copy.deepcopy(model_evidence(evidence))

    def provider(request):
        payload = json.loads(request.content)
        user = json.loads(payload["messages"][-1]["content"])
        assert user["evidence"] == wire
        calls.append(user["question"])
        if len(calls) == 1:
            return response([retained, rejected])
        feedback = json.loads(user["question"].rsplit("\n", 1)[-1])
        assert len(feedback["rejected_claims"]) == 1
        failure = feedback["rejected_claims"][0]
        assert failure["claim_number"] == 2
        assert failure["citation_reference_options"][0]["quotable_excerpt_ids"] == [0]
        replacement = copy.deepcopy(rejected)
        if repair != "unchanged":
            replacement["citations"][0]["excerpt_id"] = 0
        if repair == "unsupported_number":
            replacement["text"] = "Power limit is 999 hp."
        if output == "json_schema":
            shape = payload["response_format"]["json_schema"]["schema"]["properties"]
            assert shape["claims"]["minItems"] == shape["claims"]["maxItems"] == 1
        return response([replacement])

    models = model(provider, output)
    options = copy.deepcopy(models.generation_options)
    if repair == "correct":
        value = verified_completion(
            models, evidence, "Summarize this supplied evidence", max_attempts=2
        )
        expected = validate_answer(candidate(retained), evidence)["claims"][0]
        assert value["claims"] == [expected, expected]
    else:
        with pytest.raises(ModelUnavailable):
            verified_completion(
                models, evidence, "Summarize this supplied evidence", max_attempts=2
            )
    assert len(calls) == 2 and models.generation_options == options
    assert _rejected_claims(candidate(retained), evidence) is None


@pytest.mark.parametrize(
    "value", [True, False, "private-index", -1, 2**100, None, 1.5, float("inf")]
)
def test_invalid_excerpt_ids_do_not_echo_arbitrary_values(value):
    evidence = [source()]
    proposed = claim({"passage_id": 1, "excerpt_id": value})
    hint = _reference_options(proposed, evidence)[0]
    assert hint["passage_id"] == 1 and hint["proposed_excerpt_id"] is None
    assert hint["reason"] == "unavailable_excerpt"
    assert hint["provided_excerpt_ids"] == hint["quotable_excerpt_ids"] == [0]
    with pytest.raises(ModelUnavailable):
        validate_answer(candidate(proposed), evidence)


@pytest.mark.parametrize(
    "quote", [None, True, "An unsupported private quotation.", {"private": "value"}]
)
def test_unquotable_quote_without_excerpt_index_still_fails(quote):
    evidence = [source()]
    proposed = claim({"passage_id": 1, "quote": quote})
    hint = _reference_options(proposed, evidence)[0]
    assert hint["reason"] == "unquotable_quote"
    assert "private" not in json.dumps(hint)
    with pytest.raises(ModelUnavailable):
        validate_answer(candidate(proposed), evidence)
