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
    verified_completion,
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


def test_asymmetric_embedding_modes_and_index_identity_isolation(store):
    document = put(store, text="Starting procedure: set the synthetic switch.")
    calls = []

    def provider(request):
        body = json.loads(request.content)
        calls.append(body)
        return httpx.Response(200, json={"data": [
            {"index": i, "embedding": [1.0, 0.0]} for i in range(len(body["input"]))
        ]})

    config = {
        "AIRCRAFT_LIBRARY_LLM_BASE_URL": "https://models.example/v1",
        "AIRCRAFT_LIBRARY_EMBEDDING_MODEL": "retriever",
        "AIRCRAFT_LIBRARY_EMBEDDING_MODE": "query_passage",
    }
    models = Models(config, transport=httpx.MockTransport(provider))
    index_vectors(store, [document["id"]], models)
    hits, warnings = retrieve(store, models, "C172", "unmatchedquestion")
    assert hits[0]["document_id"] == document["id"] and not warnings
    assert [call["input_type"] for call in calls] == ["passage", "query"]
    for changed in [
        {"AIRCRAFT_LIBRARY_EMBEDDING_MODE": "symmetric"},
        {"AIRCRAFT_LIBRARY_LLM_BASE_URL": "https://other.example/v1"},
        {"AIRCRAFT_LIBRARY_EMBEDDING_MODEL": "another-model"},
    ]:
        other = Models({**config, **changed}, transport=httpx.MockTransport(provider))
        hits, warnings = retrieve(store, other, "C172", "unmatchedquestion")
        assert not hits and warnings == ["No vectors for this model/scope; using full-text retrieval"]
        assert other.embedding_identity != models.embedding_identity
    assert "input_type" not in calls[2]


def test_invalid_embedding_configuration_fails_explicitly():
    with pytest.raises(ValueError, match="Embedding mode"):
        Models({"AIRCRAFT_LIBRARY_EMBEDDING_MODE": "automatic"})


def test_single_passage_provider_limit_still_indexes_every_document(store):
    documents = [put(store, text="Synthetic manual " + str(i)) for i in range(3)]
    calls = []
    def provider(request):
        body = json.loads(request.content)
        calls.append(body["input"])
        if len(body["input"]) != 1:
            return httpx.Response(500, json={"error": "Single input required"})
        return httpx.Response(200, json={"data": [{"index": 0, "embedding": [1.0, 0.0]}]})
    models = Models({
        "AIRCRAFT_LIBRARY_LLM_BASE_URL": "https://models.example/v1",
        "AIRCRAFT_LIBRARY_EMBEDDING_MODEL": "retriever",
        "AIRCRAFT_LIBRARY_EMBEDDING_BATCH_SIZE": "1",
    }, transport=httpx.MockTransport(provider))
    result = index_vectors(store, [d["id"] for d in documents], models)
    assert result["passages"] == 3 and len(calls) == 3
    with store.connection() as connection:
        assert connection.execute("SELECT count(*) FROM vectors WHERE model=?", (models.embedding_identity,)).fetchone()[0] == 3


@pytest.mark.parametrize("size", ["0", "33", "many", "1.5"])
def test_invalid_embedding_batch_limit_is_rejected(size):
    with pytest.raises(ValueError, match="Embedding batch size"):
        Models({"AIRCRAFT_LIBRARY_EMBEDDING_BATCH_SIZE": size})


def test_truncated_model_completion_is_not_admitted_even_if_json_parses():
    def provider(request):
        return httpx.Response(200, json={"choices": [{
            "finish_reason": "length",
            "message": {"content": '{"insufficient_evidence": true, "reason": "", "claims": []}'},
        }]})
    models = Models({
        "AIRCRAFT_LIBRARY_LLM_BASE_URL": "https://models.example/v1",
        "AIRCRAFT_LIBRARY_LLM_MODEL": "test-model",
    }, transport=httpx.MockTransport(provider))
    with pytest.raises(ModelUnavailable, match="required cited JSON"):
        models.complete([], "Summarize")


