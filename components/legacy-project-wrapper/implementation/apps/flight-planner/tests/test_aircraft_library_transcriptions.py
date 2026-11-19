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
    ask,
    retrieve,
    distillation_context,
)
from app.services.aircraft_library.worker import Worker
from .test_aircraft_library_ocr import make_library, preview_request
from .test_aircraft_library_resume import Provider, ProcessKilled, expire
from .test_aircraft_library import manual
from .test_aircraft_library_ocr_apply import applied as apply_ocr


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


class ContextProvider(Models):
    def __init__(self, mode=None):
        super().__init__({})
        self.embedding_identity = "context-fixture"
        self.mode, self.received = mode, []

    def capabilities(self):
        return {"llm": True, "embeddings": self.mode is not None}

    def embed(self, texts, *, input_type="passage"):
        if self.mode == "failed":
            raise ModelUnavailable("Fixture embedding outage")
        return [[1.0, 0.5] for _ in texts]

    def complete(self, evidence, question, **options):
        self.received.append(evidence)
        source = evidence[0]
        return {
            "insufficient_evidence": False,
            "reason": "",
            "claims": [
                {
                    "text": source["text"],
                    "citations": [{"passage_id": source["passage_id"], "excerpt_id": 0}],
                }
            ],
        }


@pytest.mark.parametrize("mode", [None, "working", "failed"])
def test_questions_include_nonmatching_reviewed_footer_and_preserve_source(library, mode):
    store, identifier = library
    apply(store, identifier, ready(store, identifier, text="5-10\tDec 1/97"))
    apply_ocr(store, identifier)
    sources = store.passages([identifier])
    native = next(p for p in sources if p["page"] == 1 and p["method"] == "text")
    with store.connection() as c:
        c.execute(
            "INSERT INTO vectors VALUES (?,?,?)",
            (native["passage_id"], "context-fixture", "[1.0,0.5]"),
        )
    models = ContextProvider(mode)
    fingerprint = distillation_context(store, models, identifier)[-1]
    document, original = store.get(identifier), store.original(identifier).read_bytes()
    result = ask(store, models, "C172", "signed", document_ids=[identifier])
    rows = models.received[0]
    assert rows[0]["passage_id"] == native["passage_id"]
    assert any(p.get("transcription_review") and p["text"] == "5-10\tDec 1/97" for p in rows)
    assert any(p.get("ocr_review") for p in rows)
    assert [p["passage_id"] for p in rows[1:]] == [
        p["passage_id"] for p in sources if p.get("ocr_review") or p.get("transcription_review")
    ]
    assert all(p["document_id"] == identifier and p["page"] == 1 for p in rows)
    assert len({p["passage_id"] for p in rows}) == len(rows)
    assert result["retrieval"] == ("hybrid" if mode == "working" else "full_text")
    assert bool(result["warnings"]) == (mode == "failed")
    assert store.get(identifier) == document
    assert store.original(identifier).read_bytes() == original
    assert store.passages([identifier]) == sources
    assert distillation_context(store, models, identifier)[-1] == fingerprint


@pytest.mark.parametrize("mode", [None, "working", "failed"])
def test_reviewed_context_limit_warning_does_not_misreport_embedding_strategy(library, mode):
    store, identifier = library
    apply(store, identifier, ready(store, identifier, text="5-10\tDec 1/97"))
    native = next(p for p in store.passages([identifier]) if p["method"] == "text")
    with store.connection() as c:
        c.execute(
            "INSERT INTO vectors VALUES (?,?,?)",
            (native["passage_id"], "context-fixture", "[1.0,0.5]"),
        )
    models = ContextProvider(mode)
    result = ask(store, models, "C172", "signed", limit=1, document_ids=[identifier])
    assert len(models.received[0]) == 1
    assert any("exceeds the retrieval limit" in w for w in result["warnings"])
    assert result["retrieval"] == ("hybrid" if mode == "working" else "full_text")


