"""Reviewed additions never grant coverage to new or changed evidence scopes."""

import copy
import hashlib
import json
from pathlib import Path
import sqlite3

import pytest

from app.services.aircraft_library import ocr, ocr_reviews, transcriptions
from app.services.aircraft_library.models import (
    distill,
    distillation_context,
    distillation_plan,
    ModelUnavailable,
)
from app.services.aircraft_library.recovery import (
    recover_distillation,
    recover_reviewed_ocr_prefix,
    recover_reviewed_page_text_prefix,
)
from app.services.aircraft_library.store import Store
from app.services.aircraft_library.worker import Worker
from .test_aircraft_library import manual
from .test_aircraft_library_resume import Provider, snapshot


def make_recovery_library(tmp_path, monkeypatch):
    store = Store(tmp_path / "library")
    doc = store.ingest(
        manual(
            *[
                f"Manual section {i}. " + "Synthetic evidence for systems inspection. " * 25
                for i in range(8)
            ]
        ),
        {"icao": "C172"},
    )
    provider = Provider()

    def preview(path, pages, **kwargs):
        image = b"faithful synthetic page image"
        return {
            "source_sha256": ocr.digest(path.read_bytes()),
            "page_count": 8,
            "mode": kwargs["mode"],
            "engine": "tesseract",
            "engine_version": "test",
            "renderer": "pdfium",
            "approved": False,
            "status": "preview",
            "pages": [
                {
                    "page": p,
                    "label": str(p),
                    "width": 100,
                    "height": 100,
                    "image_sha256": ocr.digest(image),
                    "error": None,
                    "fragments": [
                        {
                            "id": "fragment_1",
                            "text": "1",
                            "offset": 0,
                            "bbox": [1, 1, 3, 8],
                            "confidence": 90,
                        }
                    ],
                }
                for p in pages
            ],
        }, {p: image for p in pages}

    monkeypatch.setattr(ocr, "extract_selected", preview)
    return store, doc["id"], provider


@pytest.fixture
def library(tmp_path, monkeypatch):
    return make_recovery_library(tmp_path, monkeypatch)


def review(store, identifier, page):
    worker = Worker(store, Provider())
    context = ocr_reviews.context(store, identifier)
    job = ocr_reviews.queue_preview(
        store,
        identifier,
        {
            "expected_sha256": context["source_sha256"],
            "expected_index_identity": context["index_identity"],
            "pages": [page],
            "mode": "words",
        },
    )
    assert worker.run_one()
    preview = ocr_reviews.preview(store, identifier, store.job(job["id"])["result"]["preview_id"])
    job = ocr_reviews.queue_apply(
        store,
        identifier,
        {
            "expected_sha256": preview["source_sha256"],
            "expected_index_identity": preview["index_identity"],
            "preview_id": preview["id"],
            "preview_integrity_sha256": preview["integrity_sha256"],
            "selections": [{"page": page, "fragment_id": "fragment_1"}],
            "reviewer": "Synthetic image reviewer",
            "attest_matches_image": True,
        },
    )
    assert worker.run_one()
    return ocr_reviews.review(store, identifier, store.job(job["id"])["result"]["review_id"])


def prepare(library, tmp_path, page=8):
    store, identifier, provider = library
    old = copy.deepcopy(distill(store, provider, identifier))
    assert old["status"] == "complete" and old["completed_batches"] > 2
    backup = snapshot(store, tmp_path / "before.sqlite3")
    approved = review(store, identifier, page)
    assert "distillation" not in store.get(identifier)["artifacts"]
    return store, identifier, provider, old, backup, approved


