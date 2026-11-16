"""Original-backed acceptance for the private aircraft document service."""

from io import BytesIO
import json
from pathlib import Path
import sys

import httpx
import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from pypdf import PdfReader, PdfWriter
from pypdf.generic import DictionaryObject, NameObject, DecodedStreamObject

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "backend"))
from app.services.aircraft_library import pdf
from app.services.aircraft_library.store import Store, metadata
from app.services.aircraft_library.models import (
    Models,
    ModelUnavailable,
    ask,
    validate_answer,
    index_vectors,
    retrieve,
    distill,
)
from app.services.aircraft_library.discovery import (
    PublicWeb,
    AcquisitionError,
    public_address,
    discover,
    validate_url,
)
from app.services.aircraft_library.worker import Worker
from app.routers.aircraft_library import install


def manual(*pages):
    writer = PdfWriter()
    for text in pages:
        page = writer.add_blank_page(width=612, height=792)
        font = DictionaryObject(
            {
                NameObject("/Type"): NameObject("/Font"),
                NameObject("/Subtype"): NameObject("/Type1"),
                NameObject("/BaseFont"): NameObject("/Helvetica"),
            }
        )
        page[NameObject("/Resources")] = DictionaryObject(
            {NameObject("/Font"): DictionaryObject({NameObject("/F1"): font})}
        )
        content = DecodedStreamObject()
        escaped = text.replace("\\", "\\\\").replace("(", "\\(").replace(")", "\\)")
        content.set_data(("BT /F1 12 Tf 40 700 Td (" + escaped + ") Tj ET").encode("ascii"))
        page[NameObject("/Contents")] = content
    stream = BytesIO()
    writer.write(stream)
    return stream.getvalue()


@pytest.fixture
def store(tmp_path):
    return Store(tmp_path / "library")


def put(store, text="Performance: takeoff ground roll 900 feet at 2500 lb.", **meta):
    return store.ingest(
        manual(text), {"icao": "C172", "title": "Synthetic acceptance manual", **meta}
    )


def test_originals_pages_duplicates_and_restart(store):
    data = manual(
        "LIMITATIONS - Reference maximum weight is 2500 lb.",
        "MAINTENANCE - Inspect the synthetic filter every 25 hours.",
    )
    first = store.ingest(data, {"icao": "c172", "title": "Synthetic"}, filename="first.pdf")
    second = store.ingest(
        data,
        {"icao": "c172", "title": "Synthetic"},
        filename="second.pdf",
        url="https://example.org/manual.pdf",
    )
    assert first["id"] == second["id"]
    assert len(second["sources"]) == 2
    assert second["status"] == "indexed"
    assert second["extraction"]["page_count"] == 2
    assert store.original(first["id"]).read_bytes() == data
    assert len(list(store.objects.glob("*.pdf"))) == 1
    reopened = Store(store.root)
    assert "25 hours" in reopened.page(first["id"], 2)["text"]
    assert reopened.search("C172", "filter inspection")[0]["page"] == 2
    index = reopened.get(first["id"])["artifacts"]["section_index"]
    assert index["kind"] == "extractive_section_index"
    assert index["sections"]["maintenance"]["pages"][0]["page"] == 2


def test_tail_type_variant_and_revision_isolation(store):
    general = put(store, variant="S", revision="1")
    mine = put(store, tails=["n123ab", "N456CD"], variant="S", revision="2")
    other = put(store, tails=["N999ZZ"], variant="R")
    foreign = put(store, icao="SR22")
    assert store.select("C172") == [general["id"]]
    assert set(store.select("C172", registration="N123AB")) == {general["id"], mine["id"]}
    assert other["id"] not in store.select("C172", registration="N123AB")
    assert foreign["id"] not in store.select("C172", registration="N123AB")
    assert store.select("C172", registration="N456CD", revision="2") == [mine["id"]]
    assert store.select("C172", registration="N456CD", variant="R") == []
    assert store.search("C172", "roll", document_ids=[other["id"]]) == []


def test_invalid_input_and_encrypted_original_retained(store):
    with pytest.raises(ValueError):
        put(store, icao="../../etc")
    with pytest.raises(ValueError):
        metadata({"icao": "C172", "scope": "aircraft"})
    with pytest.raises(ValueError):
        store.ingest(b"<html>not pdf</html>", {"icao": "C172"})
    malformed = store.ingest(b"%PDF-broken", {"icao": "C172"})
    assert malformed["status"] == "failed"
    assert store.original(malformed["id"]).read_bytes() == b"%PDF-broken"
    writer = PdfWriter()
    writer.add_page(
        PdfReader(BytesIO(manual("Encrypted test page with secret information"))).pages[0]
    )
    writer.encrypt("secret")
    output = BytesIO()
    writer.write(output)
    encrypted = store.ingest(output.getvalue(), {"icao": "C172"})
    assert encrypted["status"] == "failed"
    assert "Encrypted" in encrypted["error"]
    assert store.original(encrypted["id"]).read_bytes() == output.getvalue()


