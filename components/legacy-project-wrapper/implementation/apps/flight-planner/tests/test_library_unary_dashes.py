"""Unary typography retains signs without turning range separators into minus signs."""

from decimal import Decimal

import pytest

from app.services.aircraft_library.models import (
    ModelUnavailable,
    _comparison_unary_dashes,
    numbers,
    validate_answer,
    verified_completion,
)
from .test_library_numeric_layout import answer, source


@pytest.mark.parametrize(
    "text,expected",
    [
        ("–4", {"-4"}),
        ("Minimum is –4 A.", {"-4"}),
        ("Reading (–4) A.", {"-4"}),
        ("Reading: –4 A.", {"-4"}),
        ("From –59 to –5 A.", {"-59", "-5"}),
        ("From –59 TO –5 A.", {"-59", "-5"}),
        ("Values –59 and –5 A.", {"-59", "-5"}),
        ("Range –4–59 A.", {"-4", "59"}),
        ("Range 0–24.4 A.", {"0", "24.4"}),
        ("Range 0 –24.4 A.", {"0", "24.4"}),
        ("Range 0 – 24.4 A.", {"0", "24.4"}),
        ("Range 0– 24.4 A.", {"0", "24.4"}),
        ("Range 0 A –24.4 A.", {"0", "24.4"}),
        ("Range 0 °C –24.4 °C.", {"0", "24.4"}),
        ("Range 0 ft –24.4 ft.", {"0", "24.4"}),
        ("Range 0 km/h –24.4 km/h.", {"0", "24.4"}),
        ("Range 0′ –24.4′.", {"0", "24.4"}),
        ("Range (0) –24.4 A.", {"0", "24.4"}),
        ("Row 0\n–4 A.", {"0", "-4"}),
        ("Row 0\r\n–4 A.", {"0", "-4"}),
        ("Minimum is –1,200.50 ft.", {"-1200.50"}),
    ],
)
def test_numeric_comparison_distinguishes_unary_signs_and_ranges(text, expected):
    assert numbers(text) == {Decimal(value) for value in expected}


@pytest.mark.parametrize(
    "text",
    ["Part AB–4", "SB13–03", "Figure 1–4", "----36'-1\"", "––36", "---–36"],
)
def test_identifiers_and_drawing_rules_are_not_rewritten(text):
    assert _comparison_unary_dashes(text) == text


@pytest.mark.parametrize("claim_sign,source_sign", [("–", "-"), ("-", "–"), ("–", "−")])
def test_negative_typography_keeps_original_claim_and_exact_quote(claim_sign, source_sign):
    original = f"Minimum current is {source_sign}4 amps."
    claim = f"Minimum current is {claim_sign}4 amps."
    result = validate_answer(answer(claim), [source(original)])
    assert result["claims"][0]["text"] == claim
    assert result["claims"][0]["citations"][0]["quote"] == original


@pytest.mark.parametrize("negative_claim", [True, False])
def test_en_dash_negative_and_positive_values_cannot_support_each_other(negative_claim):
    original = "Minimum current is 4 amps." if negative_claim else "Minimum current is –4 amps."
    claim = "Minimum current is –4 amps." if negative_claim else "Minimum current is 4 amps."
    with pytest.raises(ModelUnavailable, match="numeric values"):
        validate_answer(answer(claim), [source(original)])


def test_negative_indicator_bounds_do_not_consume_a_correction_request():
    original = "Indicator green -4 to 59 amps; caution -59 to -5 amps."
    claim = "Indicator green –4 to 59 amps; caution –59 to –5 amps."

    class Provider:
        calls = 0

        def complete(self, evidence, question):
            self.calls += 1
            assert self.calls == 1
            return answer(claim)

    models = Provider()
    result = verified_completion(models, [source(original)], "Summarize")
    assert result["claims"][0]["text"] == claim
    assert result["claims"][0]["citations"][0]["quote"] == original
    assert models.calls == 1
