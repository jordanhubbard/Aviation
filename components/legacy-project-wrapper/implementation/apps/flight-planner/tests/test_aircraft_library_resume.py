"""Lease-loss and output-budget recovery must preserve validated original evidence."""

import copy
from pathlib import Path

import pytest

from .test_aircraft_library import manual
from app.services.aircraft_library import pdf
from app.services.aircraft_library.models import ModelTruncated, ModelUnavailable, distill
from app.services.aircraft_library.store import Store, LeaseLost
from app.services.aircraft_library.worker import Worker


class ProcessKilled(BaseException):
    pass


class Provider:
    model = "recovery-fixture"
    base = "https://models.example/v1"
    embedding_identity = "fixture-embedding-mode"
    embedding_model = "fixture-embedding"
    embedding_batch_size = 2
    distillation_batch_chars = 2000

    def __init__(self):
        self.calls, self.embeds = [], []
        self.kill_at = None

    def capabilities(self):
        return {"llm": True, "embeddings": True}

    def embed(self, texts):
        self.embeds.extend(texts)
        return [[1.0, 0.5] for _ in texts]

    def complete(self, evidence, question):
        self.calls.append([p["passage_id"] for p in evidence])
        if len(self.calls) == self.kill_at:
            raise ProcessKilled()
        passage = evidence[0]
        quote = passage["text"][:70]
        return {
            "insufficient_evidence": False,
            "reason": "",
            "claims": [
                {
                    "text": quote,
                    "citations": [{"passage_id": passage["passage_id"], "quote": quote}],
                }
            ],
        }


@pytest.fixture
def source(tmp_path):
    store = Store(tmp_path / "library")
    document = store.ingest(
        manual(
            *[
                f"Manual section {i}. " + "Synthetic evidence for systems inspection. " * 25
                for i in range(8)
            ]
        ),
        {"icao": "C172"},
        extract=False,
    )
    return store, document["id"]


def expire(store, identifier):
    with store.connection() as connection:
        connection.execute("UPDATE jobs SET updated_at='2000-01-01' WHERE id=?", (identifier,))


def test_index_job_process_death_resumes_without_extraction_embedding_or_prefix_loss(
    source, monkeypatch
):
    store, identifier = source
    extractions = []
    original = pdf.extract_file

    def extract(*args, **kwargs):
        extractions.append(1)
        return original(*args, **kwargs)

    monkeypatch.setattr(pdf, "extract_file", extract)
    model = Provider()
    model.kill_at = 2
    job = store.create_job("index", {"document_id": identifier})
    with pytest.raises(ProcessKilled):
        Worker(store, model).run_one()
    saved = store.get(identifier)["artifacts"]["distillation"]
    assert saved["completed_batches"] == 1
    passages = store.passages([identifier])
    embeddings = len(model.embeds)
    expire(store, job["id"])
    model.kill_at = None
    assert Worker(Store(store.root), model).run_one()
    complete = store.get(identifier)["artifacts"]["distillation"]
    assert store.job(job["id"])["state"] == "completed"
    assert complete["status"] == "complete"
    assert complete["sections"][:1] == saved["sections"]
    assert store.passages([identifier]) == passages
    assert len(extractions) == 1 and len(model.embeds) == embeddings
    assert model.calls[1] == model.calls[2]
    # A separate, explicit new index run intentionally refreshes extraction.
    store.create_job("index", {"document_id": identifier})
    Worker(Store(store.root), model).run_one()
    assert len(extractions) == 2


def test_reclaimed_owner_cannot_publish_an_inflight_artifact_checkpoint_or_final_state(source):
    store, identifier = source
    job = store.create_job("index", {"document_id": identifier})
    store.claim_job("old")
    successor = Store(store.root)
    expire(successor, job["id"])
    successor.claim_job("new")
    with store.job_scope(job["id"], "old"):
        with pytest.raises(LeaseLost):
            store.artifact(identifier, "distillation", {"status": "complete"})
        with pytest.raises(LeaseLost):
            store.checkpoint(job["id"], {"index_identity": "stale"})
    assert not store.finish_job(job["id"], result={"stale": True}, owner="old")
    assert successor.job(job["id"])["worker"] == "new"
    assert successor.job(job["id"])["state"] == "running"
    assert successor.checkpoint(job["id"]) == {}
    assert "distillation" not in store.get(identifier)["artifacts"]


