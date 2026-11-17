"""Cache-only HTTP/OpenAPI contracts and source-quality semantics."""

from copy import deepcopy
import json
from pathlib import Path

from fastapi import FastAPI
from fastapi.testclient import TestClient
import pytest

from app.routers.notams import install
from app.services.nms_cache import NMSCache, CLASSES, instant, utc
from app.services.nms_client import NMSUnavailable

BASE = instant("2026-11-16T12:00:00Z")


def feature(identifier="one", **changes):
    n = dict(
        id=identifier,
        location="PAO",
        icaoLocation="KPAO",
        text="RWY 01 CLOSED",
        type="N",
        classification="DOM",
        effectiveStart=utc(BASE - 10),
        effectiveEnd=utc(BASE + 86400),
        lastUpdated=utc(BASE),
    )
    n.update(changes)
    return dict(type="Feature", geometry=None, properties={"coreNOTAMData": {"notam": n}})


@pytest.fixture
def source(tmp_path):
    now = [BASE]
    cache = NMSCache(tmp_path / "cache", "staging", clock=lambda: now[0])

    class Feed:
        environment = "staging"
        rows = [feature()]

        def features(self, params, **kwargs):
            return deepcopy(self.rows) if params.get("classification") == "DOMESTIC" else []

    feed = Feed()
    for _ in range(len(CLASSES) + 1):
        cache.sync_once(feed)
        now[0] += 2
    return cache, now, feed


def http(cache=None):
    app = FastAPI()
    install(app, cache=cache)
    return TestClient(app)


def test_typed_utc_dates_source_status_and_no_credentials_needed(source, monkeypatch):
    cache, now, _ = source
    monkeypatch.delenv("FAA_NMS_CLIENT_ID", raising=False)
    monkeypatch.delenv("FAA_NMS_CLIENT_SECRET", raising=False)
    client = http(cache)
    response = client.get("/api/notams?airport=kpao")
    assert response.status_code == 200 and response.headers["cache-control"] == "no-store"
    result = response.json()
    assert (
        result["status"] == "available" and result["total"] == 1 and not result["production_data"]
    )
    assert result["environment"] == "staging" and "test NOTAMs" in " ".join(result["warnings"])
    row = result["notams"][0]
    assert row["effective_start_utc"] == utc(BASE - 10) and row["last_updated_utc"] == utc(BASE)
    assert row["severity"] == "critical" and row["activity"] == "effective"
    assert "feature" not in row and not row["text_truncated"]
    assert set(result["matched_locations"]) == {"KPAO", "PAO"}
    detail = client.get(row["detail_url"])
    assert detail.status_code == 200 and detail.json()["source_feature"] == feature()
    schema = client.get("/openapi.json").json()
    assert schema["paths"]["/api/notams"]["get"]["operationId"] == "notams_reports"
    assert (
        "$ref"
        in schema["paths"]["/api/notams"]["get"]["responses"]["200"]["content"]["application/json"][
            "schema"
        ]
    )


def test_unconfigured_cache_never_starts_a_worker_or_creates_data(tmp_path, monkeypatch):
    monkeypatch.delenv("FAA_NMS_ENVIRONMENT", raising=False)
    monkeypatch.setenv("FAA_NMS_CACHE_DIR", str(tmp_path / "not-created"))
    client = http()
    assert client.get("/api/notams/capabilities").json()["environment"] is None
    result = client.get("/api/notams?airport=KPAO").json()
    assert result["status"] == "unavailable" and not result["complete_snapshot"]
    assert result["notams"] == [] and result["error"] and not (tmp_path / "not-created").exists()
    assert client.get("/api/notams/detail?id=one").status_code == 503


def test_no_matches_is_distinct_from_stale_and_unavailable(source):
    cache, now, _ = source
    client = http(cache)
    assert client.get("/api/notams?airport=KSFO").json()["status"] == "no_reports"
    now[0] += 300
    result = client.get("/api/notams?airport=KPAO").json()
    assert result["status"] == "stale" and result["notams"]
    assert client.get("/api/notams?airport=KSFO").json()["status"] == "stale"
    assert client.get("/api/notams/detail?id=missing").status_code == 404


def test_permanent_and_missing_fields_are_not_fabricated_or_discarded(tmp_path):
    now = [BASE]
    cache = NMSCache(tmp_path, "staging", clock=lambda: now[0])

    class Feed:
        environment = "staging"

        def features(self, params, **kwargs):
            return (
                [feature(effectiveEnd="PERM", type=None, effectiveStart=None, text=None)]
                if params.get("classification") == "DOMESTIC"
                else []
            )

    for _ in range(len(CLASSES) + 1):
        cache.sync_once(Feed())
        now[0] += 2
    result = http(cache).get("/api/notams?airport=KPAO").json()
    assert result["status"] == "partial" and result["incomplete_records"] == 1
    row = result["notams"][0]
    assert row["permanent"] and row["effective_end_utc"] is None
    assert row["type"] is None and row["text"] is None and row["severity"] is None
    assert row["effective_start_utc"] is None and row["activity"] == "source_incomplete"


