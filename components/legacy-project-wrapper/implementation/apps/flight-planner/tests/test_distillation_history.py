"""History must survive source/generation changes without admitting stale evidence."""

import sqlite3

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from .test_aircraft_library import put
from app.services.aircraft_library.store import Store, LeaseLost
from app.services.aircraft_library.models import distill, Models
from app.routers.aircraft_library import install


@pytest.fixture
def store(tmp_path):
    return Store(tmp_path / "library")


def artifact(generation="old", sections=None):
    return {
        "status": "partial",
        "model": "synthetic-model",
        "evidence_identity": generation,
        "sections": sections if sections is not None else [],
    }


def archive(store, identifier, old=None):
    old = old or artifact(
        sections=[{"pages": [1], "insufficient_evidence": False, "reason": "", "claims": []}]
    )
    store.artifact(identifier, "distillation", old)
    store.artifact(identifier, "distillation", artifact("new"))
    return store.distillations(identifier)["items"][0]["revision_id"]


def test_additive_upgrade_preserves_original_current_artifact_and_vectors(store):
    doc = put(store)
    old = artifact()
    store.artifact(doc["id"], "distillation", old)
    with store.connection() as c:
        c.execute("DROP TABLE distillation_history")
        c.execute(
            "INSERT INTO vectors VALUES (?, 'existing-provider', '[1.0]')",
            (store.passages([doc["id"]])[0]["passage_id"],),
        )
    original = store.original(doc["id"]).read_bytes()
    reopened = Store(store.root)
    assert reopened.get(doc["id"])["artifacts"]["distillation"] == old
    assert reopened.original(doc["id"]).read_bytes() == original
    assert reopened.distillations(doc["id"]) == {"items": [], "next_offset": None}
    with reopened.connection() as c:
        assert c.execute("SELECT count(*) FROM vectors").fetchone()[0] == 1
        assert c.execute("PRAGMA user_version").fetchone()[0] == 1


def test_generation_archive_deduplicates_and_successful_append_does_not_archive(store):
    doc = put(store)
    old = artifact(sections=[{"claim": "retained"}])
    revision = archive(store, doc["id"], old)
    snapshot = store.historical_distillation(doc["id"], revision)
    assert snapshot["artifact"] == old
    assert snapshot["source_metadata"] == doc["metadata"]
    assert snapshot["source_sha256"] == doc["sha256"]
    assert snapshot["index_identity"] == store.index_identity(doc["id"])
    assert snapshot["historical"] and snapshot["eligible_for_resume"] is False
    assert snapshot["reason"] == "generation_changed"
    current = artifact("new", [{"claim": "first"}])
    store.artifact(doc["id"], "distillation", current)
    current["sections"].append({"claim": "second"})
    store.artifact(doc["id"], "distillation", current)
    assert len(store.distillations(doc["id"])["items"]) == 1
    # The same old payload is archived at most once, with its first archive identity intact.
    store.artifact(doc["id"], "distillation", old)
    store.artifact(doc["id"], "distillation", artifact("new"))
    assert store.historical_distillation(doc["id"], revision) == snapshot
    assert len(store.distillations(doc["id"])["items"]) == 2


@pytest.mark.parametrize("changed", [[], [{"claim": "different"}]])
def test_same_generation_regression_preserves_longer_or_different_prefix(store, changed):
    doc = put(store)
    old = artifact(sections=[{"claim": "first"}, {"claim": "second"}])
    store.artifact(doc["id"], "distillation", old)
    store.artifact(doc["id"], "distillation", artifact(sections=changed))
    revision = store.distillations(doc["id"])["items"][0]["revision_id"]
    assert store.historical_distillation(doc["id"], revision)["artifact"] == old
    assert store.historical_distillation(doc["id"], revision)["reason"] == "accepted_prefix_changed"


@pytest.mark.parametrize("operation", ["metadata", "index"])
def test_invalidation_snapshots_old_source_context_before_mutation(store, operation):
    doc = put(store, variant="S", revision="original")
    old = artifact(sections=[{"claim": "preserved"}])
    store.artifact(doc["id"], "distillation", old)
    identity = store.index_identity(doc["id"])
    if operation == "metadata":
        store.update_metadata(doc["id"], doc["metadata"] | {"revision": "new"})
    else:
        store.index(doc["id"])
    assert "distillation" not in store.get(doc["id"])["artifacts"]
    revision = store.distillations(doc["id"])["items"][0]["revision_id"]
    history = store.historical_distillation(doc["id"], revision)
    assert history["source_metadata"] == doc["metadata"] and history["index_identity"] == identity
    assert history["artifact"] == old and store.original(doc["id"]).read_bytes().startswith(
        b"%PDF-"
    )


def test_archive_and_current_replacement_roll_back_together_and_cas_fails_before_archive(store):
    doc = put(store)
    old = artifact()
    store.artifact(doc["id"], "distillation", old)
    with store.connection() as c:
        c.execute(
            "CREATE TRIGGER deny_artifact BEFORE INSERT ON artifacts BEGIN SELECT RAISE(ABORT,'denied'); END"
        )
    with pytest.raises(sqlite3.IntegrityError, match="denied"):
        store.artifact(doc["id"], "distillation", artifact("new"))
    assert store.distillations(doc["id"])["items"] == []
    assert store.get(doc["id"])["artifacts"]["distillation"] == old
    with pytest.raises(ValueError, match="changed during recovery"):
        store.artifact(
            doc["id"], "distillation", artifact("new"), expected_previous={"wrong": True}
        )
    assert store.distillations(doc["id"])["items"] == []


