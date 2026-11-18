"""A reviewed diagram limitation is not a numeric-citation waiver or source edit."""

import copy
import pytest

from app.services.aircraft_library import source_limits, transcriptions, ocr_reviews
from app.services.aircraft_library.models import (
    Models,
    ModelUnavailable,
    ask,
    distill,
    model_evidence,
    validate_answer,
)
from app.services.aircraft_library.worker import Worker
from .test_aircraft_library_ocr import make_library
from .test_aircraft_library_transcriptions import ready
from .test_aircraft_library_reviewed_recovery import library as multi_library  # noqa: F401


@pytest.fixture
def library(tmp_path, monkeypatch):
    return make_library(tmp_path, monkeypatch)


def request(store, identifier, *, action="restrict", **changes):
    values = ready(store, identifier)
    del values["text"]
    return {
        **values,
        "action": action,
        "reason": source_limits.REASONS.get(action, "invalid"),
        **changes,
    }


def apply(store, identifier, *, action="restrict", reason=None):
    values = request(store, identifier, action=action)
    if reason is not None:
        values["reason"] = reason
    job = source_limits.queue_review(store, identifier, values)
    assert Worker(store, Models({})).run_one()
    done = store.job(job["id"])
    assert done["state"] == "completed", done["error"]
    return source_limits.review(store, identifier, done["result"]["source_limit_review_id"])


@pytest.mark.parametrize("reason", ["layout_relationships_unavailable", "native_text_inaccurate"])
def test_present_numbers_do_not_override_reviewed_layout_limitation(library, reason):
    store, identifier = library
    original = store.original(identifier).read_bytes()
    before = store.passages([identifier])
    native = before[0]
    candidate = {
        "insufficient_evidence": False,
        "claims": [
            {
                "text": "A claimed diagram relationship uses -36.",
                "citations": [{"passage_id": native["passage_id"], "quote": native["text"]}],
            }
        ],
    }
    assert validate_answer(copy.deepcopy(candidate), before)["claims"]
    identity = store.index_identity(identifier)
    saved = store.get(identifier)["artifacts"]["distillation"]
    review = apply(store, identifier, reason=reason)
    after = store.passages([identifier])
    restricted = after[0]
    assert restricted["text"] == native["text"] and restricted["passage_id"] == native["passage_id"]
    assert isinstance(restricted["source_limit"], source_limits.VerifiedSourceLimit)
    assert restricted["source_limit"]["original_image_only"]
    assert store.original(identifier).read_bytes() == original
    assert store.index_identity(identifier) != identity
    assert store.search("C172", "signed", document_ids=[identifier])[0]["text"] == native["text"]
    assert "distillation" not in store.get(identifier)["artifacts"]
    history = store.distillations(identifier)["items"]
    assert store.historical_distillation(identifier, history[0]["revision_id"])["artifact"] == saved
    assert review["after_index_identity"] == store.index_identity(identifier)
    assert review["before_index_identity"] == identity
    with pytest.raises(ModelUnavailable):
        validate_answer(candidate, after)
    wire = model_evidence(after)
    assert "text" not in wire[0] and wire[0]["excerpts"] == []
    assert "-36" not in str(wire)
    assert set(wire[0]["source_limit"]) == {"id", "reason", "original_image_only"}
    assert wire[1] == model_evidence(before)[1]


@pytest.mark.parametrize("reason", ["layout_relationships_unavailable", "native_text_inaccurate"])
def test_verified_literal_transcription_remains_usable_and_not_diagram_permission(library, reason):
    store, identifier = library
    apply(store, identifier, reason=reason)
    values = ready(store, identifier, text="Door width 32 1/2 inches, height 40 1/2 inches.")
    job = transcriptions.queue_apply(store, identifier, values)
    assert Worker(store, Models({})).run_one()
    assert store.job(job["id"])["state"] == "completed"
    sources = store.passages([identifier])
    literal = next(p for p in sources if p.get("transcription_review"))
    assert "source_limit" not in literal
    answer = {
        "insufficient_evidence": False,
        "claims": [
            {
                "text": "Door width is 32 1/2 inches.",
                "citations": [{"passage_id": literal["passage_id"], "quote": literal["text"]}],
            }
        ],
    }
    assert validate_answer(answer, sources)["claims"]
    assert any(p.get("source_limit", {}).get("original_image_only") for p in sources)


