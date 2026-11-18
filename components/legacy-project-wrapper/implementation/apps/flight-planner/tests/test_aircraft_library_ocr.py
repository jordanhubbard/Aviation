"""Selected-page OCR is bounded, source-preserving and never auto-approved."""

from io import BytesIO
import os
import shutil
import signal
import sqlite3
import sys
import time

from pypdf import PdfWriter
import pytest

from app.services.aircraft_library import ocr
from app.services.aircraft_library import ocr_reviews
from app.services.aircraft_library.models import Models
from app.services.aircraft_library.store import Store, LeaseLost
from app.services.aircraft_library.worker import Worker
from .test_aircraft_library import manual

HEADER = "level\tpage_num\tblock_num\tpar_num\tline_num\tword_num\tleft\ttop\twidth\theight\tconf\ttext\n"


def tsv(words):
    return HEADER + "".join(
        f"5\t1\t1\t1\t{line}\t{i}\t{x}\t10\t{width}\t20\t{conf}\t{text}\n"
        for i, (line, x, width, conf, text) in enumerate(words, 1)
    )


@pytest.mark.parametrize(
    "pages,mode",
    [
        ([], "normal"),
        ([1] * 2, "sparse"),
        ([True], "normal"),
        ([1.0], "normal"),
        ([0], "normal"),
        ([1501], "normal"),
        (list(range(1, 12)), "normal"),
        ([1], "--psm 7"),
        ([1], ["sparse"]),
        ("1", "normal"),
    ],
)
def test_selection_rejects_unbounded_or_arbitrary_modes(pages, mode):
    with pytest.raises(ocr.OCRError):
        ocr.selection(pages, mode)


def test_fragments_keep_signs_punctuation_noise_and_uncertainty():
    result = ocr.fragments(
        tsv(
            [
                (1, 10, 40, 88.5, "−36′-1″"),
                (2, 10, 25, 11, "noise"),
                (3, 10, 20, 98, "36′"),
                (3, 35, 20, 91, "1″"),
            ]
        ),
        200,
        100,
    )
    assert [r["text"] for r in result] == ["−36′-1″", "noise", "36′ 1″"]
    assert result[0]["bbox"] == [10, 10, 40, 20]
    assert result[1]["confidence"] == 11
    assert result[2]["confidence"] == 91
    assert result[1]["offset"] == len(result[0]["text"]) + 1
    assert all("approved" not in r for r in result)


@pytest.mark.parametrize(
    "data",
    [
        "not tsv",
        tsv([(1, -1, 10, 90, "negative box")]),
        tsv([(1, 190, 20, 90, "outside")]),
        tsv([(1, 10, 20, "nan", "bad confidence")]),
        tsv([(1, 10, 20, 101, "bad confidence")]),
        tsv([(1, 10, 20, 90, "x" * 1001)]),
    ],
)
def test_invalid_tsv_fails_without_exposing_ocr_text(data):
    with pytest.raises(ocr.OCRError, match="invalid or excessive fragment data"):
        ocr.fragments(data, 200, 100)


def test_fragment_limits_reject_excess_and_split_at_words(monkeypatch):
    long = ocr.fragments(tsv([(1, 10, 20, 90, "a" * 700), (1, 40, 20, 90, "b" * 700)]), 200, 100)
    assert [len(row["text"]) for row in long] == [700, 700]
    monkeypatch.setattr(ocr, "MAX_FRAGMENTS", 1)
    with pytest.raises(ocr.OCRError):
        ocr.fragments(tsv([(1, 10, 20, 90, "one"), (2, 10, 20, 90, "two")]), 200, 100)


def test_pre_cancel_does_not_start_child(tmp_path, monkeypatch):
    def unexpected(*args, **kwargs):
        pytest.fail("Cancelled preview started a child")

    monkeypatch.setattr(ocr.subprocess, "Popen", unexpected)
    with pytest.raises(ocr.OCRError, match="cancelled"):
        ocr.extract_selected(tmp_path / "source.pdf", [1], cancelled=lambda: True)


@pytest.mark.parametrize("timeout", [0, -1, 601, float("nan"), float("inf")])
def test_deadline_cannot_disable_resource_bound(tmp_path, timeout):
    with pytest.raises(ocr.OCRError):
        ocr.extract_selected(tmp_path / "source.pdf", [1], timeout=timeout)