def test_citations_resolve_pdf_layout_whitespace_to_exact_original_spans(store):
    document = put(store)
    passage = store.passages([document["id"]])[0]
    passage = {**passage, "text": "Fuel capacity\n     19.8 US Gallons\nUse conditions apply."}
    value = {"insufficient_evidence": False, "reason": "", "claims": [{
        "text": "Fuel capacity is 19.8 US Gallons.",
        "citations": [{"passage_id": passage["passage_id"], "quote": "Fuel capacity 19.8 US Gallons"}],
    }]}
    answer = validate_answer(value, [passage])
    quote = answer["claims"][0]["citations"][0]["quote"]
    assert quote == "Fuel capacity\n     19.8 US Gallons" and quote in passage["text"]
    for changed in ["Fuel capacity 29.8 US Gallons", "Fuel usable capacity 19.8 US Gallons", "Fuel capacity: 19.8 US Gallons"]:
        value["claims"][0]["citations"][0]["quote"] = changed
        with pytest.raises(ModelUnavailable, match="citation not present"):
            validate_answer(value, [passage])


def test_model_correction_revalidates_evidence_and_stops_at_a_bound(store):
    document = put(store)
    good, passage = provider_answer(store, document)
    bad = json.loads(json.dumps(good))
    bad["claims"][0]["citations"][0]["quote"] = "Invented source quotation without evidence"
    class Correcting:
        def __init__(self, correct): self.prompts, self.correct = [], correct
        def complete(self, evidence, question):
            self.prompts.append(question)
            return good if self.correct and len(self.prompts) > 1 else bad
    models = Correcting(True)
    answer = verified_completion(models, [passage], "Summarize")
    assert answer["claims"] and len(models.prompts) == 2
    assert "citation not present" in models.prompts[1]
    assert "rejected_candidate" in models.prompts[1]
    failing = Correcting(False)
    with pytest.raises(ModelUnavailable, match="citation not present"):
        verified_completion(failing, [passage], "Summarize")
    assert len(failing.prompts) == 3


def test_partial_distillation_resumes_verified_batches_and_invalidates_changed_model(store):
    document = store.ingest(manual(*[
        ("Page %s. " % i) + "Synthetic manual evidence. " * 50 for i in range(24)
    ]), {"icao": "C172"})
    class Provider:
        model = "resume-model"
        base = "https://models.example/v1"
        def __init__(self, fail=False): self.calls, self.fail = [], fail
        def complete(self, evidence, question):
            self.calls.append([p["passage_id"] for p in evidence])
            if self.fail and len(self.calls) == 2:
                raise ModelUnavailable("Rate limited")
            p = evidence[0]
            return {"insufficient_evidence": False, "reason": "", "claims": [{
                "text": p["text"][:60],
                "citations": [{"passage_id": p["passage_id"], "quote": p["text"][:60]}],
            }]}
    failing = Provider(True)
    with pytest.raises(ModelUnavailable, match="Rate limited"):
        distill(store, failing, document["id"])
    partial = store.get(document["id"])["artifacts"]["distillation"]
    assert partial["status"] == "partial" and partial["completed_batches"] == 1
    resumed = Provider()
    complete = distill(Store(store.root), resumed, document["id"])
    assert complete["status"] == "complete" and complete["unresolved_batches"] == 0
    assert resumed.calls[0] == failing.calls[1]
    assert complete["sections"][0] == partial["sections"][0]
    # An interrupted run from another model must begin at the original evidence.
    store.artifact(document["id"], "distillation", partial)
    changed = Provider(); changed.model = "different-model"
    distill(store, changed, document["id"])
    assert changed.calls[0] == failing.calls[0]


def test_unresolved_readable_batch_does_not_claim_complete_distillation(store):
    document = put(store)
    class Insufficient:
        model = "insufficient-model"
        def complete(self, evidence, question):
            return {"insufficient_evidence": True, "reason": "Cannot establish support", "claims": []}
    result = distill(store, Insufficient(), document["id"])
    assert result["status"] == "partial" and result["unresolved_batches"] == 1


