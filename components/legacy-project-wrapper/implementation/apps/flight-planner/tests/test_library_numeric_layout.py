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


@pytest.mark.parametrize("marker,value,unit", [("d", "20", "second"), ("e", "30", "seconds"), ("z", "1.5", "second")])
def test_attached_delay_footnotes_require_matching_numeric_reference(marker, value, unit):
    text = f"Caution range 0 - 1{marker}.\n  {marker}{value} {unit} delay."
    accepted = validate_answer(answer(f"The caution has a {value} {unit} delay."), [source(text)])
    assert accepted["claims"][0]["citations"][0]["quote"] == text


@pytest.mark.parametrize("text", [
    "Caution range 0 - 1e.\nd20 second delay.",
    "Caution range normal.\nd20 second delay.",
    "Caution range 0 - 1d.\nD20 second delay.",
    "Caution range 0 - 1d.\ndd20 second delay.",
    "Caution range 0 - 1d.\nIdentifier d20 second delay.",
    "Caution range 0 - 1d.\nd20 feet clearance.",
    "Caution range 0 - 1days.\nd20 second delay.",
    "Caution range G1d.\nd20 second delay.",
    "Caution range G1.5d.\nd20 second delay.",
    "Instrument G1000, SR22, x20 and d20.",
])
def test_delay_rule_does_not_split_unbound_markers_or_identifiers(text):
    assert Decimal(20) not in numbers(text)
    with pytest.raises(ModelUnavailable, match="numeric values"):
        validate_answer(answer("The delay is 20 seconds."), [source(text)])


@pytest.mark.parametrize("minus", ["-", "−"])
def test_attached_delay_preserves_complete_negative_value(minus):
    text = f"Caution range 0 - 1d.\nd{minus}20.5 second delay."
    assert Decimal("-20.5") in numbers(text)
    assert Decimal("20.5") not in numbers(text)
    assert validate_answer(answer("The delay is -20.5 seconds."), [source(text)])["claims"]
    with pytest.raises(ModelUnavailable, match="numeric values"):
        validate_answer(answer("The delay is 20.5 seconds."), [source(text)])


def test_delay_reference_cannot_come_from_another_quote_or_metadata():
    evidence = [source("Caution range 0 - 1d."), source("d20 second delay.")]
    evidence[1]["passage_id"] = 2
    evidence[1]["metadata"]["notes"] = "Caution range 0 - 1d."
    value = answer("The delay is 20 seconds.")
    value["claims"][0]["citations"].append({"passage_id": 2, "excerpt_id": 0})
    with pytest.raises(ModelUnavailable, match="numeric values"):
        validate_answer(value, evidence)


def test_sr22_electrical_delays_keep_exact_source_and_signed_limits():
    text = (
        "Alternator 2 Current (0 - 70 Amps) 2 - 100 0 - 1d ALT 2\n"
        "Battery 1 Current (-59 to 59 Amps) -4 - 59 -59 to -5e BATT 1\n"
        "    d20 second delay.\n    e30 second delay."
    )
    value = answer(
        "Alternator 2 Current (0 - 70 Amps): normal 2 - 100, caution 0 - 1 "
        "with a 20 second delay. Battery 1 Current (-59 to 59 Amps): "
        "normal -4 - 59, caution -59 to -5 with a 30 second delay."
    )
    accepted = validate_answer(value, [source(text)])
    assert accepted["claims"][0]["citations"][0]["quote"] == text
    value["claims"][0]["text"] += " Another delay is 40 seconds."
    with pytest.raises(ModelUnavailable, match="numeric values"):
        validate_answer(value, [source(text)])


@pytest.mark.parametrize("original,expected", [
    ("Altitude 1      ,000 ft", "1000"),
    ("Altitude 12 ,345 ft", "12345"),
    ("Altitude 123 \t,456 ,789.25 ft", "123456789.25"),
    ("Altitude -1 ,000.5 ft", "-1000.5"),
    ("Altitude −1 ,000.5 ft", "-1000.5"),
    ("Altitude.....-1 ,000 ft", "-1000"),
    ("Altitude 1 ,000.", "1000"),
    ("Altitude 1 ,000, then descend.", "1000"),
])
def test_grouping_spaces_keep_complete_signed_numeric_token(original, expected):
    assert numbers(original) == {Decimal(expected)}
    value = answer(f"The altitude is {expected} ft.")
    result = validate_answer(value, [source(original)])
    assert result["claims"][0]["citations"][0]["quote"] == original


@pytest.mark.parametrize("original,unsupported", [
    ("Altitude 1\n,000 ft", "1000"),
    ("Altitude 1,\n000 ft", "1000"),
    ("Altitude 1 000 ft", "1000"),
    ("Altitude 1 ,00 ft", "100"),
    ("Altitude 1 ,0000 ft", "10000"),
    ("Altitude 1 ,000 ,00 ft", "1000"),
    ("Altitude 1234 ,567 ft", "1234567"),
    ("Instrument G1 ,000 ft", "1000"),
    ("Instrument A1.2 ,000 ft", "2000"),
    ("Instrument 1 ,000part", "1000"),
    ("Altitude 1 ,000.5.2 ft", "1000.5"),
    ("Altitude -1 ,000 ft", "1000"),
    ("Altitude 1 ,000 ft", "1"),
    ("Altitude 1, 000 ft", "1000"),
    ("Altitude 1 , 000 ft", "1000"),
])
def test_grouping_spaces_do_not_join_malformed_values_or_grant_components(original, unsupported):
    assert Decimal(unsupported) not in numbers(original)
    with pytest.raises(ModelUnavailable, match="numeric values"):
        validate_answer(answer(f"The value is {unsupported}."), [source(original)])


def test_grouping_spaces_do_not_join_separate_citations():
    evidence = [source("Altitude 1 "), source(",000 ft above the reference.")]
    evidence[1]["passage_id"] = 2
    value = answer("The altitude is 1000 ft.")
    value["claims"][0]["citations"].append({"passage_id": 2, "excerpt_id": 0})
    with pytest.raises(ModelUnavailable, match="numeric values"):
        validate_answer(value, evidence)


def test_comma_space_lists_and_ratio_examples_remain_separate_values():
    text = "Calibration pairs are 50/50, 100/100, 150/150."
    assert numbers(text) == {Decimal(50), Decimal(100), Decimal(150)}
    assert numbers("Altitude choices are 100, 200, 300 ft.") == {
        Decimal(100), Decimal(200), Decimal(300)
    }
    assert validate_answer(answer(text), [source(text)])["claims"]
    with pytest.raises(ModelUnavailable, match="numeric values"):
        validate_answer(answer("The value is 50100."), [source(text)])