@pytest.mark.skipif(os.name != "posix", reason="POSIX process-tree ownership")
@pytest.mark.parametrize("cancel", [False, True])
def test_deadline_and_cancel_kill_and_reap_process_tree(tmp_path, monkeypatch, cancel):
    original = ocr.subprocess.Popen
    pidfile = tmp_path / "descendant.pid"
    processes = []
    script = (
        "import subprocess,sys,time; from pathlib import Path; "
        "p=subprocess.Popen([sys.executable,'-c','import time; time.sleep(60)']); "
        "Path(sys.argv[1]).write_text(str(p.pid)); time.sleep(60)"
    )

    def child(*args, **kwargs):
        process = original([sys.executable, "-c", script, str(pidfile)], **kwargs)
        processes.append(process)
        return process

    monkeypatch.setattr(ocr.subprocess, "Popen", child)

    def cancellation():
        return cancel and pidfile.exists()

    try:
        with pytest.raises(ocr.OCRError, match="cancelled" if cancel else "deadline"):
            ocr.extract_selected(tmp_path / "source.pdf", [1], timeout=2, cancelled=cancellation)
        monkeypatch.setattr(ocr.subprocess, "Popen", original)
        assert processes[0].poll() is not None
        assert pidfile.exists(), "Test failed to exercise a live descendant"
        pid = int(pidfile.read_text())
        # An orphan zombie can briefly remain until init reaps it; it must not run.
        import subprocess

        for _ in range(30):
            state = subprocess.run(
                ["ps", "-p", str(pid), "-o", "stat="], capture_output=True, text=True
            ).stdout.strip()
            if not state or state.startswith("Z"):
                break
            time.sleep(0.05)
        assert not state or state.startswith("Z")
    finally:
        for process in processes:
            if process.poll() is None:
                os.killpg(process.pid, signal.SIGKILL)
                process.wait()


@pytest.mark.skipif(not shutil.which("tesseract"), reason="Native Tesseract unavailable")
def test_native_preview_pins_original_and_image_without_library_writes(tmp_path):
    pytest.importorskip("pypdfium2")
    writer = PdfWriter()
    writer.add_blank_page(300, 200)
    output = BytesIO()
    writer.write(output)
    path = tmp_path / "source.pdf"
    original = output.getvalue()
    path.write_bytes(original)
    candidate, images = ocr.extract_selected(path, [1], mode="sparse", timeout=30)
    assert candidate["source_sha256"] == ocr.digest(original)
    assert path.read_bytes() == original
    assert set(tmp_path.iterdir()) == {path}
    assert candidate["approved"] is False and candidate["status"] == "preview"
    assert candidate["engine_version"].startswith("tesseract ")
    page = candidate["pages"][0]
    assert page["page"] == 1 and page["label"] == "1"
    assert page["fragments"] == [] and page["error"] is None
    assert page["width"] * page["height"] <= ocr.MAX_PIXELS
    assert page["image_sha256"] == ocr.digest(images[1])
    assert images[1].startswith(b"\x89PNG")


def test_bad_source_and_out_of_range_are_safe_errors(tmp_path):
    path = tmp_path / "private-source.pdf"
    path.write_bytes(b"private malformed PDF content")
    with pytest.raises(ocr.OCRError) as error:
        ocr.extract_selected(path, [1], timeout=10)
    assert "private" not in str(error.value)


def make_library(tmp_path, monkeypatch):
    store = Store(tmp_path / "library")
    doc = store.ingest(
        manual(
            "Native signed value -36 and readable evidence.",
            "Second page with enough original readable text for native extraction.",
        ),
        {"icao": "C172", "title": "Diagram OCR test"},
    )
    store.artifact(doc["id"], "distillation", {"status": "complete", "sections": [{"claims": []}]})

    def extraction(path, pages, **kwargs):
        image = b"a private faithful PNG fixture"
        return {
            "source_sha256": ocr.digest(path.read_bytes()),
            "page_count": 2,
            "mode": kwargs["mode"],
            "engine": "tesseract",
            "engine_version": "test",
            "renderer": "pdfium",
            "status": "preview",
            "approved": False,
            "pages": [
                {
                    "page": p,
                    "label": str(p),
                    "image_sha256": ocr.digest(image),
                    "width": 100,
                    "height": 100,
                    "error": None,
                    **(
                        {
                            "ocr_input_sha256": "4" * 64,
                            "ocr_preprocessing": {
                                "method": "straight-rules-v1",
                                "dark_threshold": 100,
                                "horizontal_min_run": 120,
                                "vertical_min_run": 80,
                            },
                        }
                        if kwargs["mode"] == "table"
                        else {}
                    ),
                    "fragments": [
                        {
                            "id": "fragment_1",
                            "text": "−36",
                            "offset": 0,
                            "bbox": [1, 1, 10, 10],
                            "confidence": 70,
                        }
                    ],
                }
                for p in pages
            ],
        }, {p: image for p in pages}

    monkeypatch.setattr(ocr, "extract_selected", extraction)
    return store, doc["id"]


