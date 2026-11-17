"""Blank classification and review must not erase unknown or readable evidence."""

from io import BytesIO
import copy
import json
from types import SimpleNamespace
import sys

from fastapi import FastAPI
from fastapi.testclient import TestClient
from pypdf import PdfReader, PdfWriter
from pypdf.generic import DecodedStreamObject, NameObject
import pytest

from .test_aircraft_library import manual
from app.services.aircraft_library import pdf
from app.services.aircraft_library.store import Store, BlankReviewConflict, LeaseLost
from app.services.aircraft_library.models import Models
from app.routers.aircraft_library import install


@pytest.fixture
def legacy(tmp_path, monkeypatch):
    store = Store(tmp_path / "library")
    text = "Performance: preserve the exact readable evidence and its passage identity."
    result = {
        "status": "partial",
        "page_count": 3,
        "incomplete_pages": [2, 3],
        "extractor": "legacy-test",
        "characters": len(text),
        "pages": [
            {
                "page": i,
                "label": str(i),
                "text": text if i == 1 else "",
                "method": "text" if i == 1 else "missing",
                "error": None if i == 1 else "No readable text",
            }
            for i in range(1, 4)
        ],
    }
    monkeypatch.setattr(pdf, "extract_file", lambda *a, **kw: copy.deepcopy(result))
    doc = store.ingest(
        manual(text, "", ""), {"icao": "C172", "title": "Original-backed blank review"}
    )
    identifier = doc["id"]
    with store.connection() as c:
        pid = c.execute("SELECT rowid FROM passages").fetchone()[0]
        c.execute("INSERT INTO vectors VALUES (?,?,?)", (pid, "unchanged-embedding", "[0.25,0.75]"))
    store.artifact(
        identifier,
        "distillation",
        {
            "status": "partial",
            "evidence_identity": "old-generation",
            "sections": [{"claims": [{"text": "Preserve this original admitted claim."}]}],
        },
    )
    return store, identifier


def request(store, identifier, pages=None):
    preview = store.blank_pages(identifier)
    return {
        "expected_sha256": preview["source_sha256"],
        "expected_index_identity": preview["index_identity"],
        "pages": pages or [2, 3],
        "reviewer": "Named reviewer",
        "attest_no_text_or_graphics": True,
    }


def snapshot(store, identifier):
    with store.connection() as c:
        return {
            table: [tuple(r) for r in c.execute("SELECT * FROM " + table)]
            for table in [
                "documents",
                "pages",
                "passages",
                "vectors",
                "artifacts",
                "distillation_history",
                "blank_page_reviews",
            ]
        }


def marked_pdf(gray="0.999"):
    writer = PdfWriter()
    page = writer.add_blank_page(612, 792)
    content = DecodedStreamObject()
    content.set_data((gray + " g 100 100 1 1 re f").encode())
    page[NameObject("/Contents")] = writer._add_object(content)
    output = BytesIO()
    writer.write(output)
    return output.getvalue()


def test_exact_white_full_render_and_nonwhite_marks():
    writer = PdfWriter()
    writer.add_blank_page(612, 792)
    output = BytesIO()
    writer.write(output)
    pure = output.getvalue()
    classified = pdf.extract(pure, ocr=False)
    assert classified["status"] == "indexed"
    assert classified["pages"][0]["method"] == "blank"
    assert classified["pages"][0]["text"] == "" and classified["pages"][0]["error"] is None
    assert classified["blank_pages"][0]["kind"] == "rendered_pure_white"
    assert pdf.pure_white_page(marked_pdf("0"), 1) is None
    assert pdf.pure_white_page(marked_pdf("0.999"), 1) is None
    assert pdf.pure_white_page(marked_pdf("1"), 1) is None
    assert pdf.extract(marked_pdf("0"), ocr=False)["incomplete_pages"] == [1]
    assert list(pdf.chunks(classified["pages"])) == []
    # The legacy helper contains direct, malformed content streams; a renderer
    # can silently ignore those. Its white output is insufficient evidence.
    assert pdf.pure_white_page(manual(""), 1) is None