def test_reviewed_context_keeps_document_page_registration_and_revision_scope(library):
    store, identifier = library
    apply(store, identifier, ready(store, identifier, text="5-10\tDec 1/97"))
    other = store.ingest(
        manual("Native signed private aircraft material."),
        {"icao": "C172", "scope": "aircraft", "tails": ["N123AB"], "revision": "private"},
    )
    apply(store, other["id"], ready(store, other["id"], text="Private footer 2030"))
    for filters in (
        {},
        {"document_ids": [identifier]},
        {"revision": ""},
        {"registration": "N999AB"},
    ):
        rows, warnings = retrieve(store, ContextProvider(), "C172", "signed", **filters)
        assert warnings == []
        assert {p["document_id"] for p in rows} == {identifier}
        assert {p["page"] for p in rows} == {1}
    rows, _ = retrieve(store, ContextProvider(), "C172", "Second original")
    assert rows and all(p["page"] == 2 and not p.get("transcription_review") for p in rows)
    rows, _ = retrieve(store, ContextProvider(), "C172", "Native", revision="private")
    assert rows == []
    rows, _ = retrieve(
        store, ContextProvider(), "C172", "Native", revision="private", registration="N123AB"
    )
    assert {p["document_id"] for p in rows} == {other["id"]}


def test_reviewed_search_hit_is_not_duplicated_and_ordinary_ranking_is_unchanged(library):
    store, identifier = library
    before = store.search("C172", "signed")
    rows, warnings = retrieve(store, ContextProvider(), "C172", "signed")
    assert rows == before and warnings == []
    apply(store, identifier, ready(store, identifier, text="Specialfooter 2030"))
    rows, warnings = retrieve(store, ContextProvider(), "C172", "Specialfooter")
    assert len(rows) == 1 and rows[0].get("transcription_review") and warnings == []


@pytest.mark.parametrize("tamper", ["passage", "ledger", "inactive"])
def test_question_context_cannot_grant_corrupt_or_inactive_review_provenance(library, tamper):
    store, identifier = library
    job = apply(store, identifier, ready(store, identifier, text="5-10\tDec 1/97"))
    rid = job["result"]["transcription_id"]
    with store.connection() as c:
        if tamper == "passage":
            c.execute("UPDATE passages SET text='bad footer' WHERE method='operator_transcription'")
        elif tamper == "ledger":
            c.execute("UPDATE page_transcriptions SET value='{}' WHERE id=?", (rid,))
        else:
            c.execute(
                "UPDATE documents SET extraction=json_set(extraction,'$.page_transcription_reviews',json('[]')) WHERE id=?",
                (identifier,),
            )
    with pytest.raises(ValueError):
        retrieve(store, ContextProvider(), "C172", "signed")


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


@pytest.mark.parametrize("styled", [False, True])
def test_embedding_process_loss_resumes_committed_text_without_duplicate_or_chat(library, styled):
    store, identifier = library
    values = ready(store, identifier)
    if styled:
        values["presentation"] = presentation(values["text"], ["Pressure"])

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
    rid = store.job(job["id"])["result"]["transcription_id"]
    assert transcriptions.review(store, identifier, rid).get("presentation") == values.get(
        "presentation"
    )
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


def presentation(text, marked):
    spans = []
    for literal in marked:
        start = text.index(literal)
        spans.append({"start": start, "end": start + len(literal), "text": literal})
    return {
        "bold_spans": sorted(spans, key=lambda span: span["start"]),
        "attest_matches_image": True,
    }


def test_reviewed_emphasis_preserves_literal_order_and_is_not_native_ocr(library):
    store, identifier = library
    text = "🛩 Checklist: bold items are immediate actions.\n1. Throttle -- IDLE.\n2. Brakes -- APPLY.\n3. Flaps -- RETRACT.\n4. Mixture -- IDLE CUT OFF."
    bold = presentation(text, ["Throttle -- IDLE.", "Brakes -- APPLY."])
    original = store.original(identifier).read_bytes()
    values = ready(store, identifier, text=text, presentation=bold)
    job = apply(store, identifier, values)
    assert job["state"] == "completed"
    record = transcriptions.review(store, identifier, job["result"]["transcription_id"])
    assert record["text"] == text and record["presentation"] == bold
    source = next(p for p in store.passages([identifier]) if p.get("transcription_review"))
    wire = model_evidence([source])[0]
    runs = wire["excerpts"][0]["presentation"]["runs"]
    assert "".join(r["text"] for r in runs) == text
    assert [r["text"] for r in runs if r["bold"]] == ["Throttle -- IDLE.", "Brakes -- APPLY."]
    assert wire["transcription_review"] == {"id": record["id"], "method": "operator_transcription"}
    assert all("start" not in r and "end" not in r for r in runs)
    assert store.original(identifier).read_bytes() == original
    answer = validate_answer(
        {
            "insufficient_evidence": False,
            "claims": [
                {
                    "text": "Throttle -- IDLE.",
                    "citations": [{"passage_id": source["passage_id"], "excerpt_id": 0}],
                }
            ],
        },
        [source],
    )
    assert answer["claims"][0]["citations"][0]["transcription_review"]["presentation"] == bold
    forged = {**source, "transcription_review": dict(source["transcription_review"])}
    with pytest.raises(ModelUnavailable, match="Unverified"):
        model_evidence([forged])