def test_tail_addition_reexecutes_the_page_receiving_new_request_context(library, tmp_path):
    store, identifier, provider, old, backup, approved = prepare(library, tmp_path)
    history = store.distillations(identifier)
    digest = hashlib.sha256(backup.read_bytes()).hexdigest()
    calls, embeds = len(provider.calls), len(provider.embeds)
    with pytest.raises(ValueError, match="extraction differs"):
        recover_distillation(store, provider, identifier, backup)
    result = recover_reviewed_ocr_prefix(store, provider, identifier, backup)
    count = old["completed_batches"] - 1
    assert result["recovered_batches"] == count and result["model_calls"] == 0
    assert result["source_generation_changed"] and result["new_model_completions"] == 0
    current = store.get(identifier)["artifacts"]["distillation"]
    assert current["status"] == "partial" and current["unresolved_batches"] == 1
    assert current["sections"] == old["sections"][:count]
    assert current["evidence_identity"] != old["evidence_identity"]
    assert current["recovery"]["source_evidence_identity"] == old["evidence_identity"]
    assert current["recovery"]["snapshot_sha256"] == digest
    new_id = approved["fragments"][0]["passage_id"]
    assert all(new_id not in b for b in current["batch_plan"][: current["completed_batches"]])
    assert new_id in current["batch_plan"][-1] and len(current["batch_plan"][-1]) > 1
    assert len(provider.calls) == calls and len(provider.embeds) == embeds
    assert store.distillations(identifier) == history
    assert hashlib.sha256(backup.read_bytes()).hexdigest() == digest
    assert recover_reviewed_ocr_prefix(store, provider, identifier, backup)["status"] == "unchanged"
    complete = distill(store, provider, identifier)
    assert complete["status"] == "complete" and len(provider.calls) == calls + 1
    assert complete["sections"][:count] == old["sections"][:count]
    assert new_id in provider.calls[-1]
    assert complete["recovery"] == current["recovery"]


def test_middle_addition_stops_at_first_changed_scope_and_preserves_complete_partition(
    library, tmp_path
):
    store, identifier, provider, old, backup, approved = prepare(library, tmp_path, page=4)
    result = recover_reviewed_ocr_prefix(store, provider, identifier, backup)
    current = store.get(identifier)["artifacts"]["distillation"]
    count = result["recovered_batches"]
    assert 0 < count < old["completed_batches"]
    assert current["sections"] == old["sections"][:count]
    _, roots, _, _ = distillation_context(store, provider, identifier)
    plan = distillation_plan(roots, current["batch_plan"])
    all_ids = [p["passage_id"] for b in plan for p in b]
    assert len(all_ids) == len(set(all_ids)) == len(store.passages([identifier]))
    assert approved["fragments"][0]["passage_id"] not in [
        p["passage_id"] for b in plan[:count] for p in b
    ]
    assert approved["fragments"][0]["passage_id"] in [
        p["passage_id"] for b in plan[count:] for p in b
    ]


def test_first_scope_addition_does_not_skip_to_later_matching_scopes(library, tmp_path):
    library[2].distillation_batch_chars = 4000
    store, identifier, provider, _, backup, _ = prepare(library, tmp_path, page=1)
    with pytest.raises(ValueError, match="No unchanged leading"):
        recover_reviewed_ocr_prefix(store, provider, identifier, backup)
    assert "distillation" not in store.get(identifier)["artifacts"]


def test_existing_refined_partitions_survive_only_as_exact_current_scope_prefix(library, tmp_path):
    store, identifier, provider = library
    provider.distillation_batch_chars = 4000
    saved = distill(store, provider, identifier)
    _, roots, _, _ = distillation_context(store, provider, identifier)
    assert len(roots[0]) > 1
    refined = [roots[0][:1], roots[0][1:]] + roots[1:]
    saved["batch_plan"] = [[p["passage_id"] for p in b] for b in refined]
    from app.services.aircraft_library.models import validate_answer

    saved["sections"] = [
        {"pages": sorted({p["page"] for p in b}), **validate_answer(provider.complete(b, ""), b)}
        for b in refined
    ]
    saved["completed_batches"] = saved["total_batches"] = len(refined)
    store.artifact(identifier, "distillation", saved)
    backup = snapshot(store, tmp_path / "refined.sqlite3")
    review(store, identifier, 8)
    result = recover_reviewed_ocr_prefix(store, provider, identifier, backup)
    count = len(refined) - 1
    assert result["recovered_batches"] == count
    current = store.get(identifier)["artifacts"]["distillation"]
    assert current["batch_plan"][:2] == saved["batch_plan"][:2]
    assert current["sections"] == saved["sections"][:count] and current["unresolved_batches"] == 1