def test_lease_lost_before_commit_rolls_back_both_artifacts(store, monkeypatch):
    doc = put(store)
    old = artifact()
    store.artifact(doc["id"], "distillation", old)
    checks = 0

    def check(_):
        nonlocal checks
        checks += 1
        if checks == 2:
            raise LeaseLost("reclaimed")

    with monkeypatch.context() as m:
        m.setattr(store, "_check_lease", check)
        with pytest.raises(LeaseLost):
            store.artifact(doc["id"], "distillation", artifact("new"))
    assert store.get(doc["id"])["artifacts"]["distillation"] == old
    assert store.distillations(doc["id"])["items"] == []


def test_history_is_bounded_scoped_and_stable_after_restart(store):
    doc = put(store)
    other = put(store, icao="SR22")
    for i in range(4):
        store.artifact(doc["id"], "distillation", artifact(str(i)))
    first = store.distillations(doc["id"], limit=2)
    second = store.distillations(doc["id"], limit=2, offset=first["next_offset"])
    assert len(first["items"]) == 2 and len(second["items"]) == 1 and second["next_offset"] is None
    ids = [r["revision_id"] for r in first["items"] + second["items"]]
    assert len(set(ids)) == 3
    assert store.distillations(other["id"])["items"] == []
    assert store.historical_distillation(other["id"], ids[0]) is None
    assert Store(store.root).distillations(doc["id"], limit=2) == first
    for limit, offset in [(0, 0), (101, 0), (20, -1), (20, 1000001), (True, 0)]:
        with pytest.raises(ValueError):
            store.distillations(doc["id"], limit=limit, offset=offset)


def test_history_api_auth_schemas_and_immutable_content(store, monkeypatch):
    doc = put(store)
    revision = archive(store, doc["id"])
    other = put(store, icao="SR22")
    monkeypatch.setenv("AIRCRAFT_LIBRARY_TOKEN", "private-history-token-" + "x" * 32)
    app = FastAPI()
    install(app, store=store, models=Models({}), worker_enabled=False)
    path = f"/api/aircraft-library/documents/{doc['id']}/distillations"
    with TestClient(app) as client:
        for suffix in ["", "/" + revision]:
            assert client.get(path + suffix).status_code == 401
        client.headers["Authorization"] = "Bearer " + "private-history-token-" + "x" * 32
        response = client.get(path)
        assert response.status_code == 200
        assert response.headers["cache-control"] == "private, no-store"
        assert response.json()["items"][0]["revision_id"] == revision
        saved = client.get(path + "/" + revision)
        assert saved.status_code == 200
        assert saved.json() == store.historical_distillation(doc["id"], revision)
        assert saved.json()["eligible_for_resume"] is False
        assert client.get(path + "?limit=101").status_code == 422
        assert client.get(path + "/invalid").status_code == 404
        assert client.get(path.replace(doc["id"], other["id"]) + "/" + revision).status_code == 404
        schema = client.get("/openapi.json").json()
        assert (
            schema["paths"]["/api/aircraft-library/documents/{document_id}/distillations"]["get"][
                "operationId"
            ]
            == "aircraft_library_distillation_history"
        )
        assert (
            schema["components"]["schemas"]["HistoricalDistillation"]["properties"][
                "eligible_for_resume"
            ]["const"]
            is False
        )


@pytest.mark.parametrize("change", ["generation_options", "provider_evidence_format"])
def test_changed_generation_starts_fresh_while_previous_summary_remains_inspectable(
    store, monkeypatch, change
):
    doc = put(store)

    class Provider:
        model = "synthetic"
        base = "https://models.invalid/v1"
        calls = 0

        def complete(self, evidence, question):
            self.calls += 1
            p = evidence[0]
            return {
                "insufficient_evidence": False,
                "reason": "",
                "claims": [
                    {
                        "text": p["text"],
                        "citations": [{"passage_id": p["passage_id"], "quote": p["text"]}],
                    }
                ],
            }

    first = Provider()
    # Represent the actual previous locator-bearing provider format, rather than
    # assuming an arbitrary identity change also preserves its old summary.
    if change == "provider_evidence_format":
        with monkeypatch.context() as old_format:
            old_format.setattr(
                "app.services.aircraft_library.models.CITATION_FORMAT", "indexed-excerpts-v1"
            )
            original = distill(store, first, doc["id"])
    else:
        original = distill(store, first, doc["id"])
    second = Provider()
    if change == "generation_options":
        second.generation_options = {"max_tokens": 32768}
    current = distill(store, second, doc["id"])
    assert second.calls == 1 and current["evidence_identity"] != original["evidence_identity"]
    assert current["generation_options"] == (
        {"max_tokens": 32768} if change == "generation_options" else {}
    )
    history = store.distillations(doc["id"])["items"]
    assert len(history) == 1
    assert (
        store.historical_distillation(doc["id"], history[0]["revision_id"])["artifact"] == original
    )


def test_historical_content_corruption_is_not_served_under_its_old_identity(store):
    doc = put(store)
    revision = archive(store, doc["id"])
    with store.connection() as connection:
        connection.execute(
            "UPDATE distillation_history SET value=replace(value, 'synthetic-model', 'corrupt-model') WHERE revision_id=?",
            (revision,),
        )
    with pytest.raises(ValueError, match="integrity check failed"):
        store.historical_distillation(doc["id"], revision)
