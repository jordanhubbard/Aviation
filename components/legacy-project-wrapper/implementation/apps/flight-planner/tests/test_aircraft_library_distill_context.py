"""Complete request evidence is bounded separately from unique primary coverage."""

import copy

import pytest

from app.services.aircraft_library import ocr_reviews, transcriptions
from app.services.aircraft_library.models import (
    LEGACY_DISTILLATION_EVIDENCE,
    NATIVE_DISTILLATION_EVIDENCE,
    REVIEWED_DISTILLATION_EVIDENCE,
    Models,
    ModelTruncated,
    ModelUnavailable,
    distill,
    distillation_context,
    distillation_plan,
    distillation_request_evidence,
    validate_answer,
    validated_prefix,
)
from app.services.aircraft_library.recovery import recover_distillation
from app.services.aircraft_library.worker import Worker
from .test_aircraft_library import manual
from .test_aircraft_library_resume import Provider, ProcessKilled, snapshot
from .test_aircraft_library_reviewed_recovery import make_recovery_library


@pytest.fixture
def library(tmp_path, monkeypatch):
    return make_recovery_library(tmp_path, monkeypatch)


def transcribe(store, identifier, page, text):
    context = ocr_reviews.context(store, identifier)
    job = ocr_reviews.queue_preview(
        store,
        identifier,
        {
            "expected_sha256": context["source_sha256"],
            "expected_index_identity": context["index_identity"],
            "pages": [page],
            "mode": "normal",
        },
    )
    assert Worker(store, Models({})).run_one()
    result = store.job(job["id"])
    assert result["state"] == "completed"
    preview = ocr_reviews.preview(store, identifier, result["result"]["preview_id"])
    job = transcriptions.queue_apply(
        store,
        identifier,
        {
            "expected_sha256": preview["source_sha256"],
            "expected_index_identity": preview["index_identity"],
            "preview_id": preview["id"],
            "preview_integrity_sha256": preview["integrity_sha256"],
            "page": page,
            "image_sha256": preview["pages"][0]["image_sha256"],
            "text": text,
            "reviewer": "Synthetic image reviewer",
            "attest_matches_image": True,
        },
    )
    assert Worker(store, Models({})).run_one()
    result = store.job(job["id"])
    assert result["state"] == "completed"
    return transcriptions.review(store, identifier, result["result"]["transcription_id"])


class ContextProvider(Provider):
    def __init__(self, *, truncate=False):
        super().__init__()
        self.distillation_batch_chars = 4000
        self.received, self.truncate, self.truncated = [], truncate, False

    def complete(self, evidence, question):
        self.calls.append([p["passage_id"] for p in evidence])
        self.received.append(copy.deepcopy(evidence))
        if len(self.calls) == self.kill_at:
            raise ProcessKilled()
        reviews = [p for p in evidence if p.get("transcription_review")]
        if reviews and self.truncate and not self.truncated:
            self.truncated = True
            raise ModelTruncated("Synthetic output truncation")
        source = reviews[0] if reviews else evidence[0]
        quote = source["text"][:70]
        return {
            "insufficient_evidence": False,
            "reason": "",
            "claims": [
                {"text": quote, "citations": [{"passage_id": source["passage_id"], "quote": quote}]}
            ],
        }


def long_page(store):
    return store.ingest(
        manual(
            *[f"Introduction {i}. " + "Original systems description. " * 30 for i in range(7)],
            "Timer selector digits are the 10's. " + "Native timer operating description. " * 220,
        ),
        {"icao": "C182"},
    )["id"]


@pytest.mark.parametrize("truncate", [False, True])
def test_long_page_context_repeats_without_duplicate_primary_coverage(library, truncate):
    store, _, _ = library
    identifier = long_page(store)
    original = store.original(identifier).read_bytes()
    review = transcribe(store, identifier, 8, "Timer selector digits are the 10's.")
    provider = ContextProvider(truncate=truncate)
    result = distill(store, provider, identifier)
    assert result["status"] == "partial"
    assert result["completed_batches"] == result["total_batches"]
    assert result["unresolved_context_pages"] == [8]
    assert result["context_warnings"]
    assert result["unresolved_batches"] > 0
    assert result["evidence_policy"] == NATIVE_DISTILLATION_EVIDENCE
    assert result["context_limit_chars"] == 4000
    assert provider.truncated == truncate
    _, roots, _, fp = distillation_context(store, provider, identifier)
    primary = distillation_plan(roots, result["batch_plan"])
    ids = [p["passage_id"] for group in primary for p in group]
    assert ids == [p["passage_id"] for p in store.passages([identifier])]
    assert len(ids) == len(set(ids)) and result["evidence_identity"] == fp
    relevant = [rows for rows in provider.received if any(p["page"] == 8 for p in rows)]
    assert len(relevant) > 1
    for rows in provider.received:
        assert sum(len(p["text"]) for p in rows) <= 4000
        assert len({p["passage_id"] for p in rows}) == len(rows)
        assert {p["document_id"] for p in rows} == {identifier}
    assert all(review["passage_id"] in [p["passage_id"] for p in rows] for rows in relevant)
    assert store.original(identifier).read_bytes() == original
    assert len(validated_prefix(result, primary)) == result["completed_batches"]


