"""Equivalent printed references must not become signed measurement evidence."""

import pytest

from app.services.aircraft_library.models import (
    ModelUnavailable,
    validate_answer,
    verified_completion,
)
from .test_library_numeric_layout import answer, source


@pytest.mark.parametrize(
    "original,claim",
    [
        (
            "See Figure 7    -3 in Section 7 for location.",
            "See Figure 7-3 in Section 7 for location.",
        ),
        ("See FIGURE 7    -3 for location.", "See fig. 7-3 for location."),
        ("See Fig. 7 \t-3 for location.", "See Figure7-3 for location."),
        ("See Table 8 -1 for values.", "See table 8-1 for values."),
        ("See Section 13 -5 for applicability.", "See Sec. 13-5 for applicability."),
        ("See SL      -00078 for information.", "See SL-00078 for information."),
        ("See sb -00078 for information.", "See SB-00078 for information."),
        ("See SB 13    -03-21 for information.", "See SB 13-03-21 for information."),
        ("See SB13 -03 -21 for information.", "See SB13-03-21 for information."),
        ("See SB -13 -03-21 for information.", "See SB-13-03-21 for information."),
        ("See Figure 7-3 for location.", "See Figure 7 -3 for location."),
        ("See SL-00078 for information.", "See SL -00078 for information."),
    ],
)
def test_equivalent_reference_only_resolves_its_own_components(original, claim):
    result = validate_answer(answer(claim), [source(original)])
    assert result["claims"][0]["text"] == claim
    assert result["claims"][0]["citations"][0]["quote"] == original


@pytest.mark.parametrize(
    "original,claim",
    [
        ("See Figure 7 -3 for location.", "See Figure 7-4 for location."),
        ("See Table 7 -3 for values.", "See Figure 7-3 for values."),
        ("See Section 7 -3 for applicability.", "See Table 7-3 for applicability."),
        ("See Figure 7 -03 for location.", "See Figure 7-3 for location."),
        ("See SL -00078 for information.", "See SL-78 for information."),
        ("See SL -00078 for information.", "See SL-00079 for information."),
        ("See SB 13 -03-21 for information.", "See SB 13-3-21 for information."),
        ("See SB 13 -03-21 for information.", "See SB-13-03-21 for information."),
        ("See SB\n13 -03-21 for information.", "See SB 13-03-21 for information."),
        ("See Figure 7\n-3 for location.", "See Figure 7-3 for location."),
        ("See Figure 7 -3.1 for location.", "See Figure 7-3.1 for location."),
        ("See Figure 7 −3 for location.", "See Figure 7-3 for location."),
        ("See untyped 7 -3 for location.", "See Figure 7-3 for location."),
    ],
)
def test_mismatched_or_partial_references_do_not_bypass_numeric_rejection(original, claim):
    with pytest.raises(ModelUnavailable, match="numeric values"):
        validate_answer(answer(claim), [source(original)])


@pytest.mark.parametrize("minus", ["-", "−"])
def test_reference_component_cannot_support_a_separate_positive_measurement(minus):
    original = f"See Figure 7 -3 for location. Minimum temperature is {minus}3 C."
    good = "See Figure 7-3 for location. Minimum temperature is -3 C."
    assert validate_answer(answer(good), [source(original)])["claims"]
    with pytest.raises(ModelUnavailable, match="numeric values"):
        validate_answer(answer(good.replace("is -3", "is 3")), [source(original)])


def test_service_identifier_does_not_grant_its_magnitude_as_a_scalar():
    original = "Refer to SL -00078. Maximum power is 100 hp."
    good = "Refer to SL-00078. Maximum power is 100 hp."
    assert validate_answer(answer(good), [source(original)])["claims"]
    with pytest.raises(ModelUnavailable, match="numeric values"):
        validate_answer(answer(good + " Its temperature limit is 78 C."), [source(original)])


@pytest.mark.parametrize(
    "original,reference,scalar",
    [
        ("See Figure 7 -3 for location.", "See Figure 7-3.", "7"),
        ("See Figure 7 -3 for location.", "See Figure 7-3.", "-3"),
        ("See SL -00078 for information.", "See SL-00078.", "-78"),
        ("See SB 13 -03-21 for information.", "See SB 13-03-21.", "13"),
    ],
)
def test_reference_fallback_requires_independent_scalar_evidence(original, reference, scalar):
    claim = f"{reference} Temperature is {scalar} C."
    with pytest.raises(ModelUnavailable, match="numeric values"):
        validate_answer(answer(claim), [source(original)])

    # The identical scalar is accepted when separately stated in exact evidence.
    stated = f"{original} Temperature is {scalar} C."
    result = validate_answer(answer(claim), [source(stated)])
    assert result["claims"][0]["text"] == claim
    assert result["claims"][0]["citations"][0]["quote"] == stated


def test_reference_fallback_accepts_scalar_in_another_exact_quote():
    original = "See SL -00078 for information. Temperature is −78 C."
    value = answer("See SL-00078. Temperature is -78 C.")
    value["claims"][0]["citations"] = [
        {"passage_id": 1, "quote": "See SL -00078 for information."},
        {"passage_id": 1, "quote": "Temperature is −78 C."},
    ]
    assert validate_answer(value, [source(original)])["claims"]


def test_matching_reference_does_not_hide_a_different_uncited_reference_component():
    original = "See Figure 7 -3 and Section 8 -3 for location."
    value = answer("See Figure 7-3 and Table 8-3 for location.")
    with pytest.raises(ModelUnavailable, match="numeric values"):
        validate_answer(value, [source(original)])


def test_reference_components_cannot_be_joined_across_quoted_spans():
    original = "See Figure 7 -3 for the switch location."
    value = answer("See Figure 7-3 for the switch location.")
    value["claims"][0]["citations"] = [
        {"passage_id": 1, "quote": "See Figure 7"},
        {"passage_id": 1, "quote": "-3 for the switch location."},
    ]
    with pytest.raises(ModelUnavailable, match="numeric values"):
        validate_answer(value, [source(original)])


def test_metadata_and_uncited_reference_do_not_supply_support():
    original = "Values 7 and -3 are shown without a reference. " + "Other text. " * 110
    original += "See Figure 7-3 for location."
    evidence = [source(original)]
    evidence[0]["metadata"]["notes"] = "See Figure 7-3 for location."
    with pytest.raises(ModelUnavailable, match="numeric values"):
        validate_answer(answer("See Figure 7-3 for location."), evidence)


def test_matching_reference_does_not_consume_the_correction_budget():
    original = "See Figure 7 -3 for the switch location."

    class Provider:
        calls = 0

        def complete(self, evidence, question):
            self.calls += 1
            return answer("See Figure 7-3 for the switch location.")

    models = Provider()
    result = verified_completion(models, [source(original)], "Summarize")
    assert len(result["claims"]) == 1 and models.calls == 1
