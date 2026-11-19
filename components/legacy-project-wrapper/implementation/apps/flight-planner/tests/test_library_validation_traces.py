"""Diagnostics preserve admission and expose rejected candidates only privately."""

from concurrent.futures import ThreadPoolExecutor
import json
import os
from pathlib import Path
import sqlite3
import subprocess
import sys

import pytest

from app.services.aircraft_library import diagnostics
from app.services.aircraft_library.models import (
    CORRECTION_POLICY,
    Models,
    ModelTruncated,
    ModelUnavailable,
    verified_completion,
    distillation_context,
)
from app.services.aircraft_library.store import Store
from app.services.aircraft_library.worker import Worker
from .test_aircraft_library import manual


def evidence():
    return [
        {
            "document_id": "doc_fixture",
            "passage_id": 1,
            "page": 28,
            "label": "1-8",
            "text": "Oil capacity ........8 U.S. Quarts. Minimum temperature -12 C.",
            "method": "text",
            "metadata": {"icao": "SR22"},
        }
    ]


def answer(text):
    return {
        "insufficient_evidence": False,
        "reason": "",
        "claims": [{"text": text, "citations": [{"passage_id": 1, "excerpt_id": 0}]}],
    }


def provider(tmp_path, responses, *, trace=True):
    env = {
        "AIRCRAFT_LIBRARY_LLM_MODEL": "fixture",
        "AIRCRAFT_LIBRARY_LLM_BASE_URL": "https://fixture.example/v1",
        "AIRCRAFT_LIBRARY_LLM_API_KEY": "fixture-private-model-key",
    }
    if trace:
        env["AIRCRAFT_LIBRARY_VALIDATION_TRACE_DIR"] = str(tmp_path / "traces")
    model = Models(env)
    calls = []

    def complete(evidence, question):
        calls.append(question)
        result = responses[min(len(calls) - 1, len(responses) - 1)]
        if isinstance(result, BaseException):
            raise result
        return result

    model.complete = complete
    return model, calls


def records(tmp_path):
    with sqlite3.connect(tmp_path / "traces/validation.sqlite3") as db:
        return [json.loads(row[0]) for row in db.execute("SELECT payload FROM traces ORDER BY id")]


def test_final_rejection_is_retained_without_changing_public_error_or_retry_budget(tmp_path):
    model, calls = provider(tmp_path, [answer("Oil capacity is 99 U.S. Quarts.")])
    with pytest.raises(ModelUnavailable, match="numeric values") as caught:
        verified_completion(
            model,
            evidence(),
            "Private question",
            trace_context={"source_sha256": "a" * 64, "batch_position": 7},
        )
    rows = records(tmp_path)
    assert len(calls) == len(rows) == 3
    assert [r["final_attempt"] for r in rows] == [False, False, True]
    assert rows[-1]["candidate"]["claims"][0]["text"] == "Oil capacity is 99 U.S. Quarts."
    assert rows[-1]["numeric_feedback"]["unsupported_numeric_values"] == ["99"]
    assert rows[-1]["evidence"][0]["excerpts"][0] == evidence()[0]["text"]
    assert rows[-1]["context"]["batch_position"] == 7
    assert "Private question" not in json.dumps(rows)
    assert str(tmp_path) not in str(caught.value)
    assert "99" not in str(caught.value)
    assert os.stat(tmp_path / "traces").st_mode & 0o777 == 0o700
    assert os.stat(tmp_path / "traces/validation.sqlite3").st_mode & 0o777 == 0o600


def test_correction_shape_failure_retains_original_candidate_and_actual_response(tmp_path):
    refused = {"insufficient_evidence": True, "reason": "Unsupported", "claims": []}
    model, calls = provider(tmp_path, [answer("Oil capacity is 99 U.S. Quarts."), refused])
    with pytest.raises(ModelUnavailable, match="replace all 1"):
        verified_completion(model, evidence(), "Summary")
    rows = records(tmp_path)
    assert len(rows) == len(calls) == 3
    assert rows[-1]["response"]["claims"] == []
    assert len(rows[-1]["candidate"]["claims"]) == 1
    assert rows[-1]["replacement_positions"] == [0]
    assert rows[-1]["rejections"][0]["unsupported_numeric_values"] == ["99"]


def test_invalid_selected_scalar_types_remain_diagnosable_without_unknown_properties():
    value = answer("Oil capacity is 99 U.S. Quarts.")
    value["insufficient_evidence"] = 0
    value["reason"] = {"authorization": "do-not-retain"}
    value["claims"][0]["citations"][0]["passage_id"] = 1.5
    selected = diagnostics.candidate(value)
    assert selected["insufficient_evidence"] == 0
    assert selected["reason"] == {"invalid_type": "dict"}
    assert selected["claims"][0]["citations"][0]["passage_id"] == 1.5
    assert "do-not-retain" not in json.dumps(selected)


