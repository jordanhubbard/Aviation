"""Reviewed OCR adds evidence; it must never rewrite the native source to pass a guard."""

import sqlite3

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.services.aircraft_library import ocr_reviews
from app.services.aircraft_library.models import (
    Models,
    ModelUnavailable,
    distillation_context,
    model_evidence,
    validate_answer,
)
from app.services.aircraft_library.recovery import _Snapshot
from app.services.aircraft_library.worker import Worker
from app.routers.aircraft_library import install
from .test_aircraft_library import manual
from .test_aircraft_library_ocr import make_library, preview_request


@pytest.fixture
def library(tmp_path, monkeypatch):
    return make_library(tmp_path, monkeypatch)


def ready(store, identifier, **changes):
    queued = ocr_reviews.queue_preview(store, identifier, preview_request(store, identifier))
    assert Worker(store, Models({})).run_one()
    result = store.job(queued["id"])
    assert result["state"] == "completed", result["error"]
    candidate = ocr_reviews.preview(store, identifier, result["result"]["preview_id"])
    return {
        "preview_id": candidate["id"],
        "preview_integrity_sha256": candidate["integrity_sha256"],
        "expected_sha256": candidate["source_sha256"],
        "expected_index_identity": candidate["index_identity"],
        "selections": [{"page": 1, "fragment_id": "fragment_1"}],
        "reviewer": "Test reviewer",
        "attest_matches_image": True,
        **changes,
    }


def applied(store, identifier, **changes):
    job = ocr_reviews.queue_apply(store, identifier, ready(store, identifier, **changes))
    assert Worker(store, Models({})).run_one()
    done = store.job(job["id"])
    assert done["state"] == "completed", done["error"]
    assert done["result"]["embeddings"] == "unavailable"
    return ocr_reviews.review(store, identifier, done["result"]["review_id"])


def answer(passage_id, text="The value is −36.", **citation):
    return {
        "insufficient_evidence": False,
        "reason": "",
        "claims": [
            {"text": text, "citations": [{"passage_id": passage_id, "excerpt_id": 0, **citation}]}
        ],
    }


def test_apply_preserves_native_ids_vectors_other_fingerprints_and_archives_summary(library):
    store, identifier = library
    other = store.ingest(
        manual("An unrelated source with sufficient native text to preserve."), {"icao": "C182"}
    )
    old_native = store.passages([identifier])
    page = store.page(identifier, 1)
    before_doc = store.get(identifier)
    old_summary = before_doc["artifacts"]["distillation"]
    old_identity = store.index_identity(identifier)
    other_fp = distillation_context(store, Models({}), other["id"])[-1]
    with store.connection() as c:
        c.execute(
            "INSERT INTO vectors VALUES (?,?,?)",
            (old_native[0]["passage_id"], "old-model", "[0.5,0.5]"),
        )
    review = applied(store, identifier)
    passages = store.passages([identifier])
    assert [(p["page"], bool(p.get("ocr_review"))) for p in passages] == [
        (1, False),
        (1, True),
        (2, False),
    ]
    assert [p for p in passages if not p.get("ocr_review")] == old_native
    assert store.page(identifier, 1) == page
    assert store.index_identity(identifier) != old_identity
    assert distillation_context(store, Models({}), other["id"])[-1] == other_fp
    doc = store.get(identifier)
    assert doc["status"] == before_doc["status"]
    assert {
        k: v for k, v in doc["extraction"].items() if k != "supplemental_ocr_reviews"
    } == before_doc["extraction"]
    assert "distillation" not in doc["artifacts"]
    history = store.distillations(identifier)["items"]
    assert len(history) == 1
    assert (
        store.historical_distillation(identifier, history[0]["revision_id"])["artifact"]
        == old_summary
    )
    assert review["active"] and review["source_current"]
    with store.connection() as c:
        assert [tuple(r) for r in c.execute("SELECT * FROM vectors")] == [
            (old_native[0]["passage_id"], "old-model", "[0.5,0.5]")
        ]