def test_context_request_resume_does_not_regenerate_validated_prefix(library):
    store, _, _ = library
    identifier = long_page(store)
    transcribe(store, identifier, 8, "Timer selector digits are the 10's.")
    provider = ContextProvider()
    provider.kill_at = 3
    with pytest.raises(ProcessKilled):
        distill(store, provider, identifier)
    partial = copy.deepcopy(store.get(identifier)["artifacts"]["distillation"])
    assert partial["completed_batches"] == 2
    resumed = ContextProvider()
    result = distill(store, resumed, identifier)
    assert result["status"] == "partial" and result["unresolved_context_pages"] == [8]
    assert result["completed_batches"] == result["total_batches"]
    assert result["evidence_identity"] == partial["evidence_identity"]
    assert result["sections"][:2] == partial["sections"]
    assert not any(ids in provider.calls[:2] for ids in resumed.calls)


@pytest.mark.parametrize("multiple", [False, True])
def test_oversize_required_context_stays_partial_before_model_call(library, multiple):
    store, identifier, provider = library
    if multiple:
        transcribe(store, identifier, 1, "Visible first annotation. " * 45)
        transcribe(store, identifier, 1, "Visible second annotation. " * 45)
    else:
        transcribe(store, identifier, 1, "Visible annotation. " * 180)
    original = store.original(identifier).read_bytes()
    with pytest.raises(ModelUnavailable, match="context exceeds.*budget"):
        distill(store, provider, identifier)
    result = store.get(identifier)["artifacts"]["distillation"]
    assert result["status"] == "partial" and result["completed_batches"] == 0
    assert result["unresolved_batches"] > 0 and provider.calls == []
    assert store.original(identifier).read_bytes() == original


def test_legacy_requests_are_not_retroactively_granted_context(library):
    store, identifier, provider = library
    review = transcribe(store, identifier, 1, "Literal reviewed pressure is 37 psi.")
    passages = store.passages([identifier])
    native = [p for p in passages if p["page"] == 1 and not p.get("transcription_review")]
    candidate = {
        "insufficient_evidence": False,
        "reason": "",
        "claims": [
            {
                "text": "Literal reviewed pressure is 37 psi.",
                "citations": [{"passage_id": review["passage_id"], "excerpt_id": 0}],
            }
        ],
    }
    legacy = {"sections": [candidate]}
    assert distillation_request_evidence(native, [passages], legacy) == native
    assert validated_prefix(legacy, [native, [p for p in passages if p not in native]]) == []
    policy = {"evidence_policy": REVIEWED_DISTILLATION_EVIDENCE, "context_limit_chars": 4000}
    expanded = distillation_request_evidence(native, [passages], policy)
    validate_answer(candidate, expanded)
    assert review["passage_id"] in [p["passage_id"] for p in expanded]


@pytest.mark.parametrize(
    "changes",
    [
        {"evidence_policy": "unknown"},
        {"evidence_policy": ""},
        {"evidence_policy": REVIEWED_DISTILLATION_EVIDENCE},
        {"evidence_policy": REVIEWED_DISTILLATION_EVIDENCE, "context_limit_chars": True},
        {"evidence_policy": REVIEWED_DISTILLATION_EVIDENCE, "context_limit_chars": 1999},
    ],
)
def test_unknown_or_invalid_context_policy_never_supplies_evidence(changes):
    with pytest.raises(ModelUnavailable):
        distillation_request_evidence([], [], changes)