def test_truncated_final_correction_records_known_candidate_without_partial_json(tmp_path):
    model, calls = provider(
        tmp_path,
        [
            answer("Oil capacity is 99 U.S. Quarts."),
            ModelTruncated("Model required cited JSON answer was truncated"),
        ],
    )
    with pytest.raises(ModelUnavailable, match="truncated"):
        verified_completion(model, evidence(), "Summary")
    rows = records(tmp_path)
    assert len(rows) == len(calls) == 3
    assert rows[-1]["event"] == "truncation"
    assert rows[-1]["final_attempt"]
    assert not rows[-1]["response_available"]
    assert rows[-1]["response"] == {"invalid_type": "NoneType"}
    assert rows[-1]["candidate"]["claims"][0]["text"] == "Oil capacity is 99 U.S. Quarts."


def test_successful_correction_preserves_admitted_claims_and_only_records_rejection(tmp_path):
    model, calls = provider(
        tmp_path,
        [answer("Oil capacity is 99 U.S. Quarts."), answer("Oil capacity is 8 U.S. Quarts.")],
    )
    accepted = verified_completion(model, evidence(), "Summary")
    assert len(calls) == 2
    assert len(records(tmp_path)) == 1
    assert accepted["claims"][0]["text"] == "Oil capacity is 8 U.S. Quarts."
    assert accepted["claims"][0]["citations"][0]["quote"] == evidence()[0]["text"]


def test_disabled_and_successful_calls_perform_no_diagnostic_storage(tmp_path):
    model, _ = provider(tmp_path, [answer("Oil capacity is 99 U.S. Quarts.")], trace=False)
    with pytest.raises(ModelUnavailable):
        verified_completion(model, evidence(), "Summary")
    assert not (tmp_path / "traces").exists()

    model, _ = provider(tmp_path, [answer("Oil capacity is 8 U.S. Quarts.")])
    assert verified_completion(model, evidence(), "Summary")["claims"]
    assert not (tmp_path / "traces").exists()


def test_optional_context_failure_preserves_validation_and_success_never_evaluates_it(tmp_path):
    def unavailable():
        raise OSError("private/path/that/must/not/escape")

    model, _ = provider(tmp_path, [answer("Oil capacity is 99 U.S. Quarts.")])
    with pytest.raises(ModelUnavailable, match="numeric values") as caught:
        verified_completion(model, evidence(), "Summary", max_attempts=1, trace_context=unavailable)
    assert "private/path" not in str(caught.value)
    assert model.validation_trace_status == {"state": "unavailable"}
    good, _ = provider(tmp_path, [answer("Oil capacity is 8 U.S. Quarts.")])
    assert verified_completion(good, evidence(), "Summary", trace_context=unavailable)["claims"]
    assert not (tmp_path / "traces").exists()


def test_selected_text_redacts_model_key_and_omits_unknown_response_properties(tmp_path):
    payload = answer("fixture-private-model-key says oil capacity is 99 U.S. Quarts.")
    payload["authorization"] = "Bearer not-to-be-retained"
    model, _ = provider(tmp_path, [payload])
    with pytest.raises(ModelUnavailable):
        verified_completion(model, evidence(), "Summary")
    raw = json.dumps(records(tmp_path))
    assert "fixture-private-model-key" not in raw
    assert "not-to-be-retained" not in raw
    assert "authorization" not in raw
    assert "[redacted]" in raw


@pytest.mark.parametrize(
    "kind", ["directory_permissions", "directory_link", "database_link", "database_permissions"]
)
def test_insecure_storage_cannot_mask_the_evidence_failure(tmp_path, kind):
    model, _ = provider(tmp_path, [answer("Oil capacity is 99 U.S. Quarts.")])
    root = tmp_path / "traces"
    if kind == "directory_link":
        other = tmp_path / "other"
        other.mkdir(mode=0o700)
        root.symlink_to(other, target_is_directory=True)
    else:
        root.mkdir(mode=0o755 if kind == "directory_permissions" else 0o700)
        if kind == "directory_permissions":
            root.chmod(0o755)
        elif kind == "database_link":
            (root / "validation.sqlite3").symlink_to(tmp_path / "outside")
        else:
            (root / "validation.sqlite3").touch(mode=0o644)
            (root / "validation.sqlite3").chmod(0o644)
    with pytest.raises(ModelUnavailable, match="numeric values"):
        verified_completion(model, evidence(), "Summary", max_attempts=1)
    assert model.validation_trace_status == {"state": "unavailable"}
    assert not (tmp_path / "outside").exists()