def test_missing_text_is_partial_and_never_safe_by_absence(store):
    writer = PdfWriter()
    writer.add_blank_page(width=612, height=792)
    output = BytesIO()
    writer.write(output)
    document = store.ingest(output.getvalue(), {"icao": "C172"}, extract=False)
    result = store.index(document["id"], ocr=False)
    assert result["status"] == "partial"
    assert result["extraction"]["incomplete_pages"] == [1]
    assert store.search("C172", "engine limitations") == []
    answer = ask(store, Models({}), "C172", "engine limitations")
    assert answer["insufficient_evidence"] and answer["claims"] == []


def provider_answer(store, document):
    passage = store.search("C172", "ground roll")[0]
    value = {
        "insufficient_evidence": False,
        "reason": "",
        "claims": [
            {
                "text": "The synthetic example gives 900 feet at 2500 lb.",
                "citations": [
                    {
                        "passage_id": passage["passage_id"],
                        "quote": "takeoff ground roll 900 feet at 2500 lb.",
                    }
                ],
            }
        ],
    }
    return value, passage


def test_real_http_model_contract_and_verified_page_citations(store):
    document = put(store)
    value, passage = provider_answer(store, document)

    def provider(request):
        assert request.url.path == "/v1/chat/completions"
        assert request.headers["Authorization"] == "Bearer private-provider-key"
        body = json.loads(request.content)
        assert "untrusted" in body["messages"][0]["content"]
        context = json.loads(body["messages"][1]["content"])
        assert context["evidence"][0]["document_id"] == document["id"]
        return httpx.Response(200, json={"choices": [{"message": {"content": json.dumps(value)}}]})

    models = Models(
        {
            "AIRCRAFT_LIBRARY_LLM_BASE_URL": "https://models.example/v1",
            "AIRCRAFT_LIBRARY_LLM_MODEL": "test-model",
            "AIRCRAFT_LIBRARY_LLM_API_KEY": "private-provider-key",
        },
        transport=httpx.MockTransport(provider),
    )
    answer = ask(store, models, "C172", "takeoff ground roll")
    citation = answer["claims"][0]["citations"][0]
    assert citation["document_id"] == document["id"] and citation["page"] == 1
    assert "#page=1" in citation["original_url"]
    assert answer["model"] == "test-model"
    assert answer["insufficient_evidence"] is False


def test_invented_quotes_sources_and_numbers_are_rejected(store):
    document = put(store)
    value, passage = provider_answer(store, document)
    validate_answer(value, [passage])
    for change in ["source", "quote", "number", "missing"]:
        candidate = json.loads(json.dumps(value))
        if change == "source":
            candidate["claims"][0]["citations"][0]["passage_id"] = 999999
        elif change == "quote":
            candidate["claims"][0]["citations"][0]["quote"] = "Imaginary maintenance interval"
        elif change == "number":
            candidate["claims"][0]["text"] = "Takeoff requires 7777 feet."
        else:
            candidate["claims"][0]["citations"] = []
        with pytest.raises(ModelUnavailable):
            validate_answer(candidate, [passage])


def test_persistent_semantic_index_filters_tail_and_model(store):
    document = put(store)
    secret = put(store, text="Private other-tail checklist prohibits operation.", tails=["N999ZZ"])

    def provider(request):
        body = json.loads(request.content)
        return httpx.Response(
            200,
            json={
                "data": [
                    {"index": i, "embedding": [1.0, 0.5, 0.0]} for i in range(len(body["input"]))
                ]
            },
        )

    models = Models(
        {
            "AIRCRAFT_LIBRARY_LLM_BASE_URL": "https://models.example/v1",
            "AIRCRAFT_LIBRARY_EMBEDDING_MODEL": "vector-1",
        },
        transport=httpx.MockTransport(provider),
    )
    assert index_vectors(store, [document["id"], secret["id"]], models)["passages"] == 2
    hits, warnings = retrieve(
        Store(store.root), models, "C172", "departure distance", registration="N123AB"
    )
    assert warnings == [] and {row["document_id"] for row in hits} == {document["id"]}