@pytest.mark.parametrize(
    "bad",
    [
        None,
        {},
        {"bold_spans": [], "attest_matches_image": False},
        {"bold_spans": [], "attest_matches_image": 1},
        {"bold_spans": [], "attest_matches_image": True, "page": 2},
        {"bold_spans": "words", "attest_matches_image": True},
        {"bold_spans": [{"start": True, "end": 4, "text": "Text"}], "attest_matches_image": True},
        {"bold_spans": [{"start": 0, "end": "4", "text": "Text"}], "attest_matches_image": True},
        {"bold_spans": [{"start": -1, "end": 4, "text": "Text"}], "attest_matches_image": True},
        {"bold_spans": [{"start": 0, "end": 400, "text": "Text"}], "attest_matches_image": True},
        {"bold_spans": [{"start": 0, "end": 4, "text": "FAKE"}], "attest_matches_image": True},
        {"bold_spans": [{"start": 4, "end": 5, "text": " "}], "attest_matches_image": True},
        {
            "bold_spans": [
                {"start": 0, "end": 4, "text": "Text"},
                {"start": 0, "end": 4, "text": "Text"},
            ],
            "attest_matches_image": True,
        },
        {
            "bold_spans": [
                {"start": 5, "end": 10, "text": "words"},
                {"start": 0, "end": 4, "text": "Text"},
            ],
            "attest_matches_image": True,
        },
        {
            "bold_spans": [{"start": 0, "end": 4, "text": "Text", "style": "bold"}],
            "attest_matches_image": True,
        },
        {
            "bold_spans": [{"start": 0, "end": 4, "text": "Text"}] * 129,
            "attest_matches_image": True,
        },
    ],
)
def test_invalid_emphasis_cannot_queue_or_change_source(library, bad):
    store, identifier = library
    values = ready(store, identifier, text="Text words are visible.", presentation=bad)
    before = store.index_identity(identifier)
    with pytest.raises(ValueError):
        transcriptions.queue_apply(store, identifier, values)
    assert store.index_identity(identifier) == before
    with store.connection() as c:
        assert c.execute("select count(*) from page_transcriptions").fetchone()[0] == 0


def test_emphasis_clips_to_provided_excerpts_and_does_not_admit_offset_numbers(library):
    store, identifier = library
    text = "A" * 950 + "B" * 200 + "C" * 500
    job = apply(
        store,
        identifier,
        ready(store, identifier, text=text, presentation=presentation(text, ["B" * 200])),
    )
    assert job["state"] == "completed"
    source = next(p for p in store.passages([identifier]) if p.get("transcription_review"))
    wire = model_evidence([source])[0]
    assert len(wire["excerpts"]) == 2
    for excerpt in wire["excerpts"]:
        runs = excerpt["presentation"]["runs"]
        assert "".join(r["text"] for r in runs) == excerpt["text"]
        assert all(set(r) == {"text", "bold"} for r in runs)
    assert (
        "".join(r["text"] for e in wire["excerpts"] for r in e["presentation"]["runs"] if r["bold"])
        == "B" * 200
    )
    with pytest.raises(ModelUnavailable, match="numeric"):
        validate_answer(
            {
                "insufficient_evidence": False,
                "claims": [
                    {
                        "text": "The limit is 950.",
                        "citations": [{"passage_id": source["passage_id"], "excerpt_id": 0}],
                    }
                ],
            },
            [source],
        )