@pytest.fixture
def library(tmp_path, monkeypatch):
    return make_library(tmp_path, monkeypatch)


def preview_request(store, identifier, **changes):
    context = ocr_reviews.context(store, identifier)
    return {
        "expected_sha256": context["source_sha256"],
        "expected_index_identity": context["index_identity"],
        "pages": [1],
        "mode": "sparse",
        **changes,
    }


def native_snapshot(store):
    with store.connection() as connection:
        return {
            table: [tuple(row) for row in connection.execute("SELECT * FROM " + table)]
            for table in (
                "documents",
                "pages",
                "passages",
                "vectors",
                "artifacts",
                "distillation_history",
                "metadata_history",
                "acquisitions",
            )
        }


def test_persistent_preview_leaves_all_native_evidence_unchanged(library):
    store, identifier = library
    before = native_snapshot(store)
    identity = store.index_identity(identifier)
    original = store.original(identifier).read_bytes()
    job = ocr_reviews.queue_preview(store, identifier, preview_request(store, identifier))
    worker = Worker(store, Models({}))
    assert worker.run_one()
    done = store.job(job["id"])
    assert done["state"] == "completed", done["error"]
    preview_id = done["result"]["preview_id"]
    detail = ocr_reviews.preview(store, identifier, preview_id)
    assert detail["source_current"] and detail["approved"] is False
    assert detail["source_metadata"] == store.get(identifier)["metadata"]
    assert detail["index_identity"] == identity == store.index_identity(identifier)
    assert ocr_reviews.preview_image(store, identifier, preview_id, 1).startswith(b"a private")
    assert store.checkpoint(job["id"])["preview_id"] == preview_id
    assert native_snapshot(store) == before
    assert store.original(identifier).read_bytes() == original


def test_queued_preview_excludes_document_jobs_and_metadata_rewrites(library):
    store, identifier = library
    request = preview_request(store, identifier)
    ocr_reviews.queue_preview(store, identifier, request)
    for operation in [
        lambda: store.create_job("index", {"document_id": identifier}),
        lambda: store.create_job("embed", {"document_id": identifier}),
        lambda: store.update_metadata(identifier, {"icao": "C182"}),
        lambda: store.index(identifier),
        lambda: ocr_reviews.queue_preview(store, identifier, request),
    ]:
        with pytest.raises(ocr_reviews.OCRConflict):
            operation()
    with pytest.raises(ValueError, match="source-pinned"):
        store.create_job("ocr_preview", {"document_id": identifier})


def test_existing_non_ocr_job_prevents_preview(library):
    store, identifier = library
    store.create_job("distill", {"document_id": identifier})
    with pytest.raises(ocr_reviews.OCRConflict):
        ocr_reviews.queue_preview(store, identifier, preview_request(store, identifier))


@pytest.mark.parametrize(
    "change",
    [
        {"expected_sha256": "0" * 64},
        {"expected_index_identity": "0" * 64},
        {"expected_index_identity": "bad"},
        {"pages": [999]},
        {"text": "edited replacement"},
    ],
)
def test_queue_requires_exact_source_and_allowed_fields(library, change):
    store, identifier = library
    with pytest.raises(ValueError):
        ocr_reviews.queue_preview(store, identifier, preview_request(store, identifier, **change))
    assert not store.jobs()["jobs"]


def test_preview_commit_is_idempotent_after_worker_interruption(library):
    store, identifier = library
    queued = ocr_reviews.queue_preview(store, identifier, preview_request(store, identifier))
    job = store.claim_job("owner")
    assert queued["id"] == job["id"]
    with store.job_scope(job["id"], "owner"):
        first = ocr_reviews.generate_preview(store, job)
        second = ocr_reviews.generate_preview(store, job)
    assert first["preview_id"] == second["preview_id"]
    with store.connection() as connection:
        assert connection.execute("SELECT COUNT(*) FROM ocr_previews").fetchone()[0] == 1
        assert connection.execute("SELECT COUNT(*) FROM ocr_preview_images").fetchone()[0] == 1


@pytest.mark.parametrize("kind", ["index", "metadata", "original", "lease"])
def test_concurrent_change_rejects_publication(library, monkeypatch, kind):
    store, identifier = library
    ocr_reviews.queue_preview(store, identifier, preview_request(store, identifier))
    job = store.claim_job("owner")
    original = ocr.extract_selected

    def race(*args, **kwargs):
        result = original(*args, **kwargs)
        if kind == "original":
            store.original(identifier).write_bytes(b"%PDF-altered original")
        else:
            with sqlite3.connect(store.db) as connection:
                if kind == "index":
                    connection.execute(
                        "UPDATE passages SET text='changed' WHERE document_id=?", (identifier,)
                    )
                elif kind == "metadata":
                    connection.execute(
                        "UPDATE documents SET metadata=? WHERE id=?",
                        ('{"icao":"C182"}', identifier),
                    )
                else:
                    connection.execute(
                        "UPDATE jobs SET worker='successor' WHERE id=?", (job["id"],)
                    )
        return result

    monkeypatch.setattr(ocr, "extract_selected", race)
    with store.job_scope(job["id"], "owner"):
        with pytest.raises((ValueError, LeaseLost)):
            ocr_reviews.generate_preview(store, job)
    with store.connection() as connection:
        assert not connection.execute("SELECT 1 FROM ocr_previews").fetchone()
        assert not connection.execute("SELECT 1 FROM ocr_preview_images").fetchone()