def test_limits_are_atomic_across_concurrent_writers_and_restart(tmp_path, monkeypatch):
    root = tmp_path / "traces"
    monkeypatch.setattr(diagnostics, "MAX_RECORDS", 3)
    with ThreadPoolExecutor(max_workers=6) as pool:
        outcomes = list(
            pool.map(lambda n: diagnostics.ValidationTrace(root).write({"sequence": n}), range(12))
        )
    assert sum(r["state"] == "saved" for r in outcomes) == 3
    assert sum(r["state"] == "full" for r in outcomes) == 9
    assert len(records(tmp_path)) == 3
    assert diagnostics.ValidationTrace(root).write({"later": True})["state"] == "full"


def test_oversize_is_explicit_and_never_truncated_or_persisted(tmp_path, monkeypatch):
    monkeypatch.setattr(diagnostics, "MAX_BYTES", 100)
    result = diagnostics.ValidationTrace(tmp_path / "traces").write({"text": "x" * 101})
    assert result["state"] == "oversize"
    assert result["bytes"] > 100
    assert not (tmp_path / "traces").exists()


def test_diagnostics_preserve_distillation_identity_and_never_enter_public_capabilities(tmp_path):
    store = Store(tmp_path / "library")
    document = store.ingest(manual("Oil capacity is 8 U.S. Quarts."), {"icao": "SR22"})
    off, _ = provider(tmp_path, [], trace=False)
    on, _ = provider(tmp_path, [], trace=True)
    assert (
        distillation_context(store, off, document["id"])[3]
        == distillation_context(store, on, document["id"])[3]
    )
    assert off.capabilities() == on.capabilities()
    assert off.generation_options == on.generation_options
    assert off.embedding_identity == on.embedding_identity
    assert not (tmp_path / "traces").exists()


def test_worker_trace_binds_real_original_batch_and_index_without_leaking_into_job(tmp_path):
    store = Store(tmp_path / "library")
    document = store.ingest(manual("Oil capacity is 8 U.S. Quarts."), {"icao": "SR22"})
    model, calls = provider(tmp_path, [answer("Oil capacity is 99 U.S. Quarts.")])
    source_identity = store.index_identity(document["id"])
    fingerprint = distillation_context(store, model, document["id"])[3]
    job = store.create_job("distill", {"document_id": document["id"]})
    assert Worker(store, model).run_one()
    recorded = records(tmp_path)
    assert len(recorded) == len(calls) == 3
    assert recorded[-1]["context"] == {
        "operation": "distillation",
        "document_id": document["id"],
        "source_sha256": document["sha256"],
        "index_identity": source_identity,
        "evidence_identity": fingerprint,
        "batch_position": 0,
        "correction_policy": CORRECTION_POLICY,
    }
    assert recorded[-1]["correction_policy"] == CORRECTION_POLICY
    public = store.job(job["id"])
    assert public["state"] == "failed"
    assert "numeric values" in public["error"]
    assert str(tmp_path) not in json.dumps(public)
    assert "Oil capacity is 99" not in json.dumps(public)
    assert "numeric_feedback" not in public
    assert store.index_identity(document["id"]) == source_identity
    assert store.get(document["id"])["artifacts"]["distillation"]["sections"] == []


def test_actual_processes_share_the_same_durable_limit(tmp_path):
    code = """import sys,json
from app.services.aircraft_library.diagnostics import ValidationTrace
trace=ValidationTrace(sys.argv[1])
states=[trace.write({'fixture':i})['state'] for i in range(20)]
print(json.dumps({'saved':states.count('saved'),'full':states.count('full')}))
"""
    children = []
    try:
        for _ in range(4):
            children.append(
                subprocess.Popen(
                    [sys.executable, "-c", code, str(tmp_path / "traces")],
                    cwd=Path(__file__).resolve().parents[1] / "backend",
                    stdout=subprocess.PIPE,
                    stderr=subprocess.PIPE,
                    text=True,
                )
            )
        outcomes = []
        for child in children:
            stdout, stderr = child.communicate(timeout=15)
            assert child.returncode == 0, stderr
            outcomes.append(json.loads(stdout))
        assert sum(row["saved"] for row in outcomes) == diagnostics.MAX_RECORDS
        assert sum(row["full"] for row in outcomes) == 80 - diagnostics.MAX_RECORDS
        assert len(records(tmp_path)) == diagnostics.MAX_RECORDS
    finally:
        for child in children:
            if child.poll() is None:
                child.kill()
                child.communicate(timeout=5)


def test_unknown_database_version_does_not_rewrite_existing_state(tmp_path):
    trace = diagnostics.ValidationTrace(tmp_path / "traces")
    assert trace.write({"first": True})["state"] == "saved"
    with sqlite3.connect(tmp_path / "traces/validation.sqlite3") as db:
        db.execute("PRAGMA user_version=2")
    with pytest.raises(ValueError, match="Unsupported"):
        trace.write({"later": True})
    assert records(tmp_path) == [{"first": True}]
