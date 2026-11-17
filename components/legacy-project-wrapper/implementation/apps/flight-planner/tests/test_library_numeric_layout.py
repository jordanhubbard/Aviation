"""Original dot leaders must not hide or change cited signed figures."""

from decimal import Decimal

import pytest

from app.services.aircraft_library.models import (
    ModelUnavailable,
    citation_excerpts,
    numbers,
    validate_answer,
    verified_completion,
)


@pytest.mark.parametrize(
    "text,expected",
    [
        ("Total Capacity ........94.5 U.S. Gallons (358.0 L)", {"94.5", "358.0"}),
        ("Oil Capacity (Sump) ........8 U.S. Quarts (7.6 L)", {"8", "7.6"}),
        ("Wing Loading........23.5 lb per square foot", {"23.5"}),
        ("Power Loading........11.0 lb per hp", {"11.0"}),
        ("Temperature........-12 C", {"-12"}),
        ("Temperature........−12 C", {"-12"}),
        ("Temperature −12 C", {"-12"}),
        ("Value...1,200.50 ft", {"1200.50"}),
        ("Value 12.5 ft", {"12.5"}),
        ("A1.2 and part SR22", set()),
        ("Value 12.5.7 ft", {"12.5"}),
        ("Value ..94.5 ft", set()),
    ],
)
def test_numeric_leaders_keep_complete_tokens_and_signs(text, expected):
    assert numbers(text) == {Decimal(v) for v in expected}


def source(text):
    return {
        "passage_id": 1,
        "document_id": "doc_layout",
        "page": 28,
        "label": "1-8",
        "offset": 0,
        "text": text,
        "method": "text",
        "metadata": {"icao": "SR22"},
    }


def answer(text, excerpt_id=0):
    return {
        "insufficient_evidence": False,
        "reason": "",
        "claims": [{"text": text, "citations": [{"passage_id": 1, "excerpt_id": excerpt_id}]}],
    }


def test_realistic_original_leaders_resolve_without_rewriting_citations():
    text = (
        "Fuel capacity ........94.5 U.S. Gallons (358.0 L).\n"
        "Usable fuel ........92.0 U.S. Gallons (348.0 L).\n"
        "Oil capacity ........8 U.S. Quarts (7.6 L)."
    )
    value = answer(
        "Fuel capacity is 94.5 U.S. Gallons (358.0 L) and usable fuel is 92.0 U.S. Gallons (348.0 L)."
    )
    accepted = validate_answer(value, [source(text)])
    assert accepted["claims"][0]["citations"][0]["quote"] == text
    assert accepted["claims"][0]["citations"][0]["page"] == 28
    assert accepted["claims"][0]["citations"][0]["original_url"].endswith("#page=28")


@pytest.mark.parametrize("minus", ["-", "−"])
def test_leaders_do_not_grant_positive_magnitude_for_negative_source(minus):
    evidence = [source("Minimum temperature ........" + minus + "12 C.")]
    assert validate_answer(answer("The minimum temperature is -12 C."), evidence)["claims"]
    with pytest.raises(ModelUnavailable, match="numeric values"):
        validate_answer(answer("The minimum temperature is 12 C."), evidence)


def test_unquoted_neighboring_or_metadata_numbers_do_not_gain_support():
    text = (
        "Oil Capacity ........8 U.S. Quarts (7.6 L).\n"
        + "Unrelated original explanatory text. " * 35
        + "\nOther figure ........94.5 units."
    )
    evidence = [source(text)]
    evidence[0]["metadata"]["notes"] = "Maximum value 9876"
    excerpts = citation_excerpts(text)
    assert "94.5" not in excerpts[0]
    for claim in [
        "Oil capacity is 94.5 U.S. Quarts.",
        "Maximum value is 9876.",
        "Oil capacity is 80 U.S. Quarts.",
    ]:
        with pytest.raises(ModelUnavailable, match="numeric values"):
            validate_answer(answer(claim), evidence)
    assert validate_answer(answer("Oil capacity is 8 U.S. Quarts."), evidence)["claims"]


def test_valid_leader_citation_does_not_consume_model_correction_budget():
    evidence = [source("Oil Capacity (Sump) ........8 U.S. Quarts (7.6 L).")]

    class Provider:
        calls = 0

        def complete(self, passages, question):
            self.calls += 1
            return answer("Oil capacity is 8 U.S. Quarts (7.6 L).")

    model = Provider()
    result = verified_completion(model, evidence, "Summarize exact evidence")
    assert model.calls == 1 and len(result["claims"]) == 1
