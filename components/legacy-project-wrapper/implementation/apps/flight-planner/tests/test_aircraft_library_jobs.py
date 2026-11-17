"""Durable, bounded processing visibility for the private aircraft library."""

from concurrent.futures import ThreadPoolExecutor
import threading

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from .test_aircraft_library import put
from app.routers.aircraft_library import install
from app.services.aircraft_library.models import Models
from app.services.aircraft_library.store import Store


@pytest.fixture
def store(tmp_path):
    return Store(tmp_path / "library")


def test_reopened_queue_lists_active_work_before_bounded_terminal_history(store):
    document = put(store)
    first = store.create_job("index", {"document_id": document["id"]})
    assert store.claim_job("fixture-worker")["id"] == first["id"]
    queued = store.create_job("embed", {"document_id": document["id"]})
    completed = store.create_job("distill", {"document_id": document["id"]})
    store.finish_job(completed["id"], result={"original_pages": "x" * 1_000_000})
    failed = store.create_job("distill", {"document_id": document["id"]})
    store.finish_job(failed["id"], error="Provider unavailable")

    reopened = Store(store.root)
    first_page = reopened.jobs(limit=2)
    assert [row["id"] for row in first_page["jobs"]] == [first["id"], queued["id"]]
    assert first_page["next_offset"] == 2 and first_page["total"] == 4
    second_page = reopened.jobs(limit=2, offset=2)
    assert {row["id"] for row in second_page["jobs"]} == {completed["id"], failed["id"]}
    assert second_page["next_offset"] is None
    summaries = first_page["jobs"] + second_page["jobs"]
    assert all("request" not in row and "result" not in row for row in summaries)
    assert all(row["subject"]["document_id"] == document["id"] for row in summaries)
    assert all(row["subject"]["icao"] == "C172" for row in summaries)
    assert next(row for row in summaries if row["id"] == completed["id"])["has_result"]
    assert not next(row for row in summaries if row["id"] == failed["id"])["has_result"]
    assert reopened.job(completed["id"])["result"]["original_pages"] == "x" * 1_000_000
    assert reopened.jobs(limit=2, offset=100)["jobs"] == []


def test_concurrent_repeated_document_requests_reuse_active_work_then_allow_a_new_run(store):
    document = put(store)
    gate = threading.Barrier(2)

    def enqueue(_):
        gate.wait(timeout=5)
        return store.create_job("index", {"document_id": document["id"]})["id"]

    with ThreadPoolExecutor(max_workers=2) as pool:
        identifiers = list(pool.map(enqueue, range(2)))
    assert len(set(identifiers)) == 1
    original = identifiers[0]
    assert Store(store.root).create_job("index", {"document_id": document["id"]})["id"] == original
    assert store.claim_job("fixture-worker")["id"] == original
    assert store.create_job("index", {"document_id": document["id"]})["id"] == original
    other_document = put(store, text="A different original manual contains other source facts.")
    assert store.create_job("index", {"document_id": other_document["id"]})["id"] != original
    assert store.create_job("distill", {"document_id": document["id"]})["id"] != original
    store.finish_job(original, result={"status": "indexed"})
    assert store.create_job("index", {"document_id": document["id"]})["id"] != original
    assert store.job(original)["state"] == "completed"


@pytest.mark.parametrize("limit,offset", [(0, 0), (101, 0), (True, 0), (20, -1), (20, True)])
def test_queue_page_bounds_do_not_allow_unbounded_reads(store, limit, offset):
    with pytest.raises(ValueError):
        store.jobs(limit=limit, offset=offset)


def test_private_job_listing_omits_large_bodies_but_keeps_authenticated_details(store, monkeypatch):
    token = "synthetic-library-job-fixture-token"
    monkeypatch.setenv("AIRCRAFT_LIBRARY_TOKEN", token)
    document = put(store)
    job = store.create_job("index", {"document_id": document["id"]})
    store.finish_job(job["id"], result={"result_marker": "x" * 1_000_000})
    app = FastAPI()
    install(app, store=store, models=Models({}), worker_enabled=False)
    headers = {"Authorization": "Bearer " + token}
    with TestClient(app) as client:
        assert client.get("/api/aircraft-library/jobs").status_code == 401
        response = client.get("/api/aircraft-library/jobs?limit=1", headers=headers)
        assert response.status_code == 200 and "no-store" in response.headers["cache-control"]
        assert len(response.content) < 2000
        summary = response.json()["jobs"][0]
        assert (
            summary["has_result"] and summary["subject"]["title"] == document["metadata"]["title"]
        )
        assert "result" not in summary and "request" not in summary
        detail = client.get("/api/aircraft-library/jobs/" + job["id"], headers=headers).json()
        assert len(detail["result"]["result_marker"]) == 1_000_000
        assert (
            client.get("/api/aircraft-library/jobs?limit=101", headers=headers).status_code == 422
        )
        assert (
            client.get("/api/aircraft-library/jobs?offset=-1", headers=headers).status_code == 422
        )
        schema = client.get("/openapi.json").json()
        assert schema["paths"]["/api/aircraft-library/jobs"]["get"]["security"]