@pytest.mark.parametrize(
    "change",
    [
        "metadata",
        "model",
        "original",
        "text",
        "page",
        "unreviewed",
        "reordered",
        "extraction",
        "no-addition",
        "snapshot-numeric",
        "late-snapshot-numeric",
        "profile",
        "blank",
        "image",
        "wal",
    ],
)
def test_non_additive_or_unvalidated_source_recovery_is_rejected(library, tmp_path, change):
    store, identifier, provider, old, backup, approved = prepare(library, tmp_path)
    if change == "metadata":
        store.update_metadata(
            identifier, {**store.get(identifier)["metadata"], "revision": "changed"}
        )
    elif change == "model":
        provider.model = "different"
    elif change == "profile":
        provider.generation_options = {"reasoning_effort": "high"}
    elif change in {"blank", "image"}:
        with store.connection() as c:
            if change == "image":
                c.execute("UPDATE ocr_preview_images SET image=?", (b"changed image",))
            else:
                c.execute(
                    "INSERT INTO blank_page_reviews VALUES (?,?,?,?,?)",
                    (identifier, "changed", "{}", "0" * 64, "now"),
                )
    elif change == "original":
        store.original(identifier).write_bytes(b"%PDF-changed")
    elif change in {"text", "page", "unreviewed", "reordered", "extraction", "no-addition"}:
        with store.connection() as c:
            if change == "text":
                c.execute(
                    "UPDATE passages SET text=text||' changed' WHERE document_id=? AND method='text'",
                    (identifier,),
                )
            elif change == "page":
                c.execute(
                    "UPDATE pages SET text=text||' changed' WHERE document_id=?", (identifier,)
                )
            elif change == "unreviewed":
                c.execute(
                    "INSERT INTO passages VALUES (?,?,?,?,?,?)",
                    (identifier, 8, "8", 99999, "Unreviewed word", "ocr"),
                )
            elif change == "reordered":
                c.execute(
                    "UPDATE passages SET offset=-offset-1 WHERE document_id=? AND method=?",
                    (identifier, "text"),
                )
            else:
                extraction = copy.deepcopy(store.get(identifier)["extraction"])
                if change == "no-addition":
                    extraction.pop("supplemental_ocr_reviews")
                else:
                    extraction["page_count"] += 1
                c.execute(
                    "UPDATE documents SET extraction=? WHERE id=?",
                    (json.dumps(extraction), identifier),
                )
    elif change in {"snapshot-numeric", "late-snapshot-numeric"}:
        backup.chmod(0o600)
        with sqlite3.connect(backup) as c:
            old["sections"][-1 if change == "late-snapshot-numeric" else 0]["claims"][0][
                "text"
            ] += " 918273645"
            c.execute(
                "UPDATE artifacts SET value=? WHERE document_id=? AND kind='distillation'",
                (json.dumps(old), identifier),
            )
        backup.chmod(0o400)
    else:
        Path(str(backup) + "-wal").write_bytes(b"uncheckpointed")
    before = store.get(identifier)["artifacts"].get("distillation")
    calls = len(provider.calls)
    with pytest.raises((ValueError, ModelUnavailable)):
        recover_reviewed_ocr_prefix(store, provider, identifier, backup)
    assert (
        store.get(identifier)["artifacts"].get("distillation") == before
        and len(provider.calls) == calls
    )


