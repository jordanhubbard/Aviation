"""Image-pinned operator text has its own ledger and never edits machine OCR."""

import copy
from fastapi import FastAPI
from fastapi.testclient import TestClient
import pytest

from app.routers.aircraft_library import install
from app.services.aircraft_library import ocr_reviews, transcriptions
from app.services.aircraft_library.models import (
    Models,
    ModelUnavailable,
    model_evidence,
    validate_answer,
)
from app.services.aircraft_library.worker import Worker
from .test_aircraft_library_ocr import make_library, preview_request
from .test_aircraft_library_resume import Provider, ProcessKilled, expire


@pytest.fixture
def library(tmp_path, monkeypatch):
    return make_library(tmp_path, monkeypatch)


def ready(store, identifier, **changes):
    job = ocr_reviews.queue_preview(store, identifier, preview_request(store, identifier))
    assert Worker(store, Models({})).run_one()
    result = store.job(job["id"])
    assert result["state"] == "completed"
    preview = ocr_reviews.preview(store, identifier, result["result"]["preview_id"])
    return {
        "expected_sha256": preview["source_sha256"],
        "expected_index_identity": preview["index_identity"],
        "preview_id": preview["id"],
        "preview_integrity_sha256": preview["integrity_sha256"],
        "page": 1,
        "image_sha256": preview["pages"][0]["image_sha256"],
        "text": "  Pressure −36 psi.\nRetain this visible label exactly.  ",
        "reviewer": "Image reviewer",
        "attest_matches_image": True,
        **changes,
    }


def apply(store, identifier, values=None, models=None):
    values = values or ready(store, identifier)
    job = transcriptions.queue_apply(store, identifier, values)
    assert Worker(store, models or Models({})).run_one()
    return store.job(job["id"])


def test_transcription_is_separate_attributed_literal_source_and_archives_summary(library):
    store, identifier = library
    before = store.get(identifier)
    native = store.passages([identifier])
    identity = store.index_identity(identifier)
    page = store.page(identifier, 1)
    values = ready(store, identifier)
    job = apply(store, identifier, values)
    assert job["state"] == "completed" and job["result"]["embeddings"] == "unavailable"
    review = transcriptions.review(store, identifier, job["result"]["transcription_id"])
    assert review["text"] == values["text"] and review["active"] and review["source_current"]
    assert not {"engine", "engine_version", "confidence", "ocr_review"} & review.keys()
    after = store.get(identifier)
    assert after["status"] == before["status"] and store.page(identifier, 1) == page
    assert store.index_identity(identifier) != identity
    assert {k: v for k, v in after["extraction"].items() if k != transcriptions.CHANNEL} == before[
        "extraction"
    ]
    assert "distillation" not in after["artifacts"]
    history = store.distillations(identifier)["items"]
    assert len(history) == 1
    assert (
        store.historical_distillation(identifier, history[0]["revision_id"])["artifact"]
        == before["artifacts"]["distillation"]
    )
    passages = store.passages([identifier])
    assert [p for p in passages if p["method"] != transcriptions.METHOD] == native
    assert [(p["page"], p["method"] == transcriptions.METHOD) for p in passages] == [
        (1, False),
        (1, True),
        (2, False),
    ]
    added = passages[1]
    assert isinstance(added["transcription_review"], transcriptions.VerifiedTranscription)
    assert not added.get("ocr_review")
    assert transcriptions.records(store, identifier)["items"][0]["id"] == review["id"]
    assert (
        store.search("C172", "Pressure", document_ids=[identifier])[0]["transcription_review"]["id"]
        == review["id"]
    )