def test_unknown_and_reviewed_no_bold_are_distinct_and_change_generation(library):
    store, identifier = library
    text = "Unchanged ordinary source text."
    plain = apply(store, identifier, ready(store, identifier, text=text))
    assert plain["state"] == "completed"
    first = distillation_context(store, Models({}), identifier)[-1]
    old_source = next(p for p in store.passages([identifier]) if p.get("transcription_review"))
    before_wire = model_evidence([old_source])
    assert "presentation" not in before_wire[0]["excerpts"][0]
    empty = {"bold_spans": [], "attest_matches_image": True}
    second = apply(store, identifier, ready(store, identifier, text=text, presentation=empty))
    assert second["state"] == "completed"
    assert distillation_context(store, Models({}), identifier)[-1] != first
    sources = [p for p in store.passages([identifier]) if p.get("transcription_review")]
    assert model_evidence([sources[0]]) == before_wire
    assert model_evidence([sources[1]])[0]["excerpts"][0]["presentation"]["runs"] == [
        {"text": text, "bold": False}
    ]
    with pytest.raises(ValueError, match="already active"):
        transcriptions.queue_apply(
            store, identifier, ready(store, identifier, text=text, presentation=empty)
        )


def test_queued_presentation_is_revalidated_before_commit(library):
    import json

    store, identifier = library
    text = "Literal source with bold words."
    values = ready(store, identifier, text=text, presentation=presentation(text, ["bold"]))
    job = transcriptions.queue_apply(store, identifier, values)
    broken = copy.deepcopy(job["request"])
    broken["presentation"]["bold_spans"][0]["text"] = "invented"
    before = store.index_identity(identifier)
    with store.connection() as c:
        c.execute("update jobs set request=? where id=?", (json.dumps(broken), job["id"]))
    assert Worker(store, Models({})).run_one()
    assert store.job(job["id"])["state"] == "failed"
    assert store.index_identity(identifier) == before
    with store.connection() as c:
        assert c.execute("select count(*) from page_transcriptions").fetchone()[0] == 0


def test_invalid_rehashed_presentation_ledger_cannot_acquire_verified_provenance(library):
    import json
    from app.services.aircraft_library import ocr

    store, identifier = library
    text = "Literal source with bold words."
    job = apply(
        store,
        identifier,
        ready(store, identifier, text=text, presentation=presentation(text, ["bold"])),
    )
    rid = job["result"]["transcription_id"]
    with store.connection() as c:
        value = json.loads(
            c.execute("select value from page_transcriptions where id=?", (rid,)).fetchone()[0]
        )
        value["presentation"]["bold_spans"][0]["text"] = "elsewhere"
        raw = ocr.encoded(value)
        c.execute(
            "update page_transcriptions set value=?,integrity_sha256=? where id=?",
            (raw.decode(), ocr.digest(raw), rid),
        )
    with pytest.raises(ValueError, match="literal text ranges"):
        store.passages([identifier])


def test_http_and_python_sdk_roundtrip_reviewed_presentation(library, monkeypatch):
    from aviation.aircraft_library import AircraftLibraryOCRClient

    store, identifier = library
    text = "1. Throttle -- IDLE.\n2. Flaps -- RETRACT."
    values = ready(
        store, identifier, text=text, presentation=presentation(text, ["Throttle -- IDLE."])
    )
    monkeypatch.setenv("AIRCRAFT_LIBRARY_TOKEN", "t" * 40)
    app = FastAPI()
    install(app, store=store, models=Models({}), worker_enabled=False)
    client = TestClient(app)
    headers = {"Authorization": "Bearer " + "t" * 40}

    def transport(path, *, method="GET", json=None, binary=False):
        r = client.request(method, "/api/aircraft-library" + path, headers=headers, json=json)
        r.raise_for_status()
        assert "no-store" in r.headers["cache-control"]
        return r.json()

    sdk = AircraftLibraryOCRClient(transport)
    queued = sdk.transcribe(identifier, values)
    assert Worker(store, Models({})).run_one()
    rid = store.job(queued["id"])["result"]["transcription_id"]
    assert sdk.transcription(identifier, rid)["presentation"] == values["presentation"]
    schemas = app.openapi()["components"]["schemas"]
    assert schemas["TranscriptionBoldSpan"]["properties"]["start"]["type"] == "integer"
    assert schemas["TranscriptionPresentation"]["properties"]["bold_spans"]["maxItems"] == 128
    assert schemas["TranscriptionPresentation"]["additionalProperties"] is False
    url = f"/api/aircraft-library/documents/{identifier}/transcriptions"
    for invalid in [
        None,
        {"bold_spans": [{"start": True, "end": 3, "text": "1. "}], "attest_matches_image": True},
    ]:
        bad = ready(store, identifier, text=text, presentation=invalid)
        assert client.post(url, headers=headers, json=bad).status_code == 422
