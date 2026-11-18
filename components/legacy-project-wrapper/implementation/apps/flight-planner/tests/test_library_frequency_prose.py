"""Frequency units restore a prose boundary without changing source evidence."""

from decimal import Decimal

import pytest

from app.services.aircraft_library.models import (
    ModelUnavailable,
    _comparison_frequency_quantities,
    model_evidence,
    numbers,
    validate_answer,
)


@pytest.mark.parametrize(
    "prefix",
    [
        "at",
        "At",
        "from",
        "From",
        "to",
        "To",
        "of",
        "Of",
        "than",
        "Than",
        "between",
        "Between",
        "and",
        "And",
        "in",
        "In",
    ],
)
def test_known_prose_prefixes_with_complete_frequency_unit(prefix):
    assert numbers(prefix + "37-kHz") == {Decimal("37")}


@pytest.mark.parametrize(
    "text,expected",
    [
        ("in37 kHz", {"37"}),
        ("in37\tkHz", {"37"}),
        ("in37 \t- \tkHz", {"37"}),
        ("in37 Hz", {"37"}),
        ("in37-MHz", {"37"}),
        ("in37 GHz", {"37"}),
        ("in37-KHZ", {"37"}),
        ("in37.125-MHz", {"37.125"}),
        ("from-37-kHz", {"-37"}),
        ("of−37 MHz", {"-37"}),
        ("to–37-GHz", {"-37"}),
        ("at+37.125 Hz", {"37.125"}),
        ("between37–41-kHz", {"37", "41"}),
        ("in-37–-10 kHz", {"-37", "-10"}),
        ("from37 to 41-MHz", {"37", "41"}),
        ("from-37 through 0 Hz", {"-37", "0"}),
        ("in1 ,000-kHz", {"1000"}),
        ("in-1,000.125 kHz", {"-1000.125"}),
    ],
)
def test_units_signs_precision_and_complete_ranges(text, expected):
    assert numbers(text) == {Decimal(x) for x in expected}


@pytest.mark.parametrize(
    "text",
    [
        "IN37-kHz",
        "prefixin37-kHz",
        "prefix-in37-kHz",
        "prefix–in37-kHz",
        "prefix/in37-kHz",
        "prefix.in37-kHz",
        "prefix+in37-kHz",
        "prefix−in37-kHz",
        "P/N in37-kHz",
        "Part No. in37-kHz",
        "Model in37-kHz",
        "code: in37-kHz",
        "reference # in37-kHz",
        "Section in37-kHz",
        "Fig. in37-kHz",
        "Table in37-kHz",
        "in37kHz",
        "in37",
        "in37-",
        "in37-KIAS",
        "in37-kHz_model",
        "in37-kHz-code",
        "in37-kHz/model",
        "in37-kHz.model",
        "in37-kHz2",
        "in37--kHz",
        "in37- -kHz",
        "in37\nkHz",
        "in37-\nkHz",
        "in37\n-kHz",
        "in37 41-kHz",
        "in3,7-kHz",
        "in37.5.25-kHz",
        "in37 .5 kHz",
        "in- 37-kHz",
        "in+ 37-kHz",
        "thing37-kHz",
    ],
)
def test_ambiguous_identifiers_missing_units_lines_and_malformed_values_stay_unchanged(text):
    assert _comparison_frequency_quantities(text) == text


def source(text):
    return {
        "document_id": "doc_frequency",
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


def test_source_claim_quote_and_model_input_are_preserved():
    evidence = source("The synthetic set receives in37-kHz steps.")
    before = evidence.copy()
    candidate = answer("The synthetic set receives in 37-kHz steps.")
    value = validate_answer(candidate, [evidence])
    assert value["claims"][0]["text"] == candidate["claims"][0]["text"]
    assert value["claims"][0]["citations"][0]["quote"] == before["text"]
    assert model_evidence([evidence])[0]["excerpts"][0]["text"] == before["text"]
    assert evidence == before


@pytest.mark.parametrize(
    "quoted,claim",
    [
        ("The synthetic set receives in37-kHz steps.", "The offset is -37 kHz."),
        ("The synthetic offset is from-37-kHz.", "The offset is 37 kHz."),
        ("The synthetic set receives in37-kHz steps.", "The spacing is 38 kHz."),
        ("The synthetic set receives in37-kHz steps.", "The spacing is 0.037 MHz."),
        ("The source lists code: in37-kHz.", "The spacing is 37 kHz."),
        ("The source lists prefix-in37-kHz.", "The spacing is 37 kHz."),
        ("The source lists in37kHz.", "The spacing is 37 kHz."),
        ("The printed time is 8.05 HRS.", "The endurance is 8:05 hrs."),
    ],
)
def test_wrong_signs_absent_values_identifiers_and_unit_or_clock_rewrites_reject(quoted, claim):
    with pytest.raises(ModelUnavailable, match="numeric values absent"):
        validate_answer(answer(claim), [source(quoted)])
