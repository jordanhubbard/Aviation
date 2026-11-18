"""Printed unit-suffixed decimals supply complete values, never identifier tails."""

import copy
from decimal import Decimal

import pytest

from app.services.aircraft_library.models import (
    ModelUnavailable,
    _comparison_leading_decimals,
    model_evidence,
    numbers,
    validate_answer,
)
from .test_library_conversion_equations import answer, evidence


@pytest.mark.parametrize(
    "unit",
    [
        "nm",
        "NMI",
        "ft",
        "inches",
        "kg",
        "g",
        "GPH",
        "RPM",
        "KIAS",
        "sec",
        "psi",
        "mbar",
        "miles/hour",
        "square inches",
        "m²",
        "Hz",
        "kHz",
        "MHz",
        "GHz",
    ],
)
@pytest.mark.parametrize("sign", ["", "+", "-", "−", "–"])
def test_complete_printed_measurements_preserve_sign_and_precision(unit, sign):
    value = Decimal("-.3750" if sign in ("-", "−", "–") else ".3750")
    text = f"The printed limit is {sign}.3750{unit}."
    assert numbers(text) == {value}
    assert numbers(text.replace(".3750", "0.3750")) == {value}


@pytest.mark.parametrize("connector", ["to", "through"])
def test_explicit_ranges_keep_both_complete_signed_bounds(connector):
    assert numbers(f"Limit -.375nm {connector} +.625nm.") == {Decimal("-.375"), Decimal(".625")}


@pytest.mark.parametrize(
    "text",
    [
        "code.375nm",
        "code-.375nm",
        "code/.375nm",
        "code+.375nm",
        "code−.375nm",
        "code–.375nm",
        "prefix_.375nm",
        "part‐.375nm",
        "part‑.375nm",
        "part‿.375nm",
        "X.375nm",
        "x.375nm",
        ".375nm_model",
        ".375nm-model",
        ".375nm‐code",
        ".375nm‑code",
        ".375nm‿code",
        ".375nm∕code",
        ".375nm/model",
        ".375nm.model",
        ".375nm2",
        ".375nmbad",
        ".375NM_code",
        ".375MHz_model",
        ".375GHz/s",
        ".375kHzx",
        ".375unknown",
        ".375k9",
        ".375nm/.5nm",
        ".375nm*.5nm",
        ".375nm+.5nm",
        ".375nm-.5nm",
        ".375nm−.5nm",
        ".375nm–.5nm",
        ".375nm—.5nm",
        ".375nm.2",
        ".375nm,2",
        ".375.2nm",
        ".375e2nm",
        ".375,5nm",
        "..375nm",
        ". 375nm",
        "-. 375nm",
        "--.375nm",
        "- .375nm",
        "+\t.375nm",
        "−\n.375nm",
        "– .375nm",
        "－ .375nm",
        "‐ .375nm",
        "➖ .375nm",
        "1 .375nm",
        "1\n.375nm",
        "O.375nm",
        "o.375nm",
        ".3S5nm",
        "P/N .375nm",
        "Part No. .375nm",
        "Part (.375nm)",
        "Model = .375nm",
        "code: .375nm",
        "Reference # .375nm",
        "Figure .375nm",
        "Table = .375nm",
        "Serial .375nm",
        "Tail number: .375nm",
        "Version .375nm",
        "Revision = .375nm",
        "Rev. # .375nm",
        "Chapter .375nm",
        "Appendix .375nm",
    ],
)
def test_identifiers_malformed_tokens_and_detached_signs_are_not_repaired(text):
    assert _comparison_leading_decimals(text) == text
    assert Decimal(".375") not in numbers(text)


def test_new_measurement_recognition_does_not_join_lines_or_change_delimited_literals():
    assert _comparison_leading_decimals(".375\nnm") == "0.375\nnm"
    assert _comparison_leading_decimals("The literal is -.375.") == "The literal is -0.375."
    assert numbers("1 - .375nm") == {Decimal("1"), Decimal(".375")}
    assert numbers("1 − .375nm") == {Decimal("1"), Decimal(".375")}
    assert numbers("• .375nm") == {Decimal(".375")}
    assert numbers('Limit: ".375nm".') == {Decimal(".375")}
    assert numbers("GPS APR = .375nm)") == {Decimal(".375")}
    assert _comparison_leading_decimals("Version .375%") == "Version 0.375%"
    assert _comparison_leading_decimals("Model = .375°C") == "Model = 0.375°C"


def test_comparison_keeps_original_claim_quote_and_model_wire_unchanged():
    sources = evidence("The printed distance limit is .3750nm.")
    candidate = answer("The distance limit is 0.3750 nm.")
    before = copy.deepcopy((sources, candidate, model_evidence(sources)))
    result = validate_answer(candidate, sources)
    assert result["claims"][0]["text"] == candidate["claims"][0]["text"]
    assert result["claims"][0]["citations"][0]["quote"] == sources[0]["text"]
    assert (sources, candidate, model_evidence(sources)) == before


@pytest.mark.parametrize("unsupported", ["375", "0.38", "-0.375", "0.6", "1"])
def test_full_value_cannot_support_components_rounding_changed_sign_or_conversion(unsupported):
    with pytest.raises(ModelUnavailable, match="numeric values absent"):
        validate_answer(answer(f"The value is {unsupported} nm."), evidence("Limit .375nm."))


def test_ocr_letter_is_not_a_leading_zero_or_an_inferred_digit():
    with pytest.raises(ModelUnavailable, match="numeric values absent"):
        validate_answer(answer("The value is 0.375 nm."), evidence("Limit O.375nm."))
