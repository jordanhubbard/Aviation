"""Signed feedback explains rejected operands without relaxing source admission."""

import copy
import hashlib
import json
from decimal import localcontext

import pytest

from app.services.aircraft_library.models import (
    ASSERTION_CORRECTION_POLICY, CITATION_FORMAT, CORRECTION_POLICY,
    LEGACY_CORRECTION_POLICY, SIGNED_CORRECTION_POLICY, SYSTEM,
    ModelUnavailable, _signed_source_diagnostics, distill, distillation_context,
    source_excerpts, validate_answer, verified_completion,
)
from app.services.aircraft_library.recovery import recover_distillation
from app.services.aircraft_library.source_limits import VerifiedSourceLimit
from .test_aircraft_library_resume import snapshot
from .test_aircraft_library_reviewed_recovery import make_recovery_library
from .test_library_assertion_repair import answer, claim
from .test_library_correction_schema import model, properties, response
from .test_library_numeric_layout import source


EVIDENCE = [source(
    "Zero wind ground roll 1055 feet; decrease -137 feet; corrected 918 feet. "
    "Total distance 2035 feet; decrease -265 feet; corrected 1770 feet."
)]
KEPT = claim("Corrected ground roll is 918 feet.")
FAILED = claim("Corrected ground roll is 918 feet (1055 - 137); "
               "total distance is 1770 feet (2035 - 265).")
LITERAL = claim("Ground roll decrease is -137 feet; corrected roll is 918 feet. "
                "Total distance decrease is -265 feet; corrected distance is 1770 feet.")


@pytest.mark.parametrize("policy,output,expected", [
    (LEGACY_CORRECTION_POLICY, "json_object",
     "0cf574a685323e541ef498ad5705f5ccb045f8ef13412298f68c65b74a60d3d7"),
    (LEGACY_CORRECTION_POLICY, "json_schema",
     "9aa8ae51ae97eb40d9d8f7e2ac6ec388350a79755fb04f1ac659a33c4ef8f27a"),
    (ASSERTION_CORRECTION_POLICY, "json_object",
     "6e0165810094ad9d7a83a76227be1ac0c57498fc5580673674dfe82838a4a438"),
    (ASSERTION_CORRECTION_POLICY, "json_schema",
     "c2933b80423dd1571d1f3645a1b4a9f5a805504c34496c545181617dd071bb9e"),
])
def test_explicit_predecessors_preserve_complete_wire_contract(policy, output, expected):
    # Captured independently from deployed predecessor 0f9d2b091: initial
    # request plus both rejected correction requests, including all schemas.
    calls = []

    def provider(request):
        calls.append(json.loads(request.content))
        return response([KEPT, FAILED] if len(calls) == 1 else [FAILED])

    with pytest.raises(ModelUnavailable, match="numeric values"):
        verified_completion(model(provider, output), EVIDENCE, "Summarize",
                            correction_policy=policy)
    assert len(calls) == 3
    encoded = json.dumps(calls, sort_keys=True, separators=(",", ":")).encode()
    assert hashlib.sha256(encoded).hexdigest() == expected


@pytest.mark.parametrize("kind,output,expected", [
    ("amount", "json_object",
     "679da45e6449548c493d2ea4961b68c19238f7dbc3ccda5056ad70217118913e"),
    ("amount", "json_schema",
     "53e2278389b4ac7445ba0ffb2196c8b1a15ee82543b5ce7986df03be87b485a7"),
    ("identifier", "json_object",
     "26c96ffd56eb64c85647bae778e7053fdb7d49cc5f2f1a29a1b38155c0c05f66"),
    ("identifier", "json_schema",
     "621a295a60a0e59909e507463851623ce6f95c2079de31d84ea96bfceb51472d"),
])
def test_stopped_v3_preserves_its_complete_replay_including_identifier_diagnostics(
    kind, output, expected,
):
    # Independently captured from frozen ea9a31dcf. Replaying the old diagnostic
    # never makes its unsupported positive value admissible.
    evidence = EVIDENCE if kind == "amount" else [source(
        "P/N –137 feet. Real decrease -265 feet.")]
    initial = [KEPT, FAILED] if kind == "amount" else [claim("Adjustment is 137 feet.")]
    replacement = [FAILED] if kind == "amount" else initial
    calls = []

    def provider(request):
        calls.append(json.loads(request.content))
        return response(initial if len(calls) == 1 else replacement)

    with pytest.raises(ModelUnavailable, match="numeric values"):
        verified_completion(model(provider, output), evidence, "Summarize",
                            correction_policy=SIGNED_CORRECTION_POLICY)
    assert len(calls) == 3
    assert hashlib.sha256(json.dumps(
        calls, sort_keys=True, separators=(",", ":")).encode()).hexdigest() == expected