def test_context_never_expands_into_another_document_or_page(library):
    store, identifier, _ = library
    first = transcribe(store, identifier, 1, "First reviewed page footer.")
    transcribe(store, identifier, 2, "Other page private footer.")
    other = store.ingest(manual("Other aircraft native text."), {"icao": "SR22"})["id"]
    transcribe(store, other, 1, "Other aircraft private footer.")
    rows = store.passages([identifier, other])
    native = next(
        p
        for p in rows
        if p["document_id"] == identifier and p["page"] == 1 and p["method"] == "text"
    )
    result = distillation_request_evidence(
        [native],
        [rows],
        {
            "evidence_policy": REVIEWED_DISTILLATION_EVIDENCE,
            "context_limit_chars": 4000,
        },
    )
    assert [p["passage_id"] for p in result] == [native["passage_id"], first["passage_id"]]


def test_unreviewed_generations_keep_exact_legacy_identity_and_wire(library):
    store, identifier, provider = library
    current = distillation_context(store, provider, identifier)
    legacy = distillation_context(
        store, provider, identifier, evidence_policy=LEGACY_DISTILLATION_EVIDENCE
    )
    assert current == legacy
    result = distill(store, provider, identifier)
    assert "evidence_policy" not in result and "context_limit_chars" not in result


@pytest.mark.parametrize(
    "changes",
    [
        {"evidence_policy": "unknown"},
        {"context_limit_chars": 3000},
        {"context_limit_chars": True},
    ],
)
def test_recorded_context_settings_must_match_the_generation(library, changes):
    store, identifier, provider = library
    transcribe(store, identifier, 8, "Visible footer date 1998.")
    result = distill(store, provider, identifier)
    result.update(status="partial", **changes)
    store.artifact(identifier, "distillation", result)
    calls = len(provider.calls)
    with pytest.raises(ModelUnavailable, match="settings do not match"):
        distill(store, provider, identifier)
    assert len(provider.calls) == calls


def test_snapshot_policy_migration_archives_legacy_without_new_model_calls(library, tmp_path):
    store, identifier, provider = library
    transcribe(store, identifier, 8, "Visible footer date 1998.")
    legacy, roots = legacy_result(store, identifier, provider)
    sections, fp = legacy["sections"], legacy["evidence_identity"]
    store.artifact(identifier, "distillation", legacy)
    backup = snapshot(store, tmp_path / "legacy.sqlite3")
    calls = len(provider.calls)
    result = recover_distillation(store, provider, identifier, backup)
    current = store.get(identifier)["artifacts"]["distillation"]
    assert result["recovered_batches"] == len(roots)
    assert current["evidence_identity"] != fp
    assert current["evidence_policy"] == REVIEWED_DISTILLATION_EVIDENCE
    assert current["recovery"]["request_scopes_unchanged"]
    assert len(provider.calls) == calls and current["sections"] == sections
    history = store.distillations(identifier)["items"]
    assert any(
        store.historical_distillation(identifier, row["revision_id"])["artifact"] == legacy
        for row in history
    )
    assert distill(store, provider, identifier)["status"] == "complete"
    assert len(provider.calls) == calls


def legacy_result(store, identifier, provider):
    _, roots, _, fp = distillation_context(
        store, provider, identifier, evidence_policy=LEGACY_DISTILLATION_EVIDENCE
    )
    sections = [
        {
            "pages": sorted({p["page"] for p in batch}),
            **validate_answer(provider.complete(batch, ""), batch),
        }
        for batch in roots
    ]
    return {
        "status": "complete",
        "evidence_identity": fp,
        "sections": sections,
        "completed_batches": len(roots),
        "total_batches": len(roots),
        "batch_plan": [[p["passage_id"] for p in batch] for batch in roots],
    }, roots


def test_snapshot_cannot_gain_new_context_to_validate_an_old_failed_claim(library, tmp_path):
    store, _, provider = library
    identifier = long_page(store)
    review = transcribe(store, identifier, 8, "Timer selector digits are the 10's.")
    legacy, roots = legacy_result(store, identifier, provider)
    position = next(
        i
        for i, batch in enumerate(roots)
        if any(p["page"] == 8 for p in batch)
        and review["passage_id"] not in {p["passage_id"] for p in batch}
    )
    bad = {
        "insufficient_evidence": False,
        "reason": "",
        "claims": [
            {
                "text": "Timer selector digits are the 10's.",
                "citations": [{"passage_id": review["passage_id"], "excerpt_id": 0}],
            }
        ],
    }
    # The assertion would validate if a legacy request were incorrectly enlarged.
    validate_answer(
        bad,
        distillation_request_evidence(
            roots[position],
            roots,
            {
                "evidence_policy": REVIEWED_DISTILLATION_EVIDENCE,
                "context_limit_chars": 4000,
            },
        ),
    )
    legacy["sections"][position] = {"pages": [8], **bad}
    store.artifact(identifier, "distillation", legacy)
    backup = snapshot(store, tmp_path / "failed-legacy.sqlite3")
    before = store.get(identifier)
    calls = len(provider.calls)
    with pytest.raises(ValueError, match="Snapshot prefix did not fully validate"):
        recover_distillation(store, provider, identifier, backup)
    assert store.get(identifier) == before and len(provider.calls) == calls