@pytest.mark.parametrize(
    "changes",
    [
        {"selections": []},
        {"reviewer": "  "},
        {"attest_matches_image": False},
        {"attest_matches_image": 1},
        {"text": "edited replacement"},
        {"selections": [{"page": 1, "fragment_id": "absent"}]},
        {"selections": [{"page": 1, "fragment_id": "fragment_1", "text": "36"}]},
        {"selections": [{"page": 1, "fragment_id": "fragment_1"}] * 2},
        {"preview_integrity_sha256": "0" * 64},
        {"expected_index_identity": "0" * 64},
    ],
)
def test_apply_requires_selected_exact_fragments_and_attestation(library, changes):
    store, identifier = library
    values = ready(store, identifier, **changes)
    before = store.passages([identifier])
    with pytest.raises(ValueError):
        ocr_reviews.queue_apply(store, identifier, values)
    assert store.passages([identifier]) == before
    assert not ocr_reviews.records(store, identifier, kind="reviews")["items"]


def test_apply_commit_resumes_without_duplicate_rows_or_history(library):
    store, identifier = library
    values = ready(store, identifier)
    queued = ocr_reviews.queue_apply(store, identifier, values)
    job = store.claim_job("owner")
    assert job["id"] == queued["id"]
    with store.job_scope(job["id"], "owner"):
        first = ocr_reviews.apply_review(store, job)
        second = ocr_reviews.apply_review(store, job)
    assert first == second
    assert len(store.passages([identifier])) == 3
    assert len(store.distillations(identifier)["items"]) == 1
    store.finish_job(job["id"], result={"review_id": first["id"]}, owner="owner")
    with pytest.raises(ocr_reviews.OCRConflict):
        ocr_reviews.queue_apply(store, identifier, values)


def test_short_citation_requires_verified_whole_fragment_and_keeps_numeric_sign(library):
    store, identifier = library
    applied(store, identifier)
    source = next(p for p in store.passages([identifier]) if p.get("ocr_review"))
    assert model_evidence([source])[0]["excerpts"] == [{"excerpt_id": 0, "text": "−36"}]
    assert set(model_evidence([source])[0]["ocr_review"]) == {
        "review_id",
        "fragment_id",
        "engine",
        "mode",
    }
    verified = validate_answer(answer(source["passage_id"]), [source])
    assert verified["claims"][0]["citations"][0]["quote"] == "−36"
    assert verified["claims"][0]["citations"][0]["ocr_review"]["reviewer"] == "Test reviewer"
    for bad in [
        answer(source["passage_id"], text="The value is 36."),
        answer(source["passage_id"], quote="36"),
    ]:
        with pytest.raises(ModelUnavailable):
            validate_answer(bad, [source])
    for untrusted in [
        {k: v for k, v in source.items() if k != "ocr_review"},
        {**source, "ocr_review": dict(source["ocr_review"])},
        {**source, "ocr_review": {"verified": True}},
    ]:
        assert not model_evidence([untrusted])[0].get("excerpts")
        with pytest.raises(ModelUnavailable):
            validate_answer(answer(source["passage_id"]), [untrusted])


def test_search_and_readonly_snapshot_preserve_verified_source_order(library):
    store, identifier = library
    applied(store, identifier)
    assert any(p.get("ocr_review") for p in store.search("C172", "36"))
    with sqlite3.connect(store.db) as c:
        c.row_factory = sqlite3.Row
        assert _Snapshot(c).passages([identifier]) == store.passages([identifier])


def test_embedding_failure_retains_apply_and_explicit_retry_embeds_only_new_rows(library):
    store, identifier = library
    queued = ocr_reviews.queue_apply(store, identifier, ready(store, identifier))

    class Embeddings:
        embedding_identity, embedding_model, embedding_batch_size = "configured-model", "model", 1
        fail = True
        calls = []

        def capabilities(self):
            return {"embeddings": True, "llm": True}

        def embed(self, texts):
            self.calls.append(texts)
            if self.fail:
                raise ModelUnavailable("Unavailable embedding provider")
            return [[0.25, 0.75] for _ in texts]

    models = Embeddings()
    assert Worker(store, models).run_one()
    assert store.job(queued["id"])["state"] == "failed"
    review_id = store.checkpoint(queued["id"])["review_id"]
    saved = ocr_reviews.review(store, identifier, review_id)
    assert saved["active"] and saved["source_current"]
    context = ocr_reviews.context(store, identifier)
    retry = ocr_reviews.queue_review_embedding(
        store,
        identifier,
        review_id,
        {
            "expected_sha256": context["source_sha256"],
            "expected_index_identity": context["index_identity"],
        },
    )
    models.fail = False
    assert Worker(store, models).run_one()
    assert store.job(retry["id"])["state"] == "completed"
    assert models.calls == [["−36"], ["−36"]]
    with store.connection() as c:
        assert [tuple(r) for r in c.execute("SELECT passage_id,model FROM vectors")] == [
            (saved["fragments"][0]["passage_id"], "configured-model")
        ]


