"""Restartable library work queue with per-process ownership and heartbeat."""

from __future__ import annotations

import threading
import uuid

from .discovery import discover, acquire_candidates
from .models import distill, index_vectors


class Worker:
    def __init__(self, store, models):
        self.store, self.models = store, models
        self.owner = uuid.uuid4().hex
        self.stop = threading.Event()
        self.thread = None

    def start(self):
        if self.thread and self.thread.is_alive():
            return
        self.stop.clear()
        self.thread = threading.Thread(target=self.run, name="aircraft-library", daemon=True)
        self.thread.start()

    def close(self):
        # Work and originals are durable. A killed process leaves a recoverable lease.
        self.stop.set()
        if self.thread:
            self.thread.join(timeout=1)

    def execute(self, job):
        request = job["request"]
        if job["kind"] == "index":
            document = self.store.index(request["document_id"])
            if document["status"] == "failed":
                raise ValueError(document["error"])
            result = {"document_id": document["id"], "status": document["status"]}
            if self.models.capabilities()["embeddings"]:
                result["vectors"] = index_vectors(self.store, [document["id"]], self.models)
            if self.models.capabilities()["llm"]:
                result["distillation"] = distill(self.store, self.models, document["id"])
            return result
        if job["kind"] in {"discover", "acquire"}:
            if job["kind"] == "discover":
                result = discover(self.store, request["metadata"], maximum=request["maximum"])
            else:
                result = acquire_candidates(
                    self.store,
                    request["metadata"],
                    [
                        {"url": url, "title": "", "provider": "operator-provided URL"}
                        for url in request["urls"]
                    ],
                    maximum=request["maximum"],
                )
            # Each acquired PDF has a separate durable indexing/distillation job.
            for identifier in {r["document_id"] for r in result["results"] if r.get("document_id")}:
                self.store.create_job("index", {"document_id": identifier})
            return result
        if job["kind"] == "distill":
            return distill(self.store, self.models, request["document_id"])
        if job["kind"] == "embed":
            return index_vectors(self.store, [request["document_id"]], self.models)
        raise ValueError("Unknown library job")

    def run_one(self):
        job = self.store.claim_job(self.owner)
        if job is None:
            return False
        finished = threading.Event()

        def heartbeat():
            while not finished.wait(30):
                self.store.heartbeat(job["id"], self.owner)

        keeper = threading.Thread(target=heartbeat, daemon=True)
        keeper.start()
        try:
            result = self.execute(job)
            self.store.finish_job(job["id"], result=result)
        except Exception as error:
            # Provider response bodies and credentials never enter job records.
            from .discovery import AcquisitionError
            from .models import ModelUnavailable

            message = (
                str(error)
                if isinstance(error, (AcquisitionError, ModelUnavailable, ValueError))
                else "Library job failed; originals retained"
            )
            self.store.finish_job(job["id"], error=message[:2000])
        finally:
            finished.set()
            keeper.join(timeout=1)
        return True

    def run(self):
        while not self.stop.is_set():
            if not self.run_one():
                self.stop.wait(1)