@pytest.mark.parametrize(
    "changes",
    [
        {"evidence_policy": "unknown"},
        {"context_limit_chars": 3000},
        {"context_limit_chars": True},
    ],
)
def test_snapshot_context_settings_must_match_the_snapshot_fingerprint(library, tmp_path, changes):
    store, identifier, provider = library
    transcribe(store, identifier, 8, "Visible footer date 1998.")
    good = copy.deepcopy(distill(store, provider, identifier))
    bad = {**good, **changes}
    store.artifact(identifier, "distillation", bad)
    backup = snapshot(store, tmp_path / "bad-settings.sqlite3")
    store.artifact(identifier, "distillation", good)
    before, calls = store.get(identifier), len(provider.calls)
    with pytest.raises(ValueError, match="Snapshot.*(settings|budget)"):
        recover_distillation(store, provider, identifier, backup)
    assert store.get(identifier) == before and len(provider.calls) == calls


@pytest.mark.parametrize("race", ["queued", "image"])
def test_policy_recovery_retains_final_idle_and_source_cas_guards(
    library, tmp_path, monkeypatch, race
):
    store, identifier, provider = library
    transcribe(store, identifier, 8, "Visible footer date 1998.")
    full = copy.deepcopy(distill(store, provider, identifier))
    backup = snapshot(store, tmp_path / "full.sqlite3")
    short = {**full, "status": "partial", "sections": full["sections"][:1], "completed_batches": 1}
    store.artifact(identifier, "distillation", short)
    commit = store.artifact

    def competing(*args, **kwargs):
        if race == "queued":
            store.create_job("distill", {"document_id": identifier})
        else:
            with store.connection() as c:
                c.execute("UPDATE ocr_preview_images SET image=?", (b"changed after validation",))
        return commit(*args, **kwargs)

    monkeypatch.setattr(store, "artifact", competing)
    calls = len(provider.calls)
    with pytest.raises(ValueError, match="queued or running|changed during recovery"):
        recover_distillation(store, provider, identifier, backup)
    assert store.get(identifier)["artifacts"]["distillation"] == short
    assert len(provider.calls) == calls


def test_policy_recovery_refuses_an_already_queued_document(library, tmp_path):
    store, identifier, provider = library
    distill(store, provider, identifier)
    backup = snapshot(store, tmp_path / "before-job.sqlite3")
    store.create_job("distill", {"document_id": identifier})
    with pytest.raises(ValueError, match="queued or running"):
        recover_distillation(store, provider, identifier, backup)


def test_policy_recovery_keeps_original_image_only_pages_unresolved(library, tmp_path):
    from .test_aircraft_library_source_limits import apply as restrict

    store, identifier, _ = library
    transcribe(store, identifier, 1, "Visible original-page pressure label 37 psi.")
    restrict(store, identifier)
    provider = ContextProvider()
    full = copy.deepcopy(distill(store, provider, identifier))
    assert full["status"] == "partial" and full["unresolved_batches"] == 1
    backup = snapshot(store, tmp_path / "restricted.sqlite3")
    store.artifact(
        identifier,
        "distillation",
        {
            **full,
            "sections": full["sections"][:1],
            "completed_batches": 1,
        },
    )
    recover_distillation(store, provider, identifier, backup)
    current = store.get(identifier)["artifacts"]["distillation"]
    assert current["unresolved_batches"] == 1 and current["status"] == "partial"
    assert current["unresolved_source_pages"] == [1]
    assert current["source_limits"] == full["source_limits"]