def test_stale_owner_losing_lease_mid_transaction_rolls_back(source):
    store, identifier = source
    job = store.create_job("index", {"document_id": identifier})
    store.claim_job("old")
    with store.job_scope(job["id"], "old"), pytest.raises(LeaseLost):
        with store.connection() as connection:
            connection.execute("UPDATE jobs SET worker='new' WHERE id=?", (job["id"],))
            connection.execute(
                "INSERT INTO artifacts VALUES (?,?,?,?)", (identifier, "bad", "{}", "now")
            )
    assert "bad" not in store.get(identifier)["artifacts"]
    assert store.job(job["id"])["worker"] == "old"


def test_metadata_change_invalidates_extraction_checkpoint(source, monkeypatch):
    store, identifier = source
    model = Provider()
    model.kill_at = 2
    job = store.create_job("index", {"document_id": identifier})
    with pytest.raises(ProcessKilled):
        Worker(store, model).run_one()
    store.update_metadata(identifier, {**store.get(identifier)["metadata"], "revision": "updated"})
    expire(store, job["id"])
    calls = []
    original = pdf.extract_file
    monkeypatch.setattr(
        pdf, "extract_file", lambda *a, **k: (calls.append(1), original(*a, **k))[1]
    )
    model.kill_at = None
    Worker(Store(store.root), model).run_one()
    assert calls == [1]
    assert store.job(job["id"])["state"] == "completed"


def test_truncation_partitions_are_durable_complete_and_resume_accepted_prefixes(source):
    store, identifier = source
    store.index(identifier)

    class Dense(Provider):
        distillation_batch_chars = 18000

        def complete(self, evidence, question):
            if len(evidence) > 2:
                self.calls.append([p["passage_id"] for p in evidence])
                raise ModelTruncated("Output budget exhausted")
            return super().complete(evidence, question)

    model = Dense()
    model.kill_at = 4
    with pytest.raises(ProcessKilled):
        distill(store, model, identifier)
    partial = store.get(identifier)["artifacts"]["distillation"]
    assert partial["completed_batches"] > 0
    assert [p for batch in partial["batch_plan"] for p in batch] == [
        p["passage_id"] for p in store.passages([identifier])
    ]
    checkpoint_calls = len(model.calls)
    model.kill_at = None
    complete = distill(Store(store.root), model, identifier)
    assert complete["status"] == "complete"
    assert complete["sections"][: len(partial["sections"])] == partial["sections"]
    assert model.calls[checkpoint_calls] == partial["batch_plan"][partial["completed_batches"]]
    assert complete["unresolved_batches"] == 0
    corrupt = copy.deepcopy(partial)
    corrupt["batch_plan"].pop()
    store.artifact(identifier, "distillation", corrupt)
    with pytest.raises(ModelUnavailable, match="omitted or duplicated"):
        distill(store, model, identifier)
    assert store.get(identifier)["artifacts"]["distillation"] == corrupt


def test_truncated_correction_cannot_discard_a_rejected_numeric_assertion(source):
    store, identifier = source
    store.index(identifier)

    class BadCorrection(Provider):
        distillation_batch_chars = 18000

        def complete(self, evidence, question):
            answer = super().complete(evidence, question)
            if len(self.calls) == 2:
                raise ModelTruncated("Output budget exhausted")
            answer["claims"][0]["text"] += " 999999 unsupported"
            return answer

    model = BadCorrection()
    with pytest.raises(ModelUnavailable):
        distill(store, model, identifier)
    partial = store.get(identifier)["artifacts"]["distillation"]
    assert partial["completed_batches"] == 0 and partial["total_batches"] == 1
    assert len(model.calls) == 3


def snapshot(store, path):
    import sqlite3

    with sqlite3.connect(store.db) as source_db, sqlite3.connect(path) as target:
        source_db.backup(target)
    path.chmod(0o400)
    return path


