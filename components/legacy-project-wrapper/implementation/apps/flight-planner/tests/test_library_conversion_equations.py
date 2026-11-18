"""Literal conversion notation supplies printed coefficients, never inferred ones."""

import copy
from decimal import Decimal

import pytest

from app.services.aircraft_library.models import (
    ModelUnavailable,
    _comparison_conversion_factors,
    _comparison_leading_decimals,
    model_evidence,
    numbers,
    validate_answer,
)


@pytest.mark.parametrize(
    "left,right",
    [
        ("statuteMiles", "Kilometers"),
        ("Nautical Miles", "statuteMiles"),
        ("Kilometres", "NauticalMiles"),
        ("Pounds", "kg"),
        ("liters", "kg"),
        ("Pounds", "liters"),
        ("U.S.Gallons", "Litres"),
        ("US gallons", "quarts"),
        ("ImperialGallons", "gal"),
        ("imp. gallons", "l"),
        ("inches", "cm"),
        ("millimeters", "metres"),
        ("ft", "m"),
        ("sq. inches", "square centimeters"),
        ("cubic inches", "cu. cm"),
        ("ft²", "m²"),
        ("cm³", "m³"),
        ("statuteMiles/hour", "kilometers per hour"),
        ("knots", "mph"),
        ("Celsius", "Fahrenheit"),
        ("°C", "°F"),
        ("hp", "kW"),
        ("watts", "horsepower"),
        ("psi", "hPa"),
        ("in. Hg", "mbar"),
    ],
)
@pytest.mark.parametrize("operator", ["x", "×"])
@pytest.mark.parametrize("gap", ["", " ", "\t"])
def test_complete_known_units_and_tight_or_spaced_relation(left, right, operator, gap):
    text = f"({left}{gap}{operator}{gap}.375{gap}={gap}{right})"
    assert numbers(text) == {Decimal(".375")}


@pytest.mark.parametrize(
    "literal,value",
    [
        ("7", "7"),
        ("1.375", "1.375"),
        ("1 .375", "1.375"),
        ("1. 3750", "1.3750"),
        ("1 \t.\t 375", "1.375"),
        (".375", ".375"),
        ("0.0375", ".0375"),
        ("1,000.125", "1000.125"),
        ("1 ,000 .125", "1000.125"),
    ],
)
@pytest.mark.parametrize("sign", ["", "+", "-", "−", "–"])
def test_complete_factor_preserves_sign_and_precision(literal, value, sign):
    expected = Decimal(value) * (-1 if sign in ("-", "−", "–") else 1)
    assert numbers("Kilometersx" + sign + literal + "=StatuteMiles") == {expected}


@pytest.mark.parametrize(
    "text",
    [
        "x.375",
        "Milesx.375",
        "Milesx.375=",
        "Milesx.375=unknown",
        "unknownx.375=Kilometers",
        "prefixMilesx.375=Kilometers",
        "prefix-Milesx.375=km",
        "prefix/Milesx.375=km",
        "prefix.Milesx.375=km",
        "prefix+Milesx.375=km",
        "MilesX.375=Kilometers",
        "Miles*.375=Kilometers",
        "Miles/.375=Kilometers",
        "Milesx.375-Kilometers",
        "Milesx.375=km-code",
        "Milesx.375=km/model",
        "Milesx.375=km.model",
        "Milesx.375=km2",
        "Milesx.375=km_more",
        "Milesx.375e2=km",
        "Milesx.375%=km",
        "Milesx.375.2=km",
        "Milesx..375=km",
        "Milesx. 375=km",
        "Milesx3,75=km",
        "Milesx1 375=km",
        "Milesx--.375=km",
        "Milesx- .375=km",
        "Milesx+ .375=km",
        "Milesx−\t.375=km",
        "Milesx+.375-=km",
        "Milesx.375/.5=km",
        "Milesx.375-.5=km",
        "Milesx.375x.5=km",
        "Milesx.375=kmx.5=feet",
        "Milesx.375=km x.5=feet",
        "Milesx.375=km=feet",
        "Milesx.375=km per second",
        "Miles\nx.375=km",
        "Milesx.375\n=km",
        "Milesx.375=\nkm",
        "Milesx1\n.375=km",
        "Milesx1.\n375=km",
        "Nautical\nMilesx.375=km",
        "Statute\nMilesx.375=km",
        "cubic\ninchesx.375=cm³",
        "U.\nS. Gallonsx.375=liters",
        "Milesx.375=Nautical\nMiles",
        "MilesxI.375=km",
        "Milesxl.375=km",
        "Milesx1.S75=km",
        "Milesx.S75=km",
        "Milesx.375=Kilomoters",
        "NautіcalMilesx.375=km",
    ],
)
def test_incomplete_ids_chains_unknown_units_corruption_and_line_joins_unchanged(text):
    assert _comparison_conversion_factors(text) == text
    assert Decimal(".375") not in numbers(text)


@pytest.mark.parametrize(
    "label",
    [
        "P/N",
        "PN",
        "Part No.",
        "Part Number:",
        "Model",
        "Code:",
        "Identifier",
        "Ref.",
        "reference #",
        "Section",
        "Sec.",
        "Figure",
        "Fig.",
        "Table:",
        "serial",
        "Serial Number:",
        "S/N",
        "Registration",
        "Tail Number:",
        "ref",
    ],
)
def test_complete_looking_identifier_labels_still_do_not_supply_a_coefficient(label):
    text = label + " (NauticalMilesx.375=Kilometers)"
    assert _comparison_conversion_factors(text) == text
    assert Decimal(".375") not in numbers(text)