def test_render_failure_dimensions_and_ocr_failure_are_unknown(monkeypatch):
    writer = PdfWriter()
    writer.add_blank_page(40000, 40000)
    out = BytesIO()
    writer.write(out)
    assert pdf.pure_white_page(out.getvalue(), 1) is None
    assert pdf.pure_white_page(b"%PDF-broken", 1) is None
    monkeypatch.setitem(
        sys.modules,
        "pypdfium2",
        SimpleNamespace(
            PdfDocument=lambda *a, **kw: (_ for _ in ()).throw(RuntimeError("render unavailable"))
        ),
    )
    monkeypatch.setattr(
        pdf, "ocr_page", lambda *a, **kw: (_ for _ in ()).throw(RuntimeError("OCR failed"))
    )
    valid = PdfWriter()
    valid.add_blank_page(612, 792)
    encoded = BytesIO()
    valid.write(encoded)
    result = pdf.extract(encoded.getvalue(), ocr=True)
    assert result["status"] == "partial" and result["incomplete_pages"] == [1]
    assert result["pages"][0]["method"] == "missing" and result["blank_pages"] == []


def test_review_preserves_original_passages_vectors_summary_and_restart(legacy):
    store, identifier = legacy
    before = snapshot(store, identifier)
    original = store.original(identifier).read_bytes()
    assert [p["page"] for p in store.blank_pages(identifier)["items"]] == [2, 3]
    record = store.review_blank_pages(identifier, request(store, identifier))
    after = snapshot(store, identifier)
    assert store.original(identifier).read_bytes() == original
    for table in ["passages", "vectors", "artifacts"]:
        assert before[table] == after[table]
    assert store.get(identifier)["status"] == "indexed"
    assert store.get(identifier)["extraction"]["incomplete_pages"] == []
    assert store.page(identifier, 2)["method"] == "blank"
    assert store.get(identifier)["artifacts"]["distillation"]["status"] == "partial"
    history = store.distillations(identifier)["items"]
    assert len(history) == 1
    archived = store.historical_distillation(identifier, history[0]["revision_id"])
    assert archived["artifact"] == store.get(identifier)["artifacts"]["distillation"]
    assert archived["index_identity"] == record["before_index_identity"]
    restarted = Store(store.root)
    assert restarted.blank_page_review(identifier, record["review_id"]) == record
    assert restarted.blank_page_reviews(identifier)["items"][0]["pages"] == [2, 3]
    assert all(
        p["verification"]["kind"] == "operator_attested" and not p["reviewable"]
        for p in restarted.blank_pages(identifier)["items"]
    )


def test_partial_review_and_reindex_keep_audit_but_not_classification(legacy):
    store, identifier = legacy
    record = store.review_blank_pages(identifier, request(store, identifier, [2]))
    assert store.get(identifier)["extraction"]["incomplete_pages"] == [3]
    assert store.get(identifier)["status"] == "partial"
    store.index(identifier)
    assert store.page(identifier, 2)["method"] == "missing"
    assert store.blank_page_review(identifier, record["review_id"]) == record


@pytest.mark.parametrize(
    "change",
    [
        {"pages": [1, 2]},
        {"pages": [2, 4]},
        {"pages": [2, 2]},
        {"pages": [True]},
        {"attest_no_text_or_graphics": False},
        {"attest_no_text_or_graphics": 1},
        {"reviewer": " "},
        {"pages": []},
    ],
)
def test_invalid_review_is_atomic(legacy, change):
    store, identifier = legacy
    body = request(store, identifier)
    body.update(change)
    before = snapshot(store, identifier)
    with pytest.raises(ValueError):
        store.review_blank_pages(identifier, body)
    assert snapshot(store, identifier) == before


def test_stale_source_active_job_and_original_integrity(legacy):
    store, identifier = legacy
    body = request(store, identifier)
    stale = {**body, "expected_index_identity": "0" * 64}
    with pytest.raises(BlankReviewConflict):
        store.review_blank_pages(identifier, stale)
    job = store.create_job("distill", {"document_id": identifier})
    with pytest.raises(BlankReviewConflict, match="queued or running"):
        store.review_blank_pages(identifier, body)
    with store.connection() as c:
        c.execute("UPDATE jobs SET state='failed' WHERE id=?", (job["id"],))
    store.original(identifier).write_bytes(manual("Changed original"))
    before = snapshot(store, identifier)
    with pytest.raises(ValueError, match="integrity"):
        store.review_blank_pages(identifier, body)
    assert snapshot(store, identifier) == before