@pytest.mark.parametrize("output", ["json_object", "json_schema"])
def test_signed_operands_are_explained_and_only_rejected_position_repaired(output):
    calls = []
    before = copy.deepcopy((EVIDENCE, KEPT, FAILED))

    def provider(request):
        payload = json.loads(request.content)
        calls.append(payload)
        if len(calls) == 1:
            return response([KEPT, FAILED])
        question = json.loads(payload["messages"][1]["content"])["question"]
        failure, = json.loads(question.rsplit("\n", 1)[-1])["rejected_claims"]
        assert failure["claim_number"] == 2
        assert failure["signed_source_diagnostics"] == {
            "matches": [
                {"citation_number": 1, "passage_id": 1, "excerpt_id": 0,
                 "rejected_numeric_value": "137", "cited_signed_numeric_value": "-137"},
                {"citation_number": 1, "passage_id": 1, "excerpt_id": 0,
                 "rejected_numeric_value": "265", "cited_signed_numeric_value": "-265"},
            ], "limited": False, "supports_rejected_values": False,
        }
        assert "subtraction expression still contains an unsigned operand" in question
        assert "Do not evaluate arithmetic" in question
        if output == "json_schema":
            shape = properties(payload)["claims"]
            assert shape["minItems"] == shape["maxItems"] == 1
        return response([LITERAL])

    value = verified_completion(model(provider, output), EVIDENCE, "Summarize")
    assert value == validate_answer(answer([KEPT, LITERAL]), EVIDENCE)
    assert len(calls) == 2 and (EVIDENCE, KEPT, FAILED) == before


def test_unchanged_subtraction_is_rejected_after_same_three_candidates():
    calls = []

    def provider(request):
        calls.append(request)
        return response([FAILED])

    with pytest.raises(ModelUnavailable, match="numeric values") as caught:
        verified_completion(model(provider), EVIDENCE, "Summarize")
    assert len(calls) == 3
    assert "137" not in str(caught.value) and "265" not in str(caught.value)


def test_diagnostics_use_actual_cited_spans_only():
    first = "Ground roll 918 feet. " + "Source context. " * 75
    evidence = [source(first + "Decrease -137 feet."),
                {**source("Decrease -265 feet."), "passage_id": 2}]
    assert len(source_excerpts(evidence[0])) > 1
    assert _signed_source_diagnostics(["137", "265"], claim("137 feet"), evidence) is None
    quoted = {"text": "137 feet", "citations": [
        {"passage_id": 1, "quote": "Decrease -137 feet."}]}
    result = _signed_source_diagnostics(["137", "265"], quoted, evidence)
    assert result["matches"] == [{"citation_number": 1, "passage_id": 1,
                                  "rejected_numeric_value": "137",
                                  "cited_signed_numeric_value": "-137"}]
    for citation in [
        {"passage_id": 1, "excerpt_id": 0, "quote": "Decrease -137 feet."},
        {"passage_id": 1, "excerpt_id": True},
        {"passage_id": True, "excerpt_id": 0},
        {"passage_id": 100, "excerpt_id": 0},
        {"passage_id": 1, "quote": "Fabricated -137 feet."},
    ]:
        assert _signed_source_diagnostics(["137"], {"citations": [citation]}, evidence) is None


@pytest.mark.parametrize("text", [
    "P/N -137. Reference -265; positive 918 feet.",
    "Figure 5-137, Page 5-265; positive 918 feet.",
    "Part number -137. Serial number -265; positive 918 feet.",
    "P/N –137 feet. Reference −265 feet.",
    "Serial number – 137 feet. Registration –265 feet.",
    "Figure –137 feet. Page – 265 feet.",
    "Figures: –137 feet. pp. –265 feet.",
    "P/N A.-137 feet. Reference 1055 – 265 feet.",
    "Part number is –137 feet. Section: –265 feet.",
    "Reference –137.5 feet. Serial number –265.5 feet.",
    "ID –137 feet. Registration No. –265 feet.",
    "Model No. –137 feet. Reference No. –265 feet.",
    "Page No. –137 feet. P/N: No. –265 feet.",
])
def test_identifier_components_do_not_become_signed_amount_diagnostics(text):
    assert _signed_source_diagnostics(["137", "265", "137.5", "265.5"],
                                      FAILED, [source(text)]) is None


@pytest.mark.parametrize("text", [
    "Decrease –137 feet.",
    "Decrease −137 feet.",
    "P/N -265. Decrease –137 feet.",
    "Tailwind adjustment –137 feet.",
    "Referenced adjustment –137 feet.",
    "P –137 feet.",
])
def test_identifier_filter_preserves_genuine_signed_amounts_and_word_boundaries(text):
    hints = _signed_source_diagnostics(["137", "265"], FAILED, [source(text)])
    assert [row["cited_signed_numeric_value"] for row in hints["matches"]] == ["-137"]