@pytest.mark.parametrize("reason", ["layout_relationships_unavailable", "native_text_inaccurate"])
def test_restriction_survives_reindex_and_release_requires_fresh_review(library, reason):
    store, identifier = library
    first = apply(store, identifier, reason=reason)
    store.index(identifier, ocr=False)
    assert store.get(identifier)["source_limits"][0]["id"] == first["id"]
    assert store.passages([identifier])[0]["source_limit"]["original_image_only"]
    released = apply(store, identifier, action="release")
    assert released["previous_review_id"] == first["id"]
    assert "source_limits" not in store.get(identifier)
    assert not store.passages([identifier])[0]["source_limit"]["original_image_only"]
    assert model_evidence(store.passages([identifier]))[0]["excerpts"]
    assert [r["id"] for r in source_limits.records(store, identifier)["items"]] == [
        released["id"],
        first["id"],
    ]


def test_all_restricted_retrieval_and_batch_do_not_request_chat_or_claim_complete(
    library, monkeypatch
):
    store, identifier = library
    apply(store, identifier)
    models = Models({"AIRCRAFT_LIBRARY_LLM_MODEL": "configured-test"})

    def fail(*args, **kwargs):
        pytest.fail("Restricted-only context must not invoke chat completion")

    monkeypatch.setattr(models, "complete", fail)
    answer = ask(store, models, "C172", "signed", document_ids=[identifier])
    assert answer["insufficient_evidence"] and answer["claims"] == []
    assert answer["source_limits"][0]["page"] == 1
    apply_second = request(store, identifier, page=2)
    # A page-one preview cannot authorize restricting another physical page.
    with pytest.raises(ValueError):
        source_limits.queue_review(store, identifier, apply_second)
    monkeypatch.setattr(
        models,
        "complete",
        lambda *a, **k: {
            "insufficient_evidence": True,
            "claims": [],
            "reason": "No supported claim",
        },
    )
    artifact = distill(store, models, identifier)
    assert artifact["status"] == "partial" and artifact["unresolved_source_pages"] == [1]
    assert artifact["unresolved_batches"] >= 1


@pytest.mark.parametrize(
    "changes",
    [
        {"attest_matches_image": False},
        {"reviewer": " "},
        {"page": True},
        {"image_sha256": "0" * 64},
        {"action": "arbitrary"},
        {"reason": "infer geometry"},
        {"reason": []},
        {"reason": {}},
        {"action": "release", "reason": "native_text_inaccurate"},
        {"action": "restrict", "reason": "original_text_reviewed"},
        {"text": "replacement text"},
    ],
)
def test_reject_bad_or_unpinned_reviews(library, changes):
    store, identifier = library
    with pytest.raises(ValueError):
        source_limits.queue_review(store, identifier, request(store, identifier, **changes))
    assert "source_limits" not in store.get(identifier)


def test_source_job_reservation_is_bidirectional(library):
    store, identifier = library
    values = request(store, identifier)
    job = source_limits.queue_review(store, identifier, values)
    with pytest.raises(ocr_reviews.OCRConflict):
        store.create_job("distill", {"document_id": identifier})
    assert Worker(store, Models({})).run_one()
    assert store.job(job["id"])["state"] == "completed"
    with pytest.raises(ValueError):
        store.create_job("source_limit_review", {"document_id": identifier})


@pytest.mark.parametrize("reason", ["layout_relationships_unavailable", "native_text_inaccurate"])
def test_corrupt_image_ledger_and_forged_policy_fail_closed(library, reason):
    store, identifier = library
    for flag in ({}, {"original_image_only": False}, {"original_image_only": True}):
        with pytest.raises(ModelUnavailable, match="Unverified source-use"):
            model_evidence([{**store.passages([identifier])[0], "source_limit": flag}])
    review = apply(store, identifier, reason=reason)
    with store.connection() as connection:
        connection.execute(
            "UPDATE ocr_preview_images SET image=? WHERE preview_id=?",
            (b"changed", review["preview_id"]),
        )
    with pytest.raises(ValueError, match="integrity"):
        store.passages([identifier])
    with pytest.raises(ValueError, match="integrity"):
        source_limits.records(store, identifier)