@pytest.mark.parametrize("legacy", [False, True])
def test_fresh_run_does_not_inherit_an_older_recovery_receipt(library, legacy):
    store, identifier, provider = library
    transcribe(store, identifier, 8, "Visible footer date 1998.")
    if legacy:
        old, _ = legacy_result(store, identifier, provider)
    else:
        old = copy.deepcopy(distill(store, provider, identifier))
    old["recovery"] = {"snapshot_sha256": "a" * 64, "recovered_batches": old["completed_batches"]}
    store.artifact(identifier, "distillation", old)
    calls = len(provider.calls)
    current = distill(store, provider, identifier)
    assert len(provider.calls) > calls and "recovery" not in current
    assert (current["evidence_identity"] != old["evidence_identity"]) == legacy
    assert any(
        store.historical_distillation(identifier, r["revision_id"])["artifact"] == old
        for r in store.distillations(identifier)["items"]
    )


def test_invalidated_prefix_does_not_resurrect_its_old_admission_receipt(library):
    store, identifier, provider = library
    transcribe(store, identifier, 8, "Visible footer date 1998.")
    old = copy.deepcopy(distill(store, provider, identifier))
    old.update(status="partial", recovery={"recovered_batches": old["completed_batches"]})
    old["sections"][1]["claims"][0]["text"] = "Unsupported pressure 999999 psi."
    store.artifact(identifier, "distillation", old)
    current = distill(store, provider, identifier)
    assert "recovery" not in current and current["status"] == "complete"
    assert current["sections"][0] == old["sections"][0]
    assert any(
        store.historical_distillation(identifier, r["revision_id"])["artifact"] == old
        for r in store.distillations(identifier)["items"]
    )


class NativeBoundaryStore:
    """A short split page follows enough text to cross the old request boundary."""

    def __init__(self):
        self.rows = [
            self.row(1, 1, "Introduction. " + "a" * 987),
            self.row(2, 2, "Climb distance is 21 miles. " + "b" * 720),
            self.row(3, 2, "Subtraction row: 450 -21 429. " + "c" * 720),
            self.row(4, 3, "Following page. " + "d" * 985),
        ]

    @staticmethod
    def row(identifier, page, text):
        return {
            "passage_id": identifier,
            "document_id": "native-fixture",
            "page": page,
            "label": str(page),
            "offset": identifier * 1000,
            "text": text,
            "method": "text",
        }

    def get(self, identifier):
        return {"metadata": {"icao": "C182"}}

    def passages(self, identifiers):
        return copy.deepcopy(self.rows)


def test_short_native_page_prose_and_subtraction_row_stay_together():
    store, provider = NativeBoundaryStore(), Provider()
    _, roots, question, fp = distillation_context(store, provider, "native-fixture")
    _, legacy, old_question, old_fp = distillation_context(
        store, provider, "native-fixture", evidence_policy=LEGACY_DISTILLATION_EVIDENCE
    )
    assert fp != old_fp and question == old_question
    assert [[p["passage_id"] for p in b] for b in legacy] == [[1, 2], [3, 4]]
    assert [[p["passage_id"] for p in b] for b in roots] == [[1], [2, 3], [4]]
    artifact = {"evidence_policy": NATIVE_DISTILLATION_EVIDENCE, "context_limit_chars": 2000}
    plan = distillation_plan(roots, [[1], [2], [3], [4]])
    for batch in plan:
        evidence = distillation_request_evidence(batch, plan, artifact)
        ids = [p["passage_id"] for p in evidence]
        assert len(ids) == len(set(ids))
        assert sum(len(p["text"]) for p in evidence) <= 2000
        if batch[0]["page"] == 2:
            assert set(ids) == {2, 3}
        else:
            assert ids == [batch[0]["passage_id"]]
    candidate = {
        "insufficient_evidence": False,
        "reason": "",
        "claims": [
            {
                "text": "Climb distance is 21 miles.",
                "citations": [{"passage_id": 2, "quote": "Climb distance is 21 miles."}],
            }
        ],
    }
    with pytest.raises(ModelUnavailable):
        validate_answer(candidate, legacy[1])
    validate_answer(candidate, distillation_request_evidence(plan[2], plan, artifact))
    assert store.rows[2]["text"].startswith("Subtraction row: 450 -21 429.")


@pytest.mark.parametrize("policy", [LEGACY_DISTILLATION_EVIDENCE, REVIEWED_DISTILLATION_EVIDENCE])
def test_explicit_previous_policies_keep_their_original_boundary_requests(policy):
    store, provider = NativeBoundaryStore(), Provider()
    _, roots, _, _ = distillation_context(store, provider, "native-fixture", evidence_policy=policy)
    artifact = (
        {}
        if policy == LEGACY_DISTILLATION_EVIDENCE
        else {
            "evidence_policy": policy,
            "context_limit_chars": 2000,
        }
    )
    assert [[p["passage_id"] for p in b] for b in roots] == [[1, 2], [3, 4]]
    assert [distillation_request_evidence(b, roots, artifact) for b in roots] == roots