def test_reindex_invalidates_active_mappings_preserves_history_and_avoids_rowid_reuse(library):
    store, identifier = library
    saved = applied(store, identifier)
    store.index(identifier, ocr=False)
    assert not any(p.get("ocr_review") for p in store.passages([identifier]))
    history = ocr_reviews.review(store, identifier, saved["id"])
    assert not history["active"] and not history["source_current"]
    assert ocr_reviews.preview_image(store, identifier, saved["preview_id"], 1)
    with store.connection() as c:
        assert not c.execute(
            "SELECT 1 FROM ocr_passages WHERE document_id=?", (identifier,)
        ).fetchone()


@pytest.mark.parametrize("tamper", ["image", "candidate"])
def test_corrupt_evidence_cannot_be_applied(library, tamper):
    store, identifier = library
    queued = ocr_reviews.queue_apply(store, identifier, ready(store, identifier))
    before = store.passages([identifier])
    with store.connection() as c:
        (
            c.execute("UPDATE ocr_preview_images SET image=?", (b"changed",))
            if tamper == "image"
            else c.execute("UPDATE ocr_previews SET value='{}'")
        )
    Worker(store, Models({})).run_one()
    assert store.job(queued["id"])["state"] == "failed"
    assert store.passages([identifier]) == before
    assert not store.checkpoint(queued["id"])


def test_corrupt_applied_text_fails_closed(library):
    store, identifier = library
    saved = applied(store, identifier)
    with store.connection() as c:
        c.execute(
            "UPDATE passages SET text='invented 999' WHERE rowid=?",
            (saved["fragments"][0]["passage_id"],),
        )
    with pytest.raises(ValueError, match="reviewed fragment"):
        store.passages([identifier])