@pytest.mark.parametrize(
    "url",
    [
        "file:///etc/passwd",
        "https://user:pass@example.org/doc.pdf",
        "https://example.org:2375/doc.pdf",
        "https://example.org/?api_key=secret",
    ],
)
def test_unsafe_source_urls_rejected(url):
    with pytest.raises(AcquisitionError):
        validate_url(url)


def test_private_dns_and_redirects_are_rejected(monkeypatch):
    import socket

    monkeypatch.setattr(
        socket, "getaddrinfo", lambda *args, **kwargs: [(2, 1, 6, "", ("127.0.0.1", 443))]
    )
    with pytest.raises(AcquisitionError):
        public_address("attacker.example", 443)

    class Web(PublicWeb):
        def allowed(self, url):
            return True

        def _request(self, url, *, max_bytes):
            if "attacker.example" in url:
                return 302, {"location": "http://127.0.0.1/internal"}, b""
            return super()._request(url, max_bytes=max_bytes)

    with pytest.raises(AcquisitionError):
        Web().get("https://attacker.example/manual.pdf")


def test_multi_example_discovery_and_per_source_errors(store):
    data1 = manual("Example one: operating handbook performance limitations.")
    data2 = manual("Example two: maintenance servicing and engine inspection.")

    class Search:
        def query(self, query):
            return [
                {
                    "url": "https://public.example/manuals",
                    "title": "Library",
                    "query": query,
                    "provider": "fixture",
                },
                {
                    "url": "https://public.example/broken.pdf",
                    "title": "Broken",
                    "query": query,
                    "provider": "fixture",
                },
            ]

    class Web:
        def get(self, url):
            if url.endswith("/manuals"):
                content, kind = (
                    b'<a href="one.pdf">One</a><a href="two.pdf">Two</a><a href="copy.pdf">Copy</a>',
                    "text/html",
                )
            elif url.endswith("broken.pdf"):
                raise AcquisitionError("Unavailable example")
            else:
                content, kind = (data2 if url.endswith("two.pdf") else data1), "application/pdf"
            return {"url": url, "content": content, "content_type": kind}

    result = discover(store, {"icao": "C172"}, web=Web(), search=Search())
    assert result["unique_originals"] == 2
    assert len(result["queries"]) == 6
    assert len(store.list("C172")) == 2
    assert any(r["status"] == "failed" for r in result["results"])
    assert sum(len(d["sources"]) for d in store.list("C172")) == 3


def test_queue_claim_is_exclusive_and_processing_survives_reopen(store):
    document = put(store)
    job = store.create_job("index", {"document_id": document["id"]})
    claimed = store.claim_job("owner-one")
    assert claimed["id"] == job["id"]
    assert Store(store.root).claim_job("owner-two") is None
    with store.connection() as connection:
        connection.execute(
            "UPDATE jobs SET updated_at='2000-01-01T00:00:00+00:00' WHERE id=?", (job["id"],)
        )
    worker = Worker(Store(store.root), Models({}))
    assert worker.run_one()
    assert store.job(job["id"])["state"] == "completed"


def test_distillation_covers_all_recovered_pages_and_failed_refresh_is_partial(store):
    document = store.ingest(
        manual(
            "LIMITATIONS: synthetic maximum weight 2500 lb.",
            "PERFORMANCE: synthetic ground roll 900 feet at 2500 lb.",
            "MAINTENANCE: synthetic filter inspection every 25 hours.",
        ),
        {"icao": "C172"},
    )

    class CitedModels:
        model = "deterministic-contract-provider"

        def complete(self, evidence, question):
            assert {p["page"] for p in evidence} == {1, 2, 3}
            return {
                "insufficient_evidence": False,
                "claims": [
                    {
                        "text": p["text"],
                        "citations": [{"passage_id": p["passage_id"], "quote": p["text"]}],
                    }
                    for p in evidence
                ],
            }

    result = distill(store, CitedModels(), document["id"])
    assert result["status"] == "complete"
    assert result["sections"][0]["pages"] == [1, 2, 3]
    assert {c["citations"][0]["page"] for c in result["sections"][0]["claims"]} == {1, 2, 3}

    class FailingModels(CitedModels):
        def complete(self, evidence, question):
            raise ModelUnavailable("Provider unavailable")

    with pytest.raises(ModelUnavailable):
        distill(store, FailingModels(), document["id"])
    assert store.get(document["id"])["artifacts"]["distillation"]["status"] == "partial"
    assert store.get(document["id"])["artifacts"]["distillation"]["completed_batches"] == 0