@pytest.mark.parametrize("reason", ["layout_relationships_unavailable", "native_text_inaccurate"])
def test_private_http_sdk_discovery_and_coverage_are_synchronized(library, monkeypatch, reason):
    from fastapi import FastAPI
    from fastapi.testclient import TestClient
    from app.routers.aircraft_library import install
    from aviation.aircraft_library import AircraftLibraryOCRClient

    store, identifier = library
    monkeypatch.setenv("AIRCRAFT_LIBRARY_TOKEN", "t" * 40)
    app = FastAPI()
    install(app, store=store, models=Models({}), worker_enabled=False)
    client = TestClient(app)
    headers = {"Authorization": "Bearer " + "t" * 40}
    path = f"/api/aircraft-library/documents/{identifier}/source-limits"
    assert client.get(path).status_code == 401
    calls = []

    def transport(path, *, method="GET", json=None, binary=False):
        response = client.request(
            method, "/api/aircraft-library" + path, headers=headers, json=json
        )
        assert "no-store" in response.headers["cache-control"]
        response.raise_for_status()
        calls.append(response)
        return response.content if binary else response.json()

    sdk = AircraftLibraryOCRClient(transport)
    assert calls == []
    job = sdk.review_source_use(identifier, request(store, identifier, reason=reason))
    assert calls[-1].status_code == 202 and Worker(store, Models({})).run_one()
    rid = store.job(job["id"])["result"]["source_limit_review_id"]
    assert sdk.source_limit(identifier, rid)["active"]
    assert sdk.source_limit(identifier, rid)["reason"] == reason
    assert sdk.source_limits(identifier)["items"][0]["id"] == rid
    detail = client.get(f"/api/aircraft-library/documents/{identifier}", headers=headers)
    assert detail.json()["source_limits"][0]["active"]
    assert detail.json()["extraction"]["source_limit_reviews"] == [rid]
    search = client.post(
        "/api/aircraft-library/search",
        headers=headers,
        json={"icao": "C172", "question": "signed"},
    )
    assert search.status_code == 200, search.text
    assert search.json()["passages"][0]["source_limit"]["original_image_only"]
    schema = app.openapi()
    assert (
        schema["paths"][path.replace(identifier, "{document_id}")]["post"]["operationId"]
        == "aircraft_library_source_limit_review"
    )
    assert schema["components"]["schemas"]["SourceLimitRequest"]["additionalProperties"] is False
    for name in ("SourceLimitRequest", "SourceLimitRecord", "SourceLimitProvenance"):
        assert set(schema["components"]["schemas"][name]["properties"]["reason"]["enum"]) == {
            "layout_relationships_unavailable",
            "native_text_inaccurate",
            "original_text_reviewed",
        }


def test_deleted_ledger_and_metadata_changes_do_not_silently_clear_limits(library):
    store, identifier = library
    saved = apply(store, identifier)
    values = {**store.get(identifier)["metadata"], "title": "New title"}
    store.update_metadata(identifier, values)
    assert store.get(identifier)["source_limits"][0]["id"] == saved["id"]
    assert store.passages([identifier])[0]["source_limit"]["original_image_only"]
    with store.connection() as connection:
        connection.execute("DELETE FROM page_source_limits WHERE document_id=?", (identifier,))
    with pytest.raises(ValueError, match="anchor"):
        store.get(identifier)