@pytest.mark.parametrize("mode", ["sparse", "table", "words"])
def test_authenticated_typed_preview_apply_search_and_history_http(library, monkeypatch, mode):
    from aviation.aircraft_library import AircraftLibraryOCRClient

    store, identifier = library
    monkeypatch.setenv("AIRCRAFT_LIBRARY_TOKEN", "o" * 40)
    app = FastAPI()
    install(app, store=store, models=Models({}), worker_enabled=False)
    client = TestClient(app)
    headers = {"Authorization": "Bearer " + "o" * 40}

    def transport(path, *, method="GET", json=None, binary=False):
        response = client.request(
            method, "/api/aircraft-library" + path, headers=headers, json=json
        )
        response.raise_for_status()
        assert response.headers["cache-control"] == "private, no-store"
        return response.content if binary else response.json()

    sdk = AircraftLibraryOCRClient(transport)
    base = f"/api/aircraft-library/documents/{identifier}"
    for path in ["/ocr", "/ocr-previews", "/ocr-reviews", "/ocr-previews/absent/pages/1.png"]:
        result = client.get(base + path)
        assert result.status_code == 401 and result.headers["cache-control"] == "private, no-store"
    context = client.get(base + "/ocr", headers=headers)
    assert context.status_code == 200
    assert "table" in context.json()["modes"]
    assert sdk.context(identifier)["document_id"] == identifier
    values = preview_request(store, identifier)
    values["mode"] = mode
    queued = client.post(base + "/ocr-previews", json=values, headers=headers)
    assert queued.status_code == 202
    assert client.post(base + "/jobs/index", headers=headers).status_code == 409
    assert Worker(store, Models({})).run_one()
    preview_id = store.job(queued.json()["id"])["result"]["preview_id"]
    preview = client.get(base + "/ocr-previews/" + preview_id, headers=headers)
    assert preview.status_code == 200 and preview.json()["source_current"]
    assert preview.headers["cache-control"] == "private, no-store"
    image = client.get(base + f"/ocr-previews/{preview_id}/pages/1.png", headers=headers)
    assert image.status_code == 200 and image.headers["content-type"] == "image/png"
    assert image.headers["cache-control"] == "private, no-store"
    detail = preview.json()
    assert detail["mode"] == mode
    if mode == "table":
        assert detail["pages"][0]["ocr_input_sha256"] == "4" * 64
        assert detail["pages"][0]["ocr_preprocessing"]["method"] == "straight-rules-v1"
    schema = app.openapi()["components"]["schemas"]
    assert "table" in schema["OCRPreviewRequest"]["properties"]["mode"]["enum"]
    assert "ocr_input_sha256" in schema["OCRPreviewPage"]["properties"]
    body = {
        "expected_sha256": detail["source_sha256"],
        "expected_index_identity": detail["index_identity"],
        "preview_id": preview_id,
        "preview_integrity_sha256": detail["integrity_sha256"],
        "selections": [{"page": 1, "fragment_id": "fragment_1"}],
        "reviewer": "HTTP reviewer",
        "attest_matches_image": True,
    }
    assert (
        client.post(
            base + "/ocr-reviews", json={**body, "attest_matches_image": 1}, headers=headers
        ).status_code
        == 422
    )
    assert (
        client.post(
            base + "/ocr-reviews", json={**body, "text": "edited"}, headers=headers
        ).status_code
        == 422
    )
    apply = client.post(base + "/ocr-reviews", json=body, headers=headers)
    assert apply.status_code == 202
    assert Worker(store, Models({})).run_one()
    review_id = store.job(apply.json()["id"])["result"]["review_id"]
    review = client.get(base + "/ocr-reviews/" + review_id, headers=headers)
    assert review.status_code == 200 and review.json()["active"]
    assert review.json()["mode"] == mode
    assert review.json()["fragments"][0]["text"] == "−36"
    assert sdk.review(identifier, review_id)["fragments"][0]["text"] == "−36"
    assert sdk.job(apply.json()["id"])["state"] == "completed"
    assert sdk.image(identifier, preview_id, 1) == image.content
    assert sdk.history(identifier, "ocr-reviews")["items"][0]["id"] == review_id
    with pytest.raises(ValueError):
        sdk.context("../other")
    assert client.post(base + "/ocr-reviews", json=body, headers=headers).status_code == 409
    found = client.post(
        "/api/aircraft-library/search", json={"icao": "C172", "question": "36"}, headers=headers
    )
    assert found.status_code == 200
    derived = next(p for p in found.json()["passages"] if p.get("ocr_review"))
    assert derived["ocr_review"]["review_id"] == review_id
    assert derived["ocr_review"]["mode"] == mode
    history = client.get(base + "/ocr-reviews?limit=1", headers=headers)
    assert history.status_code == 200 and history.json()["items"][0]["id"] == review_id
    assert client.get(base + "/ocr-reviews?limit=0", headers=headers).status_code == 422
    operations = {
        op["operationId"]
        for path in app.openapi()["paths"].values()
        for op in path.values()
        if isinstance(op, dict) and "operationId" in op
    }
    assert {
        "aircraft_library_ocr_preview_create",
        "aircraft_library_ocr_apply",
        "aircraft_library_ocr_preview_image",
        "aircraft_library_ocr_review_detail",
    } <= operations


@pytest.mark.parametrize("tamper", ["missing_mapping", "missing_passage", "review"])
def test_review_provenance_corruption_fails_closed(library, tamper):
    store, identifier = library
    saved = applied(store, identifier)
    with store.connection() as c:
        if tamper == "review":
            c.execute("UPDATE ocr_reviews SET value='{}'")
        elif tamper == "missing_mapping":
            c.execute("DELETE FROM ocr_passages")
        else:
            c.execute("DELETE FROM passages WHERE rowid=?", (saved["fragments"][0]["passage_id"],))
    with pytest.raises(ValueError):
        store.passages([identifier])