def test_metadata_association_changes_preserve_history_and_invalidate_distillation(store):
    document = put(store)
    store.artifact(document["id"], "distillation", {"status": "complete"})
    updated = store.update_metadata(
        document["id"], {"icao": "C172", "tails": ["N123AB"], "revision": "reviewed edition"}
    )
    assert store.select("C172") == []
    assert store.select("C172", registration="N123AB") == [document["id"]]
    assert "distillation" not in updated["artifacts"]
    with store.connection() as connection:
        assert connection.execute("SELECT COUNT(*) FROM metadata_history").fetchone()[0] == 1


def test_page_chunks_never_cross_source_pages():
    passages = list(
        pdf.chunks(
            [
                {"page": 1, "label": "1-1", "text": "A" * 4000, "method": "text"},
                {"page": 2, "label": "1-2", "text": "B" * 4000, "method": "ocr"},
            ]
        )
    )
    assert len(passages) > 2
    assert all(set(p["text"]) == ({"A"} if p["page"] == 1 else {"B"}) for p in passages)


def test_unconfigured_search_fails_explicitly_without_broad_unrelated_results():
    from app.services.aircraft_library.discovery import Search

    search = Search(environment={})
    assert search.capabilities()["configured"] is False
    with pytest.raises(AcquisitionError, match="Configure Brave"):
        search.query("C172 POH PDF")


def test_readable_empty_password_pdf_keeps_original_encryption_and_indexes(store):
    writer = PdfWriter()
    writer.add_page(
        PdfReader(
            BytesIO(manual("Public manual limitations and performance reference page."))
        ).pages[0]
    )
    writer.encrypt("", algorithm="AES-256")
    output = BytesIO()
    writer.write(output)
    result = store.ingest(output.getvalue(), {"icao": "C172"})
    assert result["status"] == "indexed"
    assert result["extraction"]["encryption"] == "empty_reader_password"
    assert store.original(result["id"]).read_bytes() == output.getvalue()


def test_future_database_schema_is_not_silently_downgraded(store):
    with store.connection() as connection:
        connection.execute("PRAGMA user_version=99")
    with pytest.raises(ValueError, match="Unsupported aircraft library schema"):
        Store(store.root)
    with store.connection() as connection:
        assert connection.execute("PRAGMA user_version").fetchone()[0] == 99


def test_generated_artifact_cannot_resurrect_old_aircraft_applicability(store):
    document = put(store)
    previous = document["metadata"]
    store.update_metadata(document["id"], {**previous, "tails": ["N123AB"], "scope": "aircraft"})
    with pytest.raises(ValueError, match="metadata changed"):
        store.artifact(
            document["id"], "distillation", {"status": "complete"}, expected_metadata=previous
        )
    assert "distillation" not in store.get(document["id"])["artifacts"]


def test_private_api_upload_search_original_and_openapi(store, monkeypatch):
    token = "a" * 40
    monkeypatch.setenv("AIRCRAFT_LIBRARY_TOKEN", token)
    app = FastAPI()
    install(app, store=store, models=Models({}), worker_enabled=False)
    client = TestClient(app)
    path = "/api/aircraft-library"
    assert client.get(path + "/capabilities").status_code == 401
    headers = {"Authorization": "Bearer " + token}
    data = manual("Performance: takeoff ground roll 900 feet at 2500 lb.")
    response = client.post(
        path + "/documents",
        headers=headers,
        files={"file": ("reference.pdf", data, "application/pdf")},
        data={"metadata_json": json.dumps({"icao": "C172", "tails": ["N123AB"]})},
    )
    assert response.status_code == 202, response.text
    doc = response.json()["document"]
    assert doc["status"] == "stored"
    Worker(store, Models({})).run_one()
    found = client.post(
        path + "/search",
        headers=headers,
        json={"icao": "C172", "registration": "N123AB", "question": "takeoff"},
    )
    assert found.status_code == 200 and len(found.json()["passages"]) == 1
    assert (
        client.post(
            path + "/search",
            headers=headers,
            json={"icao": "C172", "registration": "N999ZZ", "question": "takeoff"},
        ).json()["passages"]
        == []
    )
    original = client.get(doc["original_url"], headers=headers)
    assert original.content == data and original.headers["cache-control"] == "private, no-store"
    assert "attachment" in original.headers["content-disposition"]
    assert client.get(doc["original_url"]).status_code == 401
    schema = app.openapi()
    assert path + "/ask" in schema["paths"]
    assert schema["paths"][path + "/ask"]["post"]["security"]
    monkeypatch.delenv("AIRCRAFT_LIBRARY_TOKEN")
    assert client.get(path + "/capabilities", headers=headers).status_code == 503