@pytest.mark.parametrize("size", ["1999", "18001", "many", "2000.5"])
def test_invalid_distillation_budget_is_rejected(size):
    with pytest.raises(ValueError, match="Distillation batch size"):
        Models({"AIRCRAFT_LIBRARY_DISTILL_BATCH_CHARS": size})


def test_small_provider_distillation_budget_still_reviews_every_passage(store):
    document = store.ingest(manual(*[
        ("Page %s. " % i) + "Synthetic source evidence. " * 50 for i in range(8)
    ]), {"icao": "C172"})
    reviewed = []
    def provider(request):
        context = json.loads(json.loads(request.content)["messages"][1]["content"])
        evidence = context["evidence"]
        assert sum(len(p["text"]) for p in evidence) <= 2000
        reviewed.extend(p["passage_id"] for p in evidence)
        first = evidence[0]
        answer = {"insufficient_evidence": False, "reason": "", "claims": [{
            "text": first["text"][:100],
            "citations": [{"passage_id": first["passage_id"], "quote": first["text"][:100]}],
        }]}
        return httpx.Response(200, json={"choices": [{"message": {"content": json.dumps(answer)}}]})
    models = Models({
        "AIRCRAFT_LIBRARY_LLM_BASE_URL": "https://models.example/v1",
        "AIRCRAFT_LIBRARY_LLM_MODEL": "small-context-model",
        "AIRCRAFT_LIBRARY_DISTILL_BATCH_CHARS": "2000",
    }, transport=httpx.MockTransport(provider))
    result = distill(store, models, document["id"])
    assert result["status"] == "complete" and result["total_batches"] > 1
    assert reviewed == [p["passage_id"] for p in store.passages([document["id"]])]


@pytest.mark.parametrize("interval", ["-1", "121", "nan", "inf", "many"])
def test_invalid_model_pacing_interval_is_rejected(interval):
    with pytest.raises(ValueError, match="LLM minimum interval"):
        Models({"AIRCRAFT_LIBRARY_LLM_MIN_INTERVAL_SECONDS": interval})


def test_completion_pacing_includes_failed_requests_without_delaying_embeddings():
    current, starts, waits = [0.0], [], []
    def sleep(seconds):
        waits.append(seconds); current[0] += seconds
    def provider(request):
        starts.append((request.url.path, current[0]))
        if len(starts) == 1: return httpx.Response(429, json={"error":"Limited"})
        if request.url.path.endswith('/embeddings'):
            return httpx.Response(200,json={"data":[{"index":0,"embedding":[1.0,0.0]}]})
        return httpx.Response(200,json={"choices":[{"message":{"content":'{"insufficient_evidence":true,"reason":"","claims":[]}'}}]})
    models = Models({
        "AIRCRAFT_LIBRARY_LLM_BASE_URL":"https://models.example/v1",
        "AIRCRAFT_LIBRARY_LLM_MODEL":"test-model",
        "AIRCRAFT_LIBRARY_EMBEDDING_MODEL":"embed-model",
        "AIRCRAFT_LIBRARY_LLM_MIN_INTERVAL_SECONDS":"35",
    },transport=httpx.MockTransport(provider),clock=lambda:current[0],sleep=sleep)
    with pytest.raises(ModelUnavailable):models.complete([],"Summarize")
    assert models.embed(["text"]) == [[1.0,0.0]] and not waits
    models.complete([],"Summarize")
    assert starts == [("/v1/chat/completions",0.0),("/v1/embeddings",0.0),("/v1/chat/completions",35.0)]
    assert waits == [35.0]


def test_provider_http_status_is_actionable_without_exposing_response_secrets():
    models = Models({"AIRCRAFT_LIBRARY_LLM_BASE_URL":"https://models.example/v1"},
        transport=httpx.MockTransport(lambda request:httpx.Response(429,json={"error":"private-provider-value"})))
    with pytest.raises(ModelUnavailable) as error:
        models.post('/chat/completions',{})
    assert 'HTTP 429' in str(error.value)
    assert 'private-provider-value' not in str(error.value)