def evidence(text):
    return [
        {
            "passage_id": 1,
            "document_id": "doc_equation",
            "page": 5,
            "label": "1-5",
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


def test_original_quote_and_model_wire_are_unchanged():
    sources = evidence("The printed relation is (NauticalMilesx1 .3750=Kilometers).")
    candidate = answer("The printed coefficient is 1.3750.")
    saved = copy.deepcopy((sources, candidate))
    wire = copy.deepcopy(model_evidence(sources))
    result = validate_answer(candidate, sources)
    assert result["claims"][0]["text"] == candidate["claims"][0]["text"]
    assert result["claims"][0]["citations"][0]["quote"] == sources[0]["text"]
    assert (sources, candidate) == saved and model_evidence(sources) == wire


@pytest.mark.parametrize("value", ["1", "375", "1.38", "-1.375", "0.727", "7"])
def test_full_decimal_does_not_supply_components_rounded_inverse_or_signed_values(value):
    with pytest.raises(ModelUnavailable, match="numeric values absent"):
        validate_answer(
            answer("The coefficient is " + value + "."),
            evidence("(NauticalMilesx1 .375=Kilometers)"),
        )


def test_two_independent_relations_preserve_their_two_coefficients():
    assert numbers("(Milesx1.375=km) (kmx.625=Miles)") == {Decimal("1.375"), Decimal(".625")}


def test_complete_unit_relation_does_not_infer_or_approve_a_physical_conversion():
    sources = evidence("The supplied note prints (Poundsx.375=Liters).")
    assert validate_answer(answer("The note prints a coefficient of 0.375."), sources)["claims"]
    with pytest.raises(ModelUnavailable, match="numeric values absent"):
        validate_answer(answer("The computed inverse is 2.667."), sources)


@pytest.mark.parametrize("sign", ["", "+", "-", "−", "–"])
def test_delimited_decimal_is_a_literal_without_unit_spelling_inference(sign):
    expected = Decimal("-.375" if sign in ("-", "−", "–") else ".375")
    assert numbers("The printed value is " + sign + ".375.") == {expected}
    assert numbers("(Liters x " + sign + ".375 = lmpenal Gallons)") == {expected}


@pytest.mark.parametrize("text", ["Pounds x\n.375 = kg", "Milesx\n.375=km"])
def test_standalone_literal_on_another_line_does_not_join_the_relation(text):
    assert _comparison_conversion_factors(text) == text
    assert "\n" in _comparison_leading_decimals(text)
    assert numbers(text) == {Decimal(".375")}


@pytest.mark.parametrize(
    "text",
    [
        "code.375",
        "code-.375",
        "code/.375",
        "code+.375",
        "0.375",
        "x.375",
        ".375foo",
        ".375.model",
        ".375/2",
        ".375-.5",
        ".375.2",
        ". 375",
        "-. 375",
        "- .375",
        "+\t.375",
        "−\n.375",
        "– \t.375",
        "--.375",
        "P/N .375",
        "Model (.375)",
        "reference # .375",
        "Figure .375",
        "Serial .375",
        "Model (Liters x .375 = lmpenal Gallons)",
        "P/N (kg x .375 = liters)",
    ],
)
def test_leading_decimal_boundaries_labels_and_signs_are_not_guessed(text):
    assert _comparison_leading_decimals(text) == text


def test_leading_literal_keeps_strict_numeric_and_quote_checks():
    sources = evidence("The supplied note says (Liters x .375 = lmpenal Gallons).")
    assert validate_answer(answer("The printed coefficient is 0.375."), sources)["claims"]
    with pytest.raises(ModelUnavailable, match="numeric values absent"):
        validate_answer(answer("The rounded coefficient is 0.38."), sources)


def test_fractional_tail_of_a_split_measurement_is_not_a_standalone_decimal():
    assert numbers("The mass is 1 .375 kg.") == {Decimal("1.375")}
    assert _comparison_leading_decimals("1\n.375 kg") == "1\n.375 kg"
    assert _comparison_leading_decimals("1 .375 kg") == "1 .375 kg"


def test_separate_numeric_columns_preserve_an_adjacent_negative_literal():
    assert numbers("17 -15.7 -.375") == {Decimal("17"), Decimal("-15.7"), Decimal("-.375")}
    assert numbers("17 -15.7 −.375") == {Decimal("17"), Decimal("-15.7"), Decimal("-.375")}


def test_binary_operator_or_count_dash_does_not_negate_the_next_literal():
    assert numbers("1 - .050 Allen wrench") == {Decimal("1"), Decimal(".050")}
    assert numbers("1 + .375") == {Decimal("1"), Decimal(".375")}
    assert numbers("1 - -.375") == {Decimal("1"), Decimal("-.375")}
    assert numbers("1\n- .375") == {Decimal("1")}


def test_printed_letter_is_not_an_inferred_missing_zero():
    with pytest.raises(ModelUnavailable, match="numeric values absent"):
        validate_answer(
            answer("The sample value is .375 kg."), evidence("The table shows o.375 kg.")
        )