@pytest.mark.parametrize(
    "changes",
    [
        {"text": "short"},
        {"text": " " * 10},
        {"text": "x" * 12001},
        {"text": "label\x00text"},
        {"text": "label\u202etext"},
        {"text": ["wrong type"]},
        {"reviewer": " "},
        {"reviewer": "x" * 201},
        {"reviewer": "reviewer\x00"},
        {"attest_matches_image": False},
        {"attest_matches_image": 1},
        {"page": True},
        {"page": 0},
        {"page": 2},
        {"page": "1"},
        {"expected_sha256": "0" * 64},
        {"expected_index_identity": "0" * 64},
        {"image_sha256": "0" * 64},
        {"preview_integrity_sha256": "0" * 64},
        {"confidence": 100},
        {"engine": "tesseract"},
    ],
)
def test_invalid_or_stale_transcription_cannot_queue_or_change_source(library, changes):
    store, identifier = library
    values = ready(store, identifier, **changes)
    before = store.index_identity(identifier)
    with store.connection() as c:
        jobs = c.execute("SELECT count(*) FROM jobs").fetchone()[0]
    with pytest.raises(ValueError):
        transcriptions.queue_apply(store, identifier, values)
    assert store.index_identity(identifier) == before
    with store.connection() as c:
        assert c.execute("SELECT count(*) FROM jobs").fetchone()[0] == jobs


@pytest.mark.parametrize("when", ["queue", "commit"])
def test_corrupt_page_image_never_commits_a_transcription(library, when):
    store, identifier = library
    values = ready(store, identifier)
    if when == "commit":
        job = transcriptions.queue_apply(store, identifier, values)
    before = store.index_identity(identifier)
    with store.connection() as c:
        c.execute(
            "UPDATE ocr_preview_images SET image=? WHERE preview_id=?",
            (b"corrupt", values["preview_id"]),
        )
    if when == "queue":
        with pytest.raises(ValueError, match="image integrity"):
            transcriptions.queue_apply(store, identifier, values)
    else:
        assert Worker(store, Models({})).run_one()
        assert store.job(job["id"])["state"] == "failed"
    assert store.index_identity(identifier) == before
    with store.connection() as c:
        assert c.execute("SELECT count(*) FROM page_transcriptions").fetchone()[0] == 0


def test_concurrent_work_and_duplicate_active_text_conflict(library):
    store, identifier = library
    values = ready(store, identifier)
    job = transcriptions.queue_apply(store, identifier, values)
    with pytest.raises(ocr_reviews.OCRConflict, match="queued or running"):
        transcriptions.queue_apply(store, identifier, values)
    assert Worker(store, Models({})).run_one()
    assert store.job(job["id"])["state"] == "completed"
    fresh = ready(store, identifier, text=values["text"])
    with pytest.raises(ocr_reviews.OCRConflict, match="already active"):
        transcriptions.queue_apply(store, identifier, fresh)


@pytest.mark.parametrize("tamper", ["passage", "ledger", "image", "missing"])
def test_corrupt_attribution_is_not_granted_to_source(library, tamper):
    store, identifier = library
    result = apply(store, identifier)
    rid = result["result"]["transcription_id"]
    with store.connection() as c:
        row = c.execute(
            "SELECT passage_id,preview_id FROM page_transcriptions WHERE id=?", (rid,)
        ).fetchone()
        if tamper == "passage":
            c.execute("UPDATE passages SET text='invented 200' WHERE rowid=?", (row[0],))
        elif tamper == "ledger":
            c.execute("UPDATE page_transcriptions SET value='{}' WHERE id=?", (rid,))
        elif tamper == "image":
            c.execute("UPDATE ocr_preview_images SET image=? WHERE preview_id=?", (b"bad", row[1]))
        else:
            c.execute("DELETE FROM page_transcriptions WHERE id=?", (rid,))
    with pytest.raises(ValueError):
        store.passages([identifier])


