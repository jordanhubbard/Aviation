"""Measured decimal gaps change comparison boundaries, never original evidence."""

from decimal import Decimal

import pytest

from app.services.aircraft_library.models import (
    ModelUnavailable,
    model_evidence,
    numbers,
    validate_answer,
)


@pytest.mark.parametrize(
    "text,expected",
    [
        ("The measured limit is -2 .34g.", {"-2.34"}),
        ("The measured limit is -2. 34g.", {"-2.34"}),
        ("The measured limit is -2 \t.\t34 g.", {"-2.34"}),
        ("The measured limit is −2 .34g.", {"-2.34"}),
        ("The measured limit is –2 .34g.", {"-2.34"}),
        ("The measured limit is +2 .340g.", {"2.340"}),
        ("The measured limits are -2 .34–-1 .25g.", {"-2.34", "-1.25"}),
        ("The measured limits are 1 .25–2 .50 g.", {"1.25", "2.50"}),
        ("The measured limits are 1 .25–2g.", {"1.25", "2"}),
        ("The measured limits are 1–2 .50g.", {"1", "2.50"}),
        ("The measured limits are -2 .34 to -1 .25 g.", {"-2.34", "-1.25"}),
        ("The measured limits are -2 .34 through 0 g.", {"-2.34", "0"}),
        ("A measured value is 1 ,000 .25 ft.", {"1000.25"}),
        ("A measured value is -1,000. 25 ft.", {"-1000.25"}),
        ("A measured value is 12 .345 KIAS.", {"12.345"}),
        ("A measured value is 12 .345 RPM.", {"12.345"}),
        ("A measured value is 12 .345 GPH.", {"12.345"}),
        ("A measured value is 12 .345 psi.", {"12.345"}),
        ("A measured value is 12 .345 inHg.", {"12.345"}),
        ("A measured value is 12 .345 hPa.", {"12.345"}),
        ("A measured value is 12 .345 kg.", {"12.345"}),
        ("A measured value is 12 .345 inches.", {"12.345"}),
        ("A measured value is 12 .345%.", {"12.345"}),
        ("A measured value is -12 .345 °C.", {"-12.345"}),
        ("A measured value is 8 .05 HRS.", {"8.05"}),
    ],
)
def test_complete_measurements_keep_exact_signed_precision(text, expected):
    assert numbers(text) == {Decimal(x) for x in expected}


@pytest.mark.parametrize(
    "text",
    [
        "2 .34",
        "2\n.34g",
        "2.\n34g",
        "2 .34\ng",
        "2 . .34g",
        "2 .34gauge",
        "2 .34g_model",
        "2 .34g-model",
        "2 .34g/model",
        "2 .34g.model",
        "FJ2 .34g",
        "prefix-2 .34g",
        "prefix–2 .34g",
        "prefix/2 .34g",
        "prefix.2 .34g",
        "prefix+2 .34g",
        "prefix−2 .34g",
        "P/N 2 .34g",
        "Part No. 2 .34g",
        "Model 2 .34g",
        "code: 2 .34g",
        "reference # 2 .34g",
        "Section 2 .34g",
        "Fig. 2 .34g",
        "Table 2 .34g",
        "12,2 .34g",
        "1, 2 .34g",
        "- 2 .34g",
        "− 2 .34g",
        "– 2 .34g",
        "+ 2 .34g",
        "1.2 .34g",
    ],
)
def test_ambiguous_identifiers_lines_signs_and_missing_units_stay_excluded(text):
    assert Decimal("2.34") not in numbers(text)
    assert Decimal("-2.34") not in numbers(text)


def source(text):
    return {
        "document_id": "doc_decimal",
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


def test_source_quote_and_model_evidence_remain_exact():
    evidence = source("The synthetic load limit is -2 .34g with this configuration.")
    before = evidence.copy()
    result = validate_answer(answer("The synthetic load limit is -2.34g."), [evidence])
    assert result["claims"][0]["citations"][0]["quote"] == before["text"]
    assert model_evidence([evidence])[0]["excerpts"][0]["text"] == before["text"]
    assert evidence == before


@pytest.mark.parametrize(
    "quoted,claim",
    [
        ("The synthetic load limit is -2 .34g.", "The synthetic load limit is 2.34g."),
        ("The synthetic load limit is 2 .34g.", "The synthetic load limit is -2.34g."),
        ("The synthetic load limit is -2 .34g.", "The synthetic load limit is -2g."),
        ("The synthetic load limit is -2 .34g.", "The synthetic load limit is 34g."),
        ("The source states a limit of 2.5g.", "The synthetic load limit is 2.34g."),
        ("The printed time is 8.05 HRS.", "The printed time is 8:05 hrs."),
        ("The printed time is 8 .05 HRS.", "The printed time is 8:05 hrs."),
        ("The source lists code FJ2 .34g.", "The synthetic load limit is 2.34g."),
    ],
)
def test_wrong_signs_partial_components_missing_values_and_clock_rewrites_reject(quoted, claim):
    with pytest.raises(ModelUnavailable, match="numeric values absent"):
        validate_answer(answer(claim), [source(quoted)])
