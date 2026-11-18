"""Explicit half percentages compare by value; quotations remain literal."""

import copy
from decimal import Decimal

import pytest

from app.services.aircraft_library.models import (
    ModelUnavailable,
    _comparison_half_percentages,
    model_evidence,
    numbers,
    validate_answer,
)


@pytest.mark.parametrize("fraction", ["½%", "½ %", "½\t%", "1/2%", "1 /2%", "1/ 2%", "1 \t/\t 2 %"])
@pytest.mark.parametrize(
    "sign,expected", [("", "0.5"), ("+", "0.5"), ("-", "-0.5"), ("−", "-0.5"), ("–", "-0.5")]
)
def test_complete_half_percentage_preserves_value_and_sign(fraction, sign, expected):
    assert numbers("The adjustment is " + sign + fraction + ".") == {Decimal(expected)}


@pytest.mark.parametrize(
    "text",
    [
        "code½%",
        "code1/2%",
        "code-½%",
        "code/½%",
        "code.½%",
        "code+½%",
        "2½%",
        "2 ½%",
        "2 1/2%",
        "0.1/2%",
        ".1/2%",
        "1/1/2%",
        "1/2/2%",
        "½%model",
        "1/2%model",
        "½%/model",
        "½%-model",
        "½%.model",
        "½%%",
        "½%+1",
        "½%−1",
        "½%–1",
        "½%—1",
        "½%2",
        "½",
        "1/2",
        "½ GPH",
        "1/2 degrees",
        "1/2 percent",
        "1\n/2%",
        "1/\n2%",
        "½\n%",
        "1/2\n%",
        "- ½%",
        "+ 1/2%",
        "−\t½%",
        "Section ½%",
        "Fig. 1/2%",
        "Table: ½%",
        "P/N ½%",
        "Part No. 1/2%",
        "Model ½%",
        "reference # 1/2%",
        "¼%",
        "¾%",
        "2/4%",
        "1/20%",
        "11/2%",
    ],
)
def test_incomplete_other_fraction_and_identifier_forms_are_not_normalized(text):
    assert _comparison_half_percentages(text) == text
    assert Decimal("0.5") not in numbers(text)


def evidence(text):
    return [
        {
            "passage_id": 917,
            "document_id": "doc_half",
            "page": 11,
            "label": "P-7",
            "method": "text",
            "text": text,
        }
    ]


@pytest.mark.parametrize(
    "source,claim", [("½%", "1/2%"), ("1/2%", "½%"), ("½%", "0.5%"), ("0.5%", "1/2%")]
)
def test_literal_quotes_wire_and_inputs_unchanged(source, claim):
    quote = "The adjustment for the optional equipment is " + source + "."
    sources = evidence(quote)
    answer = {
        "insufficient_evidence": False,
        "reason": "",
        "claims": [
            {
                "text": "The adjustment is " + claim + ".",
                "citations": [{"passage_id": 917, "excerpt_id": 0}],
            }
        ],
    }
    before_sources, before_answer = copy.deepcopy(sources), copy.deepcopy(answer)
    before_wire = copy.deepcopy(model_evidence(sources))
    result = validate_answer(answer, sources)
    assert result["claims"][0]["text"] == answer["claims"][0]["text"]
    assert result["claims"][0]["citations"][0]["quote"] == quote
    assert sources == before_sources and answer == before_answer
    assert model_evidence(sources) == before_wire


@pytest.mark.parametrize(
    "source,claim",
    [
        ("½%", "1%"),
        ("½%", "2%"),
        ("½%", "5%"),
        ("½%", "-0.5%"),
        ("-½%", "0.5%"),
        ("-1/2%", "0.5%"),
        ("1%", "½%"),
        ("2%", "1/2%"),
        ("¼%", "1/2%"),
        ("¾%", "0.5%"),
        ("1/2 GPH", "0.5%"),
        ("1/20%", "½%"),
    ],
)
def test_whole_values_denominators_units_and_signs_do_not_supply_half(source, claim):
    with pytest.raises(ModelUnavailable, match="numeric"):
        validate_answer(
            {
                "insufficient_evidence": False,
                "reason": "",
                "claims": [
                    {
                        "text": "The adjustment is " + claim + ".",
                        "citations": [{"passage_id": 917, "excerpt_id": 0}],
                    }
                ],
            },
            evidence("The adjustment for the optional equipment is " + source + "."),
        )