@pytest.mark.parametrize("output", ["json_object", "json_schema"])
def test_v4_correction_never_instructs_a_signed_amount_from_an_identifier(output):
    evidence = [source("P/N –137 feet. Real decrease -265 feet.")]
    calls = []

    def provider(request):
        payload = json.loads(request.content)
        calls.append(payload)
        if len(calls) == 1:
            return response([claim("Real decrease is 137 feet.")])
        question = json.loads(payload["messages"][1]["content"])["question"]
        assert "signed_source_diagnostics" not in question
        assert "Signed-source diagnostics identify" not in question
        return response([claim("Real decrease is -265 feet.")])

    value = verified_completion(model(provider, output), evidence, "Summarize")
    assert value == validate_answer(answer([claim("Real decrease is -265 feet.")]), evidence)
    assert len(calls) == 2


@pytest.mark.parametrize("extra", [
    {"source_limit": VerifiedSourceLimit(original_image_only=True)},
    {"source_limit": {"original_image_only": True}},
    {"transcription_review": {"id": "unverified"}},
])
def test_restricted_or_unverified_source_channels_are_excluded(extra):
    assert _signed_source_diagnostics(["137"], FAILED, [{**EVIDENCE[0], **extra}]) is None


def test_diagnostics_are_bounded_deduplicated_and_not_arithmetic():
    evidence = [source("Decreases " + "; ".join(f"-{i} feet" for i in range(1, 35)))]
    candidate = {"citations": [{"passage_id": 1, "excerpt_id": 0}] * 8}
    hints = _signed_source_diagnostics([str(i) for i in range(1, 35)], candidate, evidence)
    assert len(hints["matches"]) == 8 and hints["limited"]
    assert not hints["supports_rejected_values"]
    assert all(row["citation_number"] == 1 for row in hints["matches"])
    assert _signed_source_diagnostics(["0", "-137", "NaN", "Infinity", "bad", True],
                                      FAILED, EVIDENCE) is None
    assert _signed_source_diagnostics(["137"], FAILED,
                                      [source("Corrected value 1055 - 137 feet.")]) is None


@pytest.mark.parametrize("precision,value,exact,nearby", [
    (2, "137", "-137", "-140"),
    (4, "123456", "-123456", "-123500"),
    (28, "123456789012345678901234567890",
     "-123456789012345678901234567890", "-123456789012345678901234567900"),
])
def test_signed_counterparts_are_exact_independent_of_decimal_context(
    precision, value, exact, nearby,
):
    with localcontext() as context:
        context.prec = precision
        hints = _signed_source_diagnostics([value], FAILED, [source(f"Adjustment {exact} feet.")])
        assert hints["matches"][0]["cited_signed_numeric_value"] == exact
        assert _signed_source_diagnostics([value], FAILED,
                                          [source(f"Adjustment {nearby} feet.")]) is None


def test_v3_replay_retains_its_old_rounding_diagnostic_without_admitting_a_claim():
    evidence = [source("Adjustment -140 feet.")]
    with localcontext() as context:
        context.prec = 2
        hints = _signed_source_diagnostics(["137"], FAILED, evidence,
                                            correction_policy=SIGNED_CORRECTION_POLICY)
        assert hints["matches"][0]["cited_signed_numeric_value"] == "-140"
        assert not hints["supports_rejected_values"]
        with pytest.raises(ModelUnavailable, match="numeric values"):
            validate_answer(answer([claim("Adjustment is 137 feet.")]), evidence)


@pytest.mark.parametrize("policy", [ASSERTION_CORRECTION_POLICY, SIGNED_CORRECTION_POLICY])
def test_predecessor_generation_is_reconstructed_but_never_recovered_as_v4(
    tmp_path, monkeypatch, policy,
):
    store, identifier, provider = make_recovery_library(tmp_path, monkeypatch)
    old_context = distillation_context(store, provider, identifier,
                                      correction_policy=policy)
    current = distillation_context(store, provider, identifier)
    assert old_context[:3] == current[:3] and old_context[3] != current[3]
    expected = dict(provider=provider.base, model=provider.model, system=SYSTEM,
                    question=old_context[2], batches=old_context[1],
                    citation_format=CITATION_FORMAT,
                    correction_policy=policy)
    assert old_context[3] == hashlib.sha256(json.dumps(
        expected, sort_keys=True, separators=(",", ":")).encode()).hexdigest()
    old = distill(store, provider, identifier)
    old.update(correction_policy=policy,
               evidence_identity=old_context[3])
    store.artifact(identifier, "distillation", old)
    backup = snapshot(store, tmp_path / "v2.sqlite3")
    before = copy.deepcopy(store.get(identifier)["artifacts"])
    with pytest.raises(ValueError, match="cannot change.*correction policy"):
        recover_distillation(store, provider, identifier, backup)
    assert store.get(identifier)["artifacts"] == before
    provider.calls.clear()
    new = distill(store, provider, identifier)
    assert new["correction_policy"] == CORRECTION_POLICY and provider.calls
    assert new["evidence_identity"] != old["evidence_identity"]
    assert any(store.historical_distillation(identifier, row["revision_id"])["artifact"] == old
               for row in store.distillations(identifier)["items"])