def test_missing_worker_ownership_cannot_publish(library):
    store, identifier = library
    job = ocr_reviews.queue_preview(store, identifier, preview_request(store, identifier))
    with pytest.raises(ocr_reviews.OCRConflict, match="ownership"):
        ocr_reviews.generate_preview(store, job)


@pytest.mark.parametrize("tamper", ["image", "candidate"])
def test_retained_preview_integrity_fails_closed(library, tamper):
    store, identifier = library
    job = ocr_reviews.queue_preview(store, identifier, preview_request(store, identifier))
    Worker(store, Models({})).run_one()
    preview_id = store.job(job["id"])["result"]["preview_id"]
    with store.connection() as connection:
        if tamper == "image":
            connection.execute("UPDATE ocr_preview_images SET image=?", (b"tampered",))
        else:
            connection.execute("UPDATE ocr_previews SET value='{}'")
    with pytest.raises(ValueError, match="integrity"):
        ocr_reviews.preview_image(store, identifier, preview_id, 1)


def test_historical_preview_is_inspectable_but_stale_after_metadata_change(library):
    store, identifier = library
    job = ocr_reviews.queue_preview(store, identifier, preview_request(store, identifier))
    Worker(store, Models({})).run_one()
    preview_id = store.job(job["id"])["result"]["preview_id"]
    store.update_metadata(identifier, {"icao": "C182"})
    detail = ocr_reviews.preview(store, identifier, preview_id)
    assert not detail["source_current"]
    assert detail["source_metadata"]["icao"] == "C172"


@pytest.mark.parametrize("failure", ["cancel", "unavailable", "image", "size", "partial"])
def test_preview_failure_keeps_native_state_and_truthful_job_result(library, monkeypatch, failure):
    store, identifier = library
    before = native_snapshot(store)
    original = ocr.extract_selected

    def extract(*args, **kwargs):
        if failure in {"cancel", "unavailable"}:
            raise ocr.OCRError(
                "OCR preview cancelled" if failure == "cancel" else "OCR unavailable"
            )
        candidate, images = original(*args, **kwargs)
        if failure == "image":
            images[1] = b"mismatched image"
        elif failure == "size":
            monkeypatch.setattr(ocr, "MAX_IMAGE_BYTES", 1)
        elif failure == "partial":
            candidate["status"] = "partial"
            candidate["pages"][0]["error"] = "OCR failed for this page"
            candidate["pages"][0]["fragments"] = []
        return candidate, images

    monkeypatch.setattr(ocr, "extract_selected", extract)
    job = ocr_reviews.queue_preview(store, identifier, preview_request(store, identifier))
    assert Worker(store, Models({})).run_one()
    done = store.job(job["id"])
    assert native_snapshot(store) == before
    with store.connection() as connection:
        saved = connection.execute("SELECT COUNT(*) FROM ocr_previews").fetchone()[0]
        image_count = connection.execute("SELECT COUNT(*) FROM ocr_preview_images").fetchone()[0]
    if failure == "partial":
        assert done["state"] == "completed" and done["result"]["status"] == "partial"
        detail = ocr_reviews.preview(store, identifier, done["result"]["preview_id"])
        assert detail["pages"][0]["error"] and not detail["pages"][0]["fragments"]
        assert not detail["approved"]
        assert saved == image_count == 1
    else:
        assert done["state"] == "failed" and done["error"]
        assert saved == image_count == 0
        assert not store.checkpoint(job["id"])


def test_retained_preview_survives_failed_reindex_for_historical_inspection(library):
    store, identifier = library
    job = ocr_reviews.queue_preview(store, identifier, preview_request(store, identifier))
    Worker(store, Models({})).run_one()
    preview_id = store.job(job["id"])["result"]["preview_id"]
    with store.connection() as connection:
        connection.execute("UPDATE documents SET status='failed' WHERE id=?", (identifier,))
    assert not ocr_reviews.preview(store, identifier, preview_id)["source_current"]
    assert ocr_reviews.preview_image(store, identifier, preview_id, 1)
