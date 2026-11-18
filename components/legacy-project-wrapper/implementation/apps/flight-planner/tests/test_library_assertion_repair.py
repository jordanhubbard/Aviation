"""Rejected text is not verified by unrelated numbers; policy changes are explicit."""

import copy
import hashlib
import json

import httpx
import pytest

from app.services.aircraft_library.models import (
    CITATION_FORMAT, CORRECTION_POLICY, LEGACY_CORRECTION_POLICY, SYSTEM,
    ModelUnavailable, _rejected_claims, distill, distillation_context,
    validate_answer, verified_completion,
)
from app.services.aircraft_library.recovery import recover_distillation
from .test_aircraft_library_resume import snapshot
from .test_aircraft_library_reviewed_recovery import make_recovery_library
from .test_library_correction_schema import model, properties, response
from .test_library_numeric_layout import source


def claim(text, passage=1):
    return {"text": text, "citations": [{"passage_id": passage, "excerpt_id": 0}]}


def answer(claims):
    return {"insufficient_evidence": False, "reason": "", "claims": claims}


EVIDENCE = [source("Endurance is 8.05 HRS. Power is 75%."),
            {**source("See page 8, revision 5."), "passage_id": 2}]
FAILED = claim("Endurance is 8:05 HRS.")
LITERAL = claim("Endurance is 8.05 HRS.")
KEPT = claim("Power is 75%.")


@pytest.mark.parametrize("output", ["json_object", "json_schema"])
def test_literal_repair_is_not_frozen_by_unrelated_page_numbers(output):
    calls = []
    before = copy.deepcopy(EVIDENCE)

    def provider(request):
        payload = json.loads(request.content)
        calls.append(payload)
        if len(calls) == 1:
            return response([KEPT, FAILED])
        question = json.loads(payload["messages"][1]["content"])["question"]
        rejected = json.loads(question.rsplit("\n", 1)[-1])["rejected_claims"]
        assert len(rejected) == 1 and rejected[0]["claim_number"] == 2
        assert rejected[0]["numeric_evidence_options"]["matches"]
        assert "citation_only" not in rejected[0]
        assert "literal supplied source form" in question
        if output == "json_schema":
            shape = properties(payload)["claims"]
            assert shape["minItems"] == shape["maxItems"] == 1
            assert "enum" not in shape["items"]["properties"]["text"]
        return response([LITERAL])

    value = verified_completion(model(provider, output), EVIDENCE, "Summarize", max_attempts=2)
    assert [c["text"] for c in value["claims"]] == [KEPT["text"], LITERAL["text"]]
    assert value["claims"][0] == validate_answer(answer([KEPT]), EVIDENCE)["claims"][0]
    assert len(calls) == 2 and EVIDENCE == before


def test_legacy_replay_keeps_the_original_unsupported_text_lock():
    failures = _rejected_claims(answer([FAILED]), EVIDENCE,
                                correction_policy=LEGACY_CORRECTION_POLICY)
    assert failures[0]["citation_only"]
    assert "citation_only" not in _rejected_claims(answer([FAILED]), EVIDENCE)[0]
    calls = []

    def provider(request):
        payload = json.loads(request.content)
        calls.append(payload)
        if len(calls) == 2:
            assert properties(payload)["claims"]["items"]["properties"]["text"]["enum"] == [FAILED["text"]]
            return response([LITERAL])
        return response([FAILED])

    with pytest.raises(ModelUnavailable, match="citation-only"):
        verified_completion(model(provider), EVIDENCE, "Summarize", max_attempts=2,
                            correction_policy=LEGACY_CORRECTION_POLICY)
    assert len(calls) == 2


@pytest.mark.parametrize("mode", ["unchanged", "missing", "insufficient", "extra"])
def test_repair_does_not_waive_validation_or_erase_rejected_positions(mode):
    calls = []

    def provider(request):
        calls.append(request)
        if len(calls) == 1:
            return response([KEPT, FAILED])
        if mode == "missing":
            return response([])
        if mode == "extra":
            return response([LITERAL, KEPT])
        if mode == "insufficient":
            value = response([]).json()
            value["choices"][0]["message"]["content"] = json.dumps({"insufficient_evidence": True, "claims": []})
            return httpx.Response(200, json=value)
        # Mere numeric occurrence elsewhere in the request supplies no citation.
        return response([FAILED])

    with pytest.raises(ModelUnavailable, match="numeric values" if mode == "unchanged" else "replace all"):
        verified_completion(model(provider), EVIDENCE, "Summarize")
    assert len(calls) == 3


@pytest.mark.parametrize("policy", ["unknown", None, [], True])
def test_unknown_policy_fails_before_any_model_call(policy):
    provider = model(lambda request: pytest.fail("Unknown policy reached provider"))
    with pytest.raises(ModelUnavailable, match="Unknown completion correction policy"):
        verified_completion(provider, EVIDENCE, "Summarize", correction_policy=policy)


def test_changed_policy_has_a_new_identity_but_exact_legacy_reconstruction(tmp_path, monkeypatch):
    store, identifier, provider = make_recovery_library(tmp_path, monkeypatch)
    old = distillation_context(store, provider, identifier, correction_policy=LEGACY_CORRECTION_POLICY)
    current = distillation_context(store, provider, identifier)
    assert old[:3] == current[:3] and old[3] != current[3]
    expected = dict(provider=provider.base, model=provider.model, system=SYSTEM,
                    question=old[2], batches=old[1], citation_format=CITATION_FORMAT)
    assert old[3] == hashlib.sha256(json.dumps(expected, sort_keys=True, separators=(",", ":")).encode()).hexdigest()
    artifact = distill(store, provider, identifier)
    assert artifact["correction_policy"] == CORRECTION_POLICY


def test_old_policy_prefix_is_archived_not_relabelled_or_recovered(tmp_path, monkeypatch):
    store, identifier, provider = make_recovery_library(tmp_path, monkeypatch)
    old = distill(store, provider, identifier)
    old.pop("correction_policy")
    old["evidence_identity"] = distillation_context(store, provider, identifier, correction_policy=LEGACY_CORRECTION_POLICY)[3]
    store.artifact(identifier, "distillation", old)
    backup = snapshot(store, tmp_path / "legacy.sqlite3")
    before = copy.deepcopy(store.get(identifier)["artifacts"])
    with pytest.raises(ValueError, match="cannot change.*correction policy"):
        recover_distillation(store, provider, identifier, backup)
    assert store.get(identifier)["artifacts"] == before
    provider.calls.clear()
    new = distill(store, provider, identifier)
    assert new["correction_policy"] == CORRECTION_POLICY and provider.calls
    assert new["evidence_identity"] != old["evidence_identity"]
    history = store.distillations(identifier)
    assert any(store.historical_distillation(identifier, row["revision_id"])["artifact"] == old for row in history["items"])