def test_preview_is_explicit_and_full_text_available_in_detail(tmp_path):
    now = [BASE]
    cache = NMSCache(tmp_path, "staging", clock=lambda: now[0])
    text = "<script>source</script>" + "X" * 200000

    class Feed:
        environment = "staging"

        def features(self, params, **kwargs):
            return [feature(text=text)] if params.get("classification") == "DOMESTIC" else []

    for _ in range(len(CLASSES) + 1):
        cache.sync_once(Feed())
        now[0] += 2
    client = http(cache)
    row = client.get("/api/notams?airport=KPAO").json()["notams"][0]
    assert row["text_length"] == len(text) and len(row["text"]) == 2000 and row["text_truncated"]
    detail = client.get(row["detail_url"]).json()
    assert detail["notice"]["text"] == text and not detail["notice"]["text_truncated"]
    assert detail["source_feature"]["properties"]["coreNOTAMData"]["notam"]["text"] == text


@pytest.mark.parametrize(
    "query",
    [
        "airport=KPAO,,KSFO",
        "airport=KPAO%3Fsecret",
        "airport=KPAO&limit=101",
        "airport=KPAO&offset=-1",
        "airport=" + "A" * 9,
    ],
)
def test_request_bounds_and_error_cache_headers(source, query):
    client = http(source[0])
    response = client.get("/api/notams?" + query)
    assert response.status_code == 422 and response.headers["cache-control"] == "no-store"


def test_source_aliases_recover_notices_without_inventing_country_prefixes(tmp_path):
    now = [BASE]
    cache = NMSCache(tmp_path, "staging", clock=lambda: now[0])

    class Feed:
        environment = "staging"

        def features(self, params, **kwargs):
            return (
                [
                    feature("known"),
                    feature("without-icao", icaoLocation=None),
                    feature("unmapped", location="XYZ", icaoLocation=None),
                ]
                if params.get("classification") == "DOMESTIC"
                else []
            )

    for _ in range(len(CLASSES) + 1):
        cache.sync_once(Feed())
        now[0] += 2
    client = http(cache)
    assert client.get("/api/notams?airport=KPAO").json()["total"] == 2
    assert client.get("/api/notams?airport=KXYZ").json()["status"] == "no_reports"
    assert client.get("/api/notams?airport=XYZ").json()["total"] == 1


def test_corrupt_cache_is_explicitly_unavailable_and_does_not_leak_paths(tmp_path, monkeypatch):
    root = tmp_path / "private-dir"
    root.mkdir()
    (root / "notams.sqlite3").write_bytes(b"invalid secret-text")
    monkeypatch.setenv("FAA_NMS_ENVIRONMENT", "staging")
    monkeypatch.setenv("FAA_NMS_CACHE_DIR", str(root))
    response = http().get("/api/notams?airport=KPAO")
    assert response.status_code == 200 and response.json()["status"] == "unavailable"
    assert "secret-text" not in response.text and str(root) not in response.text


def test_pages_and_details_reject_changed_snapshots(source):
    cache, now, feed = source
    client = http(cache)
    first = client.get("/api/notams?airport=KPAO").json()
    assert (
        first["snapshot_id"]
        and client.get("/api/notams?airport=KPAO&snapshot_id=" + first["snapshot_id"]).status_code
        == 200
    )
    now[0] += 180
    assert cache.sync_once(feed)
    assert (
        client.get("/api/notams?airport=KPAO&snapshot_id=" + first["snapshot_id"]).status_code
        == 409
    )
    assert (
        client.get("/api/notams/detail?id=one&snapshot_id=" + first["snapshot_id"]).status_code
        == 409
    )


def test_web_reads_existing_cache_without_credentials_or_write_permissions(source, monkeypatch):
    cache, now, _ = source
    import app.routers.notams as nms_router

    monkeypatch.setattr(
        nms_router,
        "NMSCache",
        lambda root, environment, **kw: NMSCache(root, environment, clock=lambda: now[0], **kw),
    )
    monkeypatch.setenv("FAA_NMS_ENVIRONMENT", "staging")
    monkeypatch.setenv("FAA_NMS_CACHE_DIR", str(cache.root))
    monkeypatch.delenv("FAA_NMS_CLIENT_ID", raising=False)
    monkeypatch.delenv("FAA_NMS_CLIENT_SECRET", raising=False)
    cache.path.chmod(0o400)
    cache.root.chmod(0o500)
    before = cache.path.stat().st_mtime_ns
    try:
        result = http().get("/api/notams?airport=KPAO")
        assert result.status_code == 200 and result.json()["total"] == 1
        assert cache.path.stat().st_mode & 0o777 == 0o400
        assert cache.path.stat().st_mtime_ns == before
    finally:
        cache.root.chmod(0o700)
        cache.path.chmod(0o600)


def test_source_notice_reference_fields_are_preserved(source):
    cache, now, feed = source
    now[0] += 180
    feed.rows = [feature(number="04/123", series="A", year="2026")]
    # A new source version is required when the source reference is edited.
    feed.rows[0]["properties"]["coreNOTAMData"]["notam"]["lastUpdated"] = utc(now[0])
    feed.features = lambda params, **kwargs: deepcopy(feed.rows)
    cache.sync_once(feed)
    row = http(cache).get("/api/notams?airport=KPAO").json()["notams"][0]
    assert (row["number"], row["series"], row["year"]) == ("04/123", "A", "2026")