def test_readonly_snapshot_recovery_remaps_identical_passages_and_resumes_without_model_calls(
    source, tmp_path
):
    from app.services.aircraft_library.recovery import recover_distillation

    store, identifier = source
    store.index(identifier)
    provider = Provider()
    provider.kill_at = 3
    with pytest.raises(ProcessKilled):
        distill(store, provider, identifier)
    saved = copy.deepcopy(store.get(identifier)["artifacts"]["distillation"])
    backup = snapshot(store, tmp_path / "snapshot.sqlite3")
    old_ids = [p["passage_id"] for p in store.passages([identifier])]
    store.ingest(manual("Another immutable manual occupies other passage IDs."), {"icao": "SR22"})
    store.index(identifier)
    assert [p["passage_id"] for p in store.passages([identifier])] != old_ids
    calls = len(provider.calls)
    result = recover_distillation(store, provider, identifier, backup)
    assert result["status"] == "recovered" and result["recovered_batches"] == 2
    assert result["model_calls"] == 0 and len(provider.calls) == calls
    recovered = store.get(identifier)["artifacts"]["distillation"]
    assert recovered["status"] == "partial"
    assert [c["text"] for s in recovered["sections"] for c in s["claims"]] == [
        c["text"] for s in saved["sections"] for c in s["claims"]
    ]
    assert recover_distillation(store, provider, identifier, backup)["status"] == "unchanged"
    provider.kill_at = None
    complete = distill(store, provider, identifier)
    assert complete["status"] == "complete"
    assert complete["sections"][:2] == recovered["sections"]
    assert complete["recovery"] == recovered["recovery"]


@pytest.mark.parametrize("change", ["metadata", "text", "model", "numeric", "original", "wal"])
def test_snapshot_recovery_rejects_changed_identity_or_unvalidated_claims(source, tmp_path, change):
    import sqlite3
    import json
    from app.services.aircraft_library.recovery import recover_distillation

    store, identifier = source
    store.index(identifier)
    provider = Provider()
    provider.kill_at = 2
    with pytest.raises(ProcessKilled):
        distill(store, provider, identifier)
    backup = snapshot(store, tmp_path / "snapshot.sqlite3")
    if change == "metadata":
        store.update_metadata(
            identifier, {**store.get(identifier)["metadata"], "revision": "different"}
        )
    elif change == "text":
        with store.connection() as connection:
            connection.execute(
                "UPDATE passages SET text=text||' Changed source' WHERE document_id=?",
                (identifier,),
            )
    elif change == "model":
        provider.model = "different-model"
    elif change == "wal":
        Path(str(backup) + "-wal").write_bytes(b"nonempty uncheckpointed changes")
    elif change == "original":
        store.original(identifier).write_bytes(b"%PDF-corrupt-original")
    else:
        backup.chmod(0o600)
        with sqlite3.connect(backup) as connection:
            value = json.loads(
                connection.execute(
                    "SELECT value FROM artifacts WHERE document_id=? AND kind='distillation'",
                    (identifier,),
                ).fetchone()[0]
            )
            value["sections"][0]["claims"][0]["text"] += " 999999 unsupported"
            connection.execute(
                "UPDATE artifacts SET value=? WHERE document_id=? AND kind='distillation'",
                (json.dumps(value), identifier),
            )
        backup.chmod(0o400)
    before = store.get(identifier)["artifacts"].get("distillation")
    with pytest.raises((ValueError, ModelUnavailable)):
        recover_distillation(store, provider, identifier, backup)
    assert store.get(identifier)["artifacts"].get("distillation") == before


def test_inference_cannot_publish_after_an_explicit_reindex(source):
    store, identifier = source
    store.index(identifier)

    class ReindexDuringInference(Provider):
        def complete(self, evidence, question):
            result = super().complete(evidence, question)
            store.ingest(manual("Separate source ensures new row identities."), {"icao": "SR22"})
            store.index(identifier)
            return result

    with pytest.raises(ValueError, match="extraction changed"):
        distill(store, ReindexDuringInference(), identifier)
    assert "distillation" not in store.get(identifier)["artifacts"]


def test_truncated_correction_can_use_remaining_attempt_without_losing_claim_positions(source):
    from app.services.aircraft_library.models import verified_completion

    store, identifier = source
    store.index(identifier)
    evidence = store.passages([identifier])

    class Repair(Provider):
        def complete(self, supplied, question):
            answer = super().complete(supplied, question)
            if len(self.calls) == 1:
                answer["claims"][0]["text"] += " 999999 unsupported"
            if len(self.calls) == 2:
                raise ModelTruncated("Output budget exhausted")
            return answer

    model = Repair()
    result = verified_completion(model, evidence, "Summarize supplied evidence")
    assert len(result["claims"]) == 1 and len(model.calls) == 3
    assert model.calls[0] == model.calls[1] == model.calls[2]
    limited = Repair()
    with pytest.raises(ModelUnavailable):
        verified_completion(limited, evidence, "Summarize supplied evidence", max_attempts=2)
    assert len(limited.calls) == 2
