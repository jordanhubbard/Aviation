"""PDF prose/quantity joins are comparison boundaries, never new source text."""

from decimal import Decimal

import pytest

from app.services.aircraft_library.models import (
    ModelUnavailable,
    numbers,
    validate_answer,
    model_evidence,
)


@pytest.mark.parametrize(
    "text,expected",
    [
        ("Approach at73 KIAS with the stated configuration.", {"73"}),
        ("Approach at73 KIAS and descend at500 feet.", {"73", "500"}),
        ("Use the selected model and approach at73 KIAS.", {"73"}),
        ("At73 KCAS", {"73"}),
        ("from73 KTAS", {"73"}),
        ("to73 knots", {"73"}),
        ("of73 kt", {"73"}),
        ("than73 kts", {"73"}),
        ("between73–81 feet", {"73", "81"}),
        ("and73 through 81 ft", {"73", "81"}),
        ("at−5–−2 °C", {"-5", "-2"}),
        ("at–5 to 2 °f", {"-5", "2"}),
        ("at-5--2 °C", {"-5", "-2"}),
        ("at73-81 KIAS", {"73", "81"}),
        ("at8 ,000 ft", {"8000"}),
        ("at-8 ,000 ft", {"-8000"}),
        ("at2,400 RPM", {"2400"}),
        ("at11.6 GPH", {"11.6"}),
        ("at42 hours", {"42"}),
        ("after inspection at42 seconds", {"42"}),
    ],
)
def test_joined_quantities_with_units_keep_complete_signed_values(text, expected):
    assert numbers(text) == {Decimal(value) for value in expected}


@pytest.mark.parametrize(
    "text",
    [
        "P/N at73 KIAS",
        "PN: At73 RPM",
        "Part No. At73 RPM",
        "part number # at73 ft",
        "Part # at73 KIAS",
        "Model at73 KIAS",
        "code at73 ft",
        "identifier: At73 KIAS",
        "ref. at73 KIAS",
        "reference # at73 KIAS",
        "P/N\nat73 KIAS",
        "AT73 KIAS",
        "FROM73 KIAS",
        "CAT73 KIAS",
        "CAt73 KIAS",
        "format73 KIAS",
        "prefix-at73 KIAS",
        "prefix–at73 KIAS",
        "prefix/at73 KIAS",
        "prefix.at73 KIAS",
        "at73",
        "at73KIAS",
        "at73 KIAS_model",
        "at73 KIAS70",
        "at73 RPMX",
        "FJ8000 ft",
        "It!ofl-FJ8000",
        "at73\nKIAS",
        "at73 KIASfoo",
    ],
)
def test_identifier_suffixes_or_missing_unit_context_remain_excluded(text):
    # A trailing numeric identifier suffix can have pre-existing token behavior;
    # the joined prose value itself must not gain a comparison boundary.
    assert Decimal(73) not in numbers(text)
    assert Decimal(8000) not in numbers(text)


def evidence(text):
    return {
        "document_id": "doc_synthetic",
        "passage_id": 1,
        "page": 1,
        "label": "1",
        "text": text,
        "method": "text",
    }


def answer(text):
    return {
        "insufficient_evidence": False,
        "reason": "",
        "claims": [{"text": text, "citations": [{"passage_id": 1, "excerpt_id": 0}]}],
    }


def test_original_joined_source_is_quoted_unchanged_and_wire_stays_exact():
    source = evidence("A synthetic value is stated at73 KIAS for this comparison fixture.")
    before = source.copy()
    result = validate_answer(answer("The stated synthetic value is 73."), [source])
    assert result["claims"][0]["citations"][0]["quote"] == before["text"]
    assert source == before
    assert model_evidence([source])[0]["excerpts"] == [{"excerpt_id": 0, "text": before["text"]}]


@pytest.mark.parametrize(
    "source,claim",
    [
        ("The source lists P/N at73 KIAS.", "The synthetic value is 73."),
        ("A synthetic value is at−73 KIAS.", "The synthetic value is 73."),
        ("A synthetic value is at–73 KIAS.", "The synthetic value is 73."),
        ("A synthetic value is at73 KIAS.", "The synthetic value is -73."),
        ("The source states 42 KIAS.", "The synthetic value is at73 KIAS."),
        ("The source lists code FJ8000 with no measurement.", "The synthetic value is 8000."),
    ],
)
def test_wrong_sign_absent_values_and_corrupted_identifiers_still_fail(source, claim):
    with pytest.raises(ModelUnavailable, match="numeric values absent"):
        validate_answer(answer(claim), [evidence(source)])