def test_numeric_guards_and_minimal_model_provenance_remain_enforced(library):
    store, identifier = library
    apply(store, identifier)
    source = next(p for p in store.passages([identifier]) if p.get("transcription_review"))
    wire = model_evidence([source])[0]
    assert wire["transcription_review"] == {
        "id": source["transcription_review"]["id"],
        "method": transcriptions.METHOD,
    }
    assert wire["excerpts"][0]["text"] == source["text"]
    answer = {
        "insufficient_evidence": False,
        "claims": [
            {
                "text": "Pressure is −36 psi.",
                "citations": [{"passage_id": source["passage_id"], "excerpt_id": 0}],
            }
        ],
    }
    clean = validate_answer(answer, [source])
    assert (
        clean["claims"][0]["citations"][0]["transcription_review"] == source["transcription_review"]
    )
    wrong = copy.deepcopy(answer)
    wrong["claims"][0]["text"] = "Pressure is 36 psi."
    with pytest.raises(ModelUnavailable):
        validate_answer(wrong, [source])
    forged = {**source, "transcription_review": dict(source["transcription_review"])}
    with pytest.raises(ModelUnavailable, match="Unverified"):
        validate_answer(answer, [forged])


def test_embedding_process_loss_resumes_committed_text_without_duplicate_or_chat(library):
    store, identifier = library
    values = ready(store, identifier)

    class Interrupted(Provider):
        def embed(self, texts):
            raise ProcessKilled()

        def complete(self, *args, **kwargs):
            pytest.fail("Text application must never invoke chat")

    job = transcriptions.queue_apply(store, identifier, values)
    with pytest.raises(ProcessKilled):
        Worker(store, Interrupted()).run_one()
    after = store.index_identity(identifier)
    expire(store, job["id"])
    provider = Provider()
    assert Worker(store, provider).run_one()
    assert store.job(job["id"])["state"] == "completed"
    assert store.index_identity(identifier) == after
    assert provider.embeds == [values["text"]] and provider.calls == []
    with store.connection() as c:
        assert c.execute("SELECT count(*) FROM page_transcriptions").fetchone()[0] == 1


def test_private_typed_http_discovery_and_retrieval_preserve_distinct_provenance(
    library, monkeypatch
):
    from aviation.aircraft_library import AircraftLibraryOCRClient

    store, identifier = library
    values = ready(store, identifier)
    monkeypatch.setenv("AIRCRAFT_LIBRARY_TOKEN", "t" * 40)
    app = FastAPI()
    install(app, store=store, models=Models({}), worker_enabled=False)
    client = TestClient(app)
    url = f"/api/aircraft-library/documents/{identifier}/transcriptions"
    assert client.post(url, json=values).status_code == 401
    headers = {"Authorization": "Bearer " + "t" * 40}
    responses = []

    def transport(path, *, method="GET", json=None, binary=False):
        result = client.request(method, "/api/aircraft-library" + path, headers=headers, json=json)
        result.raise_for_status()
        assert "no-store" in result.headers["cache-control"]
        responses.append(result)
        return result.content if binary else result.json()

    sdk = AircraftLibraryOCRClient(transport)
    assert responses == []
    queued = sdk.transcribe(identifier, values)
    response = responses[-1]
    assert response.status_code == 202, response.text
    assert "no-store" in response.headers["cache-control"]
    assert Worker(store, Models({})).run_one()
    rid = store.job(queued["id"])["result"]["transcription_id"]
    record = client.get(url + "/" + rid, headers=headers)
    assert record.status_code == 200 and record.json()["text"] == values["text"]
    assert record.json()["method"] == transcriptions.METHOD and record.json()["active"]
    assert client.get(url, headers=headers).json()["items"][0]["id"] == rid
    assert sdk.transcription(identifier, rid)["text"] == values["text"]
    assert sdk.transcriptions(identifier)["items"][0]["id"] == rid
    schema = app.openapi()
    assert (
        schema["paths"][url.replace(identifier, "{document_id}")]["post"]["operationId"]
        == "aircraft_library_transcription_apply"
    )
    context = ocr_reviews.context(store, identifier)
    unavailable = client.post(
        url + f"/{rid}/embeddings",
        headers=headers,
        json={
            "expected_sha256": context["source_sha256"],
            "expected_index_identity": context["index_identity"],
        },
    )
    assert unavailable.status_code == 503 and "no-store" in unavailable.headers["cache-control"]
