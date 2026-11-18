"""Explicit printed coefficients are evidence; conversions are never computed."""

import copy
from decimal import Decimal

import pytest

from app.services.aircraft_library.models import (
    ModelUnavailable,
    _comparison_conversion_factors,
    model_evidence,
    numbers,
    validate_answer,
)


@pytest.mark.parametrize(
    "unit,other", [("Pounds", "Kilograms"), ("kg", "lb"), ("LBs", "KG"), ("pound", "kilogram")]
)
@pytest.mark.parametrize("operator", ["x", "×"])
@pytest.mark.parametrize(
    "sign,value", [("", ".375"), ("+", ".3750"), ("-", ".375"), ("−", ".375"), ("–", ".375")]
)
def test_explicit_same_line_mass_factor(unit, other, operator, sign, value):
    text = f"({unit}\t{operator}\t{sign}{value}\t=\t{other})"
    expected = Decimal(("-" if sign in ("-", "−", "–") else "") + "0" + value)
    assert numbers(text) == {expected}
    assert Decimal("375") not in numbers(text)


@pytest.mark.parametrize(
    "text",
    [
        "x.375",
        "Pounds x.375",
        "Pounds x.375 =",
        "Pounds X.375 = kg",
        "Pounds *.375 = kg",
        "Pounds /.375 = kg",
        "Pounds x.375 - kg",
        "Pounds x.375.1 = kg",
        "Pounds x.375e2 = kg",
        "Pounds x.375% = kg",
        "Pounds x.375/.5 = kg",
        "Pounds x.375-.5 = kg",
        "Pounds x--.375 = kg",
        "Pounds x- .375 = kg",
        "Pounds x+ .375 = kg",
        "Pounds x−\t.375 = kg",
        "Pounds x. 375 = kg",
        "Pounds x.375 = kg-code",
        "Pounds x.375 = kg/model",
        "Pounds x.375 = kg.model",
        "Pounds x.375 = kg2",
        "Pounds x.375 = kg_more",
        "modelPounds x.375 = kg",
        "model-Pounds x.375 = kg",
        "model/Pounds x.375 = kg",
        "P/N Pounds x.375 = kg",
        "Part No. (Pounds x.375 = kg)",
        "Model Pounds x.375 = kg",
        "code: (Pounds x.375 = kg)",
        "reference # Pounds x.375 = kg",
        "Section (Pounds x.375 = kg)",
        "Fig. Pounds x.375 = kg",
        "Table: Pounds x.375 = kg",
        "Pounds\nx.375 = kg",
        "Pounds x.375\n= kg",
        "Pounds x.375 =\nkg",
        "Pounds x.375\r= kg",
        "Pounds x.375 = kilograms-extra",
    ],
)
def test_ambiguous_incomplete_identifier_and_malformed_forms_unchanged(text):
    assert _comparison_conversion_factors(text) == text
    assert Decimal("0.375") not in numbers(text)


def evidence(text):
    return [
        {
            "passage_id": 1,
            "document_id": "doc_factor",
            "page": 3,
            "label": "1-3",
            "method": "text",
            "text": text,
        }
    ]


def answer(text):
    return {
        "insufficient_evidence": False,
        "reason": "",
        "claims": [{"text": text, "citations": [{"passage_id": 1, "excerpt_id": 0}]}],
    }


def test_exact_original_quote_inputs_wire_and_answer_preserved():
    sources = evidence("The printed relation is (Pounds x.3750 = Kilograms).")
    candidate = answer("The printed pounds-to-kilograms coefficient is 0.3750.")
    original_sources, original_candidate = copy.deepcopy(sources), copy.deepcopy(candidate)
    wire = copy.deepcopy(model_evidence(sources))
    result = validate_answer(candidate, sources)
    assert result["claims"][0]["citations"][0]["quote"] == sources[0]["text"]
    assert sources == original_sources and candidate == original_candidate
    assert model_evidence(sources) == wire


@pytest.mark.parametrize("value", ["375", "0.38", "-0.375", "2.667", "1", "0"])
def test_no_rounded_signed_inverse_or_computed_value_is_supported(value):
    with pytest.raises(ModelUnavailable, match="numeric values absent"):
        validate_answer(
            answer("The factor is " + value + "."), evidence("(Pounds x.375 = Kilograms)")
        )


def test_negative_factor_does_not_supply_positive_value():
    with pytest.raises(ModelUnavailable, match="numeric values absent"):
        validate_answer(answer("The factor is 0.375."), evidence("(Pounds x−.375 = Kilograms)"))