def test_review_rollback_lease_fencing_and_history_integrity(legacy):
    store, identifier = legacy
    body = request(store, identifier)
    before = snapshot(store, identifier)
    with store.connection() as c:
        c.execute(
            "CREATE TRIGGER reject_audit BEFORE INSERT ON blank_page_reviews BEGIN SELECT RAISE(ABORT,'simulated audit failure'); END"
        )
    with pytest.raises(Exception, match="simulated audit failure"):
        store.review_blank_pages(identifier, body)
    assert snapshot(store, identifier) == before
    with store.connection() as c:
        c.execute("DROP TRIGGER reject_audit")
    with store.job_scope("job_missing", "former-owner"):
        with pytest.raises(LeaseLost):
            store.review_blank_pages(identifier, body)
    record = store.review_blank_pages(identifier, body)
    with store.connection() as c:
        c.execute(
            "UPDATE blank_page_reviews SET value='{}' WHERE review_id=?", (record["review_id"],)
        )
    with pytest.raises(ValueError, match="integrity"):
        store.blank_page_review(identifier, record["review_id"])
    with pytest.raises(ValueError, match="integrity"):
        store.blank_page_reviews(identifier)


def test_authenticated_typed_api_and_conflicts(legacy, monkeypatch):
    store, identifier = legacy
    monkeypatch.setenv("AIRCRAFT_LIBRARY_TOKEN", "b" * 40)
    app = FastAPI()
    install(app, store=store, models=Models({}), worker_enabled=False)
    client = TestClient(app)
    base = "/api/aircraft-library/documents/" + identifier
    unauthorized = client.get(base + "/blank-pages")
    assert unauthorized.status_code == 401
    assert unauthorized.headers["cache-control"] == "private, no-store"
    headers = {"Authorization": "Bearer " + "b" * 40}
    preview = client.get(base + "/blank-pages?limit=1", headers=headers)
    assert preview.status_code == 200 and preview.headers["cache-control"] == "private, no-store"
    assert preview.json()["next_offset"] == 1 and preview.json()["items"][0]["page"] == 2
    body = request(store, identifier)
    assert (
        client.post(
            base + "/blank-pages", json={**body, "pages": [True]}, headers=headers
        ).status_code
        == 422
    )
    assert (
        client.post(
            base + "/blank-pages", json={**body, "attest_no_text_or_graphics": 1}, headers=headers
        ).status_code
        == 422
    )
    response = client.post(base + "/blank-pages", json=body, headers=headers)
    assert response.status_code == 200
    record = response.json()
    assert record["attest_no_text_or_graphics"] is True
    conflict = client.post(base + "/blank-pages", json=body, headers=headers)
    assert conflict.status_code == 409
    assert conflict.headers["cache-control"] == "private, no-store"
    assert (
        client.get(base + "/blank-page-reviews", headers=headers).json()["items"][0]["review_id"]
        == record["review_id"]
    )
    assert (
        client.get(base + "/blank-page-reviews/" + record["review_id"], headers=headers).json()
        == record
    )
    assert client.get(base + "/blank-page-reviews/missing", headers=headers).status_code == 404
    schema = app.openapi()
    assert schema["paths"][base.replace(identifier, "{document_id}") + "/blank-pages"]["post"][
        "requestBody"
    ]
    assert (
        "blank" in schema["components"]["schemas"]["DocumentPage"]["properties"]["method"]["enum"]
    )


def test_unprocessed_source_is_unknown_even_with_zero_candidates(legacy):
    store, _ = legacy
    document = store.ingest(
        manual("A newly stored manual, not yet processed."), {"icao": "C182"}, extract=False
    )
    value = store.blank_pages(document["id"])
    assert value["extraction_status"] == "stored"
    assert value["page_count"] == value["total"] == 0
    assert value["items"] == []
    with pytest.raises(ValueError):
        store.review_blank_pages(document["id"], request(store, document["id"], [1]))
    assert store.get(document["id"])["status"] == "stored"