@pytest.mark.parametrize("race", ["job", "metadata", "index", "artifact", "page", "review-image"])
def test_atomic_publication_refuses_races(library, tmp_path, monkeypatch, race):
    store, identifier, provider, _, backup, _ = prepare(library, tmp_path)
    original = store.artifact
    intervening = None

    def mutate(*args, **kwargs):
        nonlocal intervening
        if race == "job":
            store.create_job("distill", {"document_id": identifier})
        elif race == "metadata":
            store.update_metadata(
                identifier, {**store.get(identifier)["metadata"], "revision": "raced"}
            )
        elif race in {"page", "review-image"}:
            with store.connection() as c:
                if race == "page":
                    c.execute(
                        "UPDATE pages SET text=text||' changed' WHERE document_id=?", (identifier,)
                    )
                else:
                    c.execute("UPDATE ocr_preview_images SET image=?", (b"changed",))
        elif race == "index":
            with store.connection() as c:
                c.execute(
                    "UPDATE passages SET text=text||' changed' WHERE document_id=?", (identifier,)
                )
        else:
            intervening = {**copy.deepcopy(args[2]), "sections": [], "completed_batches": 0}
            original(identifier, "distillation", intervening)
        return original(*args, **kwargs)

    monkeypatch.setattr(store, "artifact", mutate)
    with pytest.raises(ValueError):
        recover_reviewed_ocr_prefix(store, provider, identifier, backup)
    assert store.get(identifier)["artifacts"].get("distillation") == intervening


@pytest.mark.parametrize("state", ["queued", "running"])
def test_document_must_be_idle_before_snapshot_reads(library, tmp_path, state):
    store, identifier, provider, _, backup, _ = prepare(library, tmp_path)
    job = store.create_job("distill", {"document_id": identifier})
    if state == "running":
        with store.connection() as c:
            c.execute("UPDATE jobs SET state='running' WHERE id=?", (job["id"],))
    with pytest.raises(ValueError, match="idle work"):
        recover_reviewed_ocr_prefix(store, provider, identifier, backup)


def test_longer_current_completion_is_never_replaced(library, tmp_path):
    store, identifier, provider, _, backup, _ = prepare(library, tmp_path)
    current = copy.deepcopy(distill(store, provider, identifier))
    calls = len(provider.calls)
    assert current["status"] == "complete"
    result = recover_reviewed_ocr_prefix(store, provider, identifier, backup)
    assert (
        result["status"] == "unchanged"
        and store.get(identifier)["artifacts"]["distillation"] == current
    )
    assert len(provider.calls) == calls


def test_prior_review_attribution_cannot_be_changed_even_with_a_recomputed_hash(library, tmp_path):
    store, identifier, provider = library
    first = review(store, identifier, 8)
    distill(store, provider, identifier)
    backup = snapshot(store, tmp_path / "with-prior-review.sqlite3")
    review(store, identifier, 8)
    with store.connection() as c:
        row = c.execute("SELECT value FROM ocr_reviews WHERE id=?", (first["id"],)).fetchone()
        value = json.loads(row[0])
        value["reviewer"] = "Different attribution"
        encoded = ocr.encoded(value)
        c.execute(
            "UPDATE ocr_reviews SET value=?,integrity_sha256=? WHERE id=?",
            (encoded.decode(), ocr.digest(encoded), first["id"]),
        )
    with pytest.raises(ValueError):
        recover_reviewed_ocr_prefix(store, provider, identifier, backup)
    assert "distillation" not in store.get(identifier)["artifacts"]


def test_only_server_verified_additional_provenance_is_eligible(library, tmp_path, monkeypatch):
    store, identifier, provider, _, backup, _ = prepare(library, tmp_path)
    original = store.passages

    def plain(*args, **kwargs):
        passages = original(*args, **kwargs)
        for passage in passages:
            if passage.get("ocr_review"):
                passage["ocr_review"] = dict(passage["ocr_review"])
        return passages

    monkeypatch.setattr(store, "passages", plain)
    with pytest.raises(ValueError, match="verified provenance"):
        recover_reviewed_ocr_prefix(store, provider, identifier, backup)


