"""ISA headings disambiguate measured temperature offsets, not arbitrary signs."""

from decimal import Decimal

import pytest

from app.services.aircraft_library.models import (
    ModelUnavailable,
    _comparison_isa_temperature_offsets,
    model_evidence,
    numbers,
    validate_answer,
)


@pytest.mark.parametrize(
    "source,expected",
    [
        ("ISA - 25°C", {"-25"}),
        ("ISA − 25°C", {"-25"}),
        ("ISA – 25°C", {"-25"}),
        ("ISA + 25°C", {"25"}),
        ("ISA\t-\t25\t°C", {"-25"}),
        ("ISA - 25°c", {"-25"}),
        ("ISA - 25°F", {"-25"}),
        ("ISA - 25 °f", {"-25"}),
        ("ISA - 25.50°C", {"-25.50"}),
        ("ISA - 25 .50°C", {"-25.50"}),
        ("ISA - 25. 50°C", {"-25.50"}),
        ("ISA - 1 ,000.50°C", {"-1000.50"}),
        ("ISA - 0.50°C", {"-0.50"}),
        ("ISA - 25°C, ISA + 15°C", {"-25", "15"}),
        ("The first heading is ISA - 25°C.", {"-25"}),
    ],
)
def test_complete_isa_offsets_preserve_sign_and_full_precision(source, expected):
    assert numbers(source) == {Decimal(x) for x in expected}


@pytest.mark.parametrize(
    "source",
    [
        "- 25°C",
        "OAT - 25°C",
        "pressure - 25°C",
        "isa - 25°C",
        "ISA\n- 25°C",
        "ISA -\n25°C",
        "ISA - 25\n°C",
        "ISA - 25",
        "ISA - 25 C",
        "ISA - 25 KIAS",
        "ISA - 25°Celsius",
        "ISA - 25°C_model",
        "ISA - 25°C-model",
        "ISA - 25°C/model",
        "ISA - 25°C.model",
        "prefixISA - 25°C",
        "prefix-ISA - 25°C",
        "prefix–ISA - 25°C",
        "prefix.ISA - 25°C",
        "prefix/ISA - 25°C",
        "prefix+ISA - 25°C",
        "prefix−ISA - 25°C",
        "P/N ISA - 25°C",
        "Part No. ISA - 25°C",
        "Model ISA - 25°C",
        "code: ISA - 25°C",
        "reference # ISA - 25°C",
        "Section ISA - 25°C",
        "Fig. ISA - 25°C",
        "Table ISA - 25°C",
        "ISA -- 25°C",
        "ISA +- 25°C",
        "ISA - +25°C",
        "ISA - 25–10°C",
        "ISA - 25 to 10°C",
        "ISA - 25 through 10°C",
        "ISA - 25,10°C",
        "ISA - 25.50.10°C",
        "ISA - 25.\n50°C",
    ],
)
def test_non_offsets_identifiers_lines_units_and_malformed_values_stay_excluded(source):
    assert _comparison_isa_temperature_offsets(source) == source
    assert Decimal("-25") not in numbers(source)


def test_second_already_signed_operand_is_not_joined_to_first_sign():
    # Existing numeric token parsing sees -25; this repair must not make --25.
    source = "ISA - -25°C"
    assert _comparison_isa_temperature_offsets(source) == source
    assert numbers(source) == {Decimal("-25")}


def evidence(text):
    return {
        "document_id": "doc_isa",
        "passage_id": 1,
        "page": 1,
        "label": "1",
        "method": "text",
        "text": text,
    }


def answer(text):
    return {
        "insufficient_evidence": False,
        "reason": "",
        "claims": [{"text": text, "citations": [{"passage_id": 1, "excerpt_id": 0}]}],
    }


def test_original_source_quote_claim_and_model_evidence_remain_exact():
    source = evidence("The synthetic heading is ISA - 25. 50°C.")
    before = source.copy()
    candidate = answer("The synthetic heading is ISA -25.50°C.")
    clean = validate_answer(candidate, [source])
    assert clean["claims"][0]["text"] == candidate["claims"][0]["text"]
    assert clean["claims"][0]["citations"][0]["quote"] == before["text"]
    assert model_evidence([source])[0]["excerpts"][0]["text"] == before["text"]
    assert source == before


@pytest.mark.parametrize(
    "source,claim",
    [
        ("The heading is ISA - 25°C.", "The offset is ISA 25°C."),
        ("The heading is ISA + 25°C.", "The offset is ISA -25°C."),
        ("The heading is ISA - 25.50°C.", "The offset is ISA -25°C."),
        ("The heading is ISA - 25.50°C.", "The offset is ISA 50°C."),
        ("The heading is ISA - 25°C.", "The offset is ISA -35°C."),
        ("The heading is model ISA - 25°C.", "The offset is ISA -25°C."),
        ("The printed time is 8.05 HRS.", "The endurance is 8:05 hrs."),
    ],
)
def test_wrong_signs_partial_components_absent_values_and_clock_rewrites_reject(source, claim):
    with pytest.raises(ModelUnavailable, match="numeric values absent"):
        validate_answer(answer(claim), [evidence(source)])