def test_native_context_does_not_grant_unverified_review_provenance():
    store = NativeBoundaryStore()
    store.rows[1]["transcription_review"] = {"id": "unverified"}
    with pytest.raises(ModelUnavailable, match="Unverified"):
        distillation_context(
            store, Provider(), "native-fixture", evidence_policy=NATIVE_DISTILLATION_EVIDENCE
        )


def test_native_context_never_expands_to_other_documents_or_pages():
    store = NativeBoundaryStore()
    extra = {**store.rows[1], "document_id": "other", "passage_id": 5}
    rows = store.rows + [extra]
    artifact = {"evidence_policy": NATIVE_DISTILLATION_EVIDENCE, "context_limit_chars": 2000}
    evidence = distillation_request_evidence([store.rows[2]], [rows], artifact)
    assert {p["passage_id"] for p in evidence} == {2, 3}


def test_snapshot_recovery_retains_oversize_context_warnings(library, tmp_path):
    store, _, _ = library
    identifier = long_page(store)
    provider = ContextProvider()
    full = copy.deepcopy(distill(store, provider, identifier))
    assert full["completed_batches"] == full["total_batches"] and full["status"] == "partial"
    backup = snapshot(store, tmp_path / "oversized-native.sqlite3")
    store.artifact(
        identifier,
        "distillation",
        {
            **full,
            "sections": full["sections"][:1],
            "completed_batches": 1,
        },
    )
    calls = len(provider.calls)
    recover_distillation(store, provider, identifier, backup)
    recovered = store.get(identifier)["artifacts"]["distillation"]
    assert recovered["unresolved_context_pages"] == [8]
    assert recovered["context_warnings"] == full["context_warnings"]
    assert recovered["unresolved_batches"] == full["unresolved_batches"] > 0
    assert recovered["status"] == "partial" and len(provider.calls) == calls


@pytest.mark.parametrize("truncate", [False, True])
def test_short_page_keeps_verified_review_and_all_native_passages(library, truncate):
    store, _, _ = library
    identifier = store.ingest(manual("Native table description. " * 90), {"icao": "C182"})["id"]
    review = transcribe(store, identifier, 1, "Literal reviewed pressure is 37 psi.")
    before = copy.deepcopy(store.passages([identifier]))
    assert len([p for p in before if not p.get("transcription_review")]) > 1
    provider = ContextProvider(truncate=truncate)
    result = distill(store, provider, identifier)
    assert (
        result["status"] == "complete" and result["evidence_policy"] == NATIVE_DISTILLATION_EVIDENCE
    )
    assert "unresolved_context_pages" not in result and "context_warnings" not in result
    assert provider.truncated == truncate
    for evidence in provider.received:
        assert {p["passage_id"] for p in evidence} == {p["passage_id"] for p in before}
        assert sum(len(p["text"]) for p in evidence) <= 4000
        assert any(p["passage_id"] == review["passage_id"] for p in evidence)
    assert store.passages([identifier]) == before


def test_policy_migration_refuses_changed_first_request_without_relabelling(library, tmp_path):
    store, _, _ = library
    identifier = store.ingest(
        manual(
            "Introductory systems. " * 70,
            "Native table description. " * 90,
        ),
        {"icao": "C182"},
    )["id"]
    provider = ContextProvider()
    old, _ = legacy_result(store, identifier, provider)
    store.artifact(identifier, "distillation", old)
    backup = snapshot(store, tmp_path / "changed-first-request.sqlite3")
    before, calls = store.get(identifier), len(provider.calls)
    with pytest.raises(ValueError, match="No unchanged leading request scopes"):
        recover_distillation(store, provider, identifier, backup)
    assert store.get(identifier) == before and len(provider.calls) == calls
    fresh = distill(store, provider, identifier)
    assert fresh["evidence_identity"] != old["evidence_identity"] and "recovery" not in fresh
    assert fresh["evidence_policy"] == NATIVE_DISTILLATION_EVIDENCE
    assert any(
        store.historical_distillation(identifier, row["revision_id"])["artifact"] == old
        for row in store.distillations(identifier)["items"]
    )