def test_identical_native_evidence_can_remap_ids_after_reindex_before_review(library, tmp_path):
    store, identifier, provider = library
    old = copy.deepcopy(distill(store, provider, identifier))
    backup = snapshot(store, tmp_path / "remap.sqlite3")
    old_ids = [p["passage_id"] for p in store.passages([identifier])]
    store.ingest(manual("A separate document moves the next passage IDs."), {"icao": "SR22"})
    store.index(identifier)
    assert [p["passage_id"] for p in store.passages([identifier])] != old_ids
    review(store, identifier, 8)
    result = recover_reviewed_ocr_prefix(store, provider, identifier, backup)
    current = store.get(identifier)["artifacts"]["distillation"]
    count = old["completed_batches"] - 1
    assert result["recovered_batches"] == count
    assert [c["text"] for s in current["sections"] for c in s["claims"]] == [
        c["text"] for s in old["sections"][:count] for c in s["claims"]
    ]
    ids = {p["passage_id"] for p in store.passages([identifier])}
    assert all(
        c["passage_id"] in ids
        for s in current["sections"]
        for claim in s["claims"]
        for c in claim["citations"]
    )


def test_live_database_is_not_a_recovery_snapshot(library, tmp_path):
    store, identifier, provider, _, _, _ = prepare(library, tmp_path)
    with pytest.raises(ValueError, match="separate read-only snapshot"):
        recover_reviewed_ocr_prefix(store, provider, identifier, store.db)


@pytest.mark.parametrize("page", [4, 8])
def test_distinct_transcription_recovery_preserves_only_unchanged_scopes(library, tmp_path, page):
    store, identifier, provider = library
    old = copy.deepcopy(distill(store, provider, identifier))
    backup = snapshot(store, tmp_path / "before-transcription.sqlite3")
    before_hash = hashlib.sha256(backup.read_bytes()).hexdigest()
    context = ocr_reviews.context(store, identifier)
    queued = ocr_reviews.queue_preview(
        store,
        identifier,
        {
            "expected_sha256": context["source_sha256"],
            "expected_index_identity": context["index_identity"],
            "pages": [page],
            "mode": "normal",
        },
    )
    from app.services.aircraft_library.models import Models

    assert Worker(store, Models({})).run_one()
    preview = ocr_reviews.preview(
        store, identifier, store.job(queued["id"])["result"]["preview_id"]
    )
    job = transcriptions.queue_apply(
        store,
        identifier,
        {
            "expected_sha256": context["source_sha256"],
            "expected_index_identity": context["index_identity"],
            "preview_id": preview["id"],
            "preview_integrity_sha256": preview["integrity_sha256"],
            "page": page,
            "image_sha256": preview["pages"][0]["image_sha256"],
            "text": "Literal visible maintenance label −36.",
            "reviewer": "Image reviewer",
            "attest_matches_image": True,
        },
    )
    assert Worker(store, Models({})).run_one()
    rid = store.job(job["id"])["result"]["transcription_id"]
    calls, embeds = len(provider.calls), len(provider.embeds)
    with pytest.raises(ValueError, match="extraction differs"):
        recover_distillation(store, provider, identifier, backup)
    with pytest.raises(ValueError, match="appended supplemental OCR"):
        recover_reviewed_ocr_prefix(store, provider, identifier, backup)
    result = recover_reviewed_page_text_prefix(store, provider, identifier, backup)
    assert result["kind"] == "reviewed_page_text_prefix"
    assert result["added_transcription_ids"] == [rid] and result["added_ocr_review_ids"] == []
    assert result["new_model_completions"] == result["model_calls"] == 0
    current = store.get(identifier)["artifacts"]["distillation"]
    count = result["recovered_batches"]
    assert count > 0 and current["sections"] == old["sections"][:count]
    if page == 8:
        assert count == old["completed_batches"] - 1
    else:
        assert count < old["completed_batches"]
    assert current["status"] == "partial" and current["unresolved_batches"] > 0
    assert len(provider.calls) == calls and len(provider.embeds) == embeds
    assert hashlib.sha256(backup.read_bytes()).hexdigest() == before_hash
    assert (
        recover_reviewed_page_text_prefix(store, provider, identifier, backup)["status"]
        == "unchanged"
    )
    original = store.historical_distillation(
        identifier, store.distillations(identifier)["items"][0]["revision_id"]
    )
    assert (
        original["artifact"] == old
        and original["historical"]
        and not original["eligible_for_resume"]
    )
    complete = distill(store, provider, identifier)
    assert (
        complete["status"] == "complete" and complete["sections"][:count] == old["sections"][:count]
    )