def test_source_limit_recovery_stops_before_changed_scope_and_keeps_coverage_partial(
    multi_library, tmp_path  # noqa: F811 - imported pytest fixture, not a redefinition
):
    from .test_aircraft_library_resume import snapshot
    from app.services.aircraft_library.recovery import (
        recover_distillation,
        recover_reviewed_page_text_prefix,
        recover_reviewed_source_limit_prefix,
    )

    store, identifier, provider = multi_library
    old = copy.deepcopy(distill(store, provider, identifier))
    assert old["status"] == "complete"
    before = snapshot(store, tmp_path / "before-limit.sqlite3")
    passages = {p["passage_id"]: p for p in store.passages([identifier])}
    first_changed = next(
        i
        for i, batch in enumerate(old["batch_plan"])
        if any(passages[p]["page"] == 8 for p in batch)
    )
    context = ocr_reviews.context(store, identifier)
    preview_job = ocr_reviews.queue_preview(
        store,
        identifier,
        {
            "expected_sha256": context["source_sha256"],
            "expected_index_identity": context["index_identity"],
            "pages": [8],
            "mode": "normal",
        },
    )
    assert Worker(store, Models({})).run_one()
    preview = ocr_reviews.preview(
        store, identifier, store.job(preview_job["id"])["result"]["preview_id"]
    )
    job = source_limits.queue_review(
        store,
        identifier,
        {
            "expected_sha256": context["source_sha256"],
            "expected_index_identity": context["index_identity"],
            "preview_id": preview["id"],
            "preview_integrity_sha256": preview["integrity_sha256"],
            "page": 8,
            "image_sha256": preview["pages"][0]["image_sha256"],
            "action": "restrict",
            "reason": "layout_relationships_unavailable",
            "reviewer": "Synthetic image reviewer",
            "attest_matches_image": True,
        },
    )
    assert Worker(store, Models({})).run_one()
    assert store.job(job["id"])["state"] == "completed"
    with pytest.raises(ValueError):
        recover_distillation(store, provider, identifier, before)
    with pytest.raises(ValueError):
        recover_reviewed_page_text_prefix(store, provider, identifier, before)
    calls, embeds = len(provider.calls), len(provider.embeds)
    result = recover_reviewed_source_limit_prefix(store, provider, identifier, before)
    assert result["recovered_batches"] == first_changed and result["new_model_completions"] == 0
    current = store.get(identifier)["artifacts"]["distillation"]
    assert current["sections"] == old["sections"][:first_changed]
    assert current["status"] == "partial" and current["unresolved_source_pages"] == [8]
    assert current["recovery"]["kind"] == "reviewed_source_limit_prefix"
    assert (len(provider.calls), len(provider.embeds)) == (calls, embeds)
    assert (
        recover_reviewed_source_limit_prefix(store, provider, identifier, before)["status"]
        == "unchanged"
    )


def test_process_loss_after_commit_replays_same_decision_without_duplicate_history(
    library,
):
    from .test_aircraft_library_resume import ProcessKilled, expire

    store, identifier = library
    values = request(store, identifier)
    job = source_limits.queue_review(store, identifier, values)

    class Interrupted(Worker):
        def execute(self, current):
            super().execute(current)
            raise ProcessKilled()

    with pytest.raises(ProcessKilled):
        Interrupted(store, Models({})).run_one()
    identity = store.index_identity(identifier)
    rid = store.checkpoint(job["id"])["source_limit_review_id"]
    expire(store, job["id"])
    assert Worker(store, Models({})).run_one()
    done = store.job(job["id"])
    assert done["state"] == "completed" and done["result"]["source_limit_review_id"] == rid
    assert store.index_identity(identifier) == identity
    assert source_limits.records(store, identifier)["total"] == 1
    assert len(store.distillations(identifier)["items"]) == 1


def test_question_cannot_publish_old_native_claim_after_source_use_changes(library, monkeypatch):
    store, identifier = library
    models = Models({"AIRCRAFT_LIBRARY_LLM_MODEL": "configured-test"})
    calls = []

    def complete(evidence, question, **options):
        calls.append(question)
        apply(store, identifier)
        passage = evidence[0]
        return {
            "insufficient_evidence": False,
            "claims": [
                {
                    "text": passage["text"],
                    "citations": [{"passage_id": passage["passage_id"], "quote": passage["text"]}],
                }
            ],
        }

    monkeypatch.setattr(models, "complete", complete)
    with pytest.raises(ModelUnavailable, match="source use changed during generation"):
        ask(store, models, "C172", "signed", document_ids=[identifier])
    assert len(calls) == 1
    assert store.get(identifier)["source_limits"]


def test_inaccurate_native_review_cannot_be_relabelled_as_a_release(library):
    import json
    from app.services.aircraft_library import ocr

    store, identifier = library
    apply(store, identifier, reason="native_text_inaccurate")
    with store.connection() as connection:
        row = connection.execute("SELECT id,value FROM page_source_limits").fetchone()
        value = json.loads(row["value"])
        value["reason"] = "original_text_reviewed"
        encoded = json.dumps(value)
        connection.execute(
            "UPDATE page_source_limits SET value=?, integrity_sha256=? WHERE id=?",
            (encoded, ocr.digest(encoded.encode()), row["id"]),
        )
    with pytest.raises(ValueError, match="Source review requires"):
        store.passages([identifier])
