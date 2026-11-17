"""Feed coverage, restart/concurrency/cadence and source lifecycle acceptance."""

from concurrent.futures import ThreadPoolExecutor
from copy import deepcopy
import gzip
import json
import multiprocessing
import sqlite3

import httpx
import pytest

from app.services.nms_client import NMSClient, NMSUnavailable, decode_features
from app.services.nms_cache import NMSCache, CLASSES, DAY, LEASE, activity, instant, normalize, utc

BASE = instant("2026-11-16T12:00:00Z")


def feature(identifier="one", *, modified=BASE, start=BASE - 100, end=BASE + DAY, **updates):
    n = dict(
        id=identifier,
        text="RWY 01 CLOSED",
        location="PAO",
        icaoLocation="KPAO",
        classification="DOM",
        type="N",
        effectiveStart=utc(start),
        effectiveEnd=utc(end),
        lastUpdated=utc(modified),
    )
    n.update(updates)
    return {"type": "Feature", "properties": {"coreNOTAMData": {"notam": n}}, "geometry": None}


class Feed:
    environment = "production"

    def __init__(self, now):
        self.now, self.calls, self.fail = now, [], None
        self.rows = [feature()]

    def features(self, params, **kwargs):
        self.calls.append(params)
        if self.fail:
            raise self.fail
        return (
            deepcopy(self.rows)
            if params.get("classification") == "DOMESTIC" or "lastUpdatedDate" in params
            else []
        )


def bootstrap(cache, feed, now):
    for classification in CLASSES:
        assert cache.sync_once(feed)
        assert feed.calls[-1] == {"classification": classification}
        assert not cache.query()["complete_snapshot"]
        now[0] += 180
    assert cache.sync_once(feed)
    result = cache.query(["KPAO"])
    assert result["complete_snapshot"] and result["status"] == "available"
    return result


def test_full_coverage_is_atomic_and_delta_uses_overlapping_request_start(tmp_path):
    now = [BASE]
    cache = NMSCache(tmp_path, "production", clock=lambda: now[0])
    feed = Feed(now)
    result = bootstrap(cache, feed, now)
    assert result["total"] == 1
    assert feed.calls[-1] == {"lastUpdatedDate": utc(BASE - 60)}
    assert not cache.sync_once(feed)
    now[0] += 180
    feed.rows = [feature(modified=now[0], text="RWY 01 OPEN")]
    assert cache.sync_once(feed)
    assert feed.calls[-1] == {"lastUpdatedDate": utc(now[0] - 180 - 60)}
    assert cache.query(["pao"])["notams"][0]["text"] == "RWY 01 OPEN"


def test_new_daily_full_failure_preserves_old_snapshot_and_counts_failed_attempt(tmp_path):
    now = [BASE]
    cache = NMSCache(tmp_path, "production", clock=lambda: now[0])
    feed = Feed(now)
    feed.rows = [feature(end=BASE + 3 * DAY)]
    bootstrap(cache, feed, now)
    now[0] = BASE + DAY
    feed.fail = NMSUnavailable("sensitive untrusted upstream text", status=429, retry_after=600)
    with pytest.raises(NMSUnavailable):
        cache.sync_once(feed)
    status = cache.query()
    assert status["status"] == "stale" and status["total"] == 1
    assert "sensitive" not in status["last_error"]
    restored = NMSCache(tmp_path, "production", clock=lambda: now[0])
    assert not restored.sync_once(feed)
    now[0] += 600
    feed.fail = None
    assert restored.sync_once(feed)
    assert feed.calls[-1] == {"classification": "FDC"}
    assert restored.query()["total"] == 1


def reserve_process(path, now, queue):
    queue.put(NMSCache(path, "production", clock=lambda: now).reserve())


def test_process_reservation_is_shared_and_crash_lease_does_not_repeat_full_class(tmp_path):
    NMSCache(tmp_path, "production")
    context = multiprocessing.get_context("spawn")
    queue = context.Queue()
    children = [
        context.Process(target=reserve_process, args=(str(tmp_path), BASE, queue)) for _ in range(3)
    ]
    for child in children:
        child.start()
    tickets = [queue.get(timeout=20) for _ in children]
    for child in children:
        child.join(timeout=20)
        assert child.exitcode == 0
    assert sum(t is not None for t in tickets) == 1
    now = [BASE + LEASE + 1]
    cache = NMSCache(tmp_path, "production", clock=lambda: now[0])
    ticket = cache.reserve()
    assert ticket["classification"] == "FDC"
    old = next(t for t in tickets if t)
    with pytest.raises(NMSUnavailable, match="lease"):
        cache.finish(old, [feature()])
    cache.finish(ticket, [])
    queue.close()


def test_thread_reservation_cadence_survives_restart(tmp_path):
    now = [BASE]
    cache = NMSCache(tmp_path, "production", clock=lambda: now[0])
    with ThreadPoolExecutor(max_workers=4) as pool:
        tickets = list(pool.map(lambda _: cache.reserve(), range(8)))
    ticket = next(t for t in tickets if t)
    assert sum(t is not None for t in tickets) == 1
    cache.finish(ticket, [])
    restored = NMSCache(tmp_path, "production", clock=lambda: now[0])
    now[0] += 179
    assert restored.reserve() is None
    now[0] += 1
    assert restored.reserve()["classification"] == "FDC"


def test_local_expiry_cancellation_future_schedule_unknown_end_and_permanence():
    row = normalize(feature())
    assert activity(row, BASE) == "effective"
    assert activity(row, BASE + DAY) == "expired"
    assert activity(normalize(feature(start=BASE + 5)), BASE) == "scheduled"
    assert activity(normalize(feature(cancelationDate=utc(BASE))), BASE) == "cancelled"
    assert activity(normalize(feature(type="C")), BASE) == "cancelled"
    assert (
        activity(normalize(feature(schedule="DLY 0900-1500")), BASE) == "schedule_requires_review"
    )
    assert activity(normalize(feature(effectiveEnd=None)), BASE) == "unknown_end"
    assert activity(normalize(feature(effectiveEnd="PERM")), BASE + 5 * DAY) == "effective"


def test_expiry_and_cancel_updates_are_not_returned_as_active_even_without_refresh(tmp_path):
    now = [BASE]
    cache = NMSCache(tmp_path, "production", clock=lambda: now[0])
    feed = Feed(now)
    bootstrap(cache, feed, now)
    now[0] += 180
    feed.rows = [feature(modified=now[0], cancelationDate=utc(now[0]))]
    cache.sync_once(feed)
    assert cache.query()["total"] == 0
    assert cache.query(include_inactive=True)["notams"][0]["activity"] == "cancelled"
    now[0] += 180
    feed.rows = [feature("expiring", modified=now[0], end=now[0] + 5)]
    cache.sync_once(feed)
    assert cache.query()["total"] == 1
    now[0] += 5
    assert cache.query()["total"] == 0
    assert cache.query(include_inactive=True)["total"] == 2


def test_overlap_cannot_restore_old_cancelled_records_and_conflicts_do_not_advance(tmp_path):
    now = [BASE]
    cache = NMSCache(tmp_path, "production", clock=lambda: now[0])
    feed = Feed(now)
    bootstrap(cache, feed, now)
    now[0] += 180
    feed.rows = [feature(modified=now[0], cancelationDate=utc(now[0]))]
    cache.sync_once(feed)
    watermark = cache.query()["synchronized_at"]
    now[0] += 180
    feed.rows = [feature(modified=BASE)]
    cache.sync_once(feed)
    assert cache.query()["total"] == 0
    now[0] += 180
    feed.rows = [feature(modified=BASE + 1080, text="CONFLICT")]
    before = cache.query()["synchronized_at"]
    with pytest.raises(NMSUnavailable):
        cache.sync_once(feed)
    assert cache.query()["synchronized_at"] == before
    assert cache.query()["total"] == 0


def test_invalid_collection_is_not_admitted_or_treated_as_empty_coverage(tmp_path):
    now = [BASE]
    cache = NMSCache(tmp_path, "production", clock=lambda: now[0])
    feed = Feed(now)
    bootstrap(cache, feed, now)
    now[0] += 180
    feed.rows = [feature("new"), {"type": "Feature"}]
    with pytest.raises(NMSUnavailable):
        cache.sync_once(feed)
    assert cache.query()["total"] == 1
    assert cache.query()["notams"][0]["id"] == "one"


def test_environment_schema_and_page_boundaries(tmp_path):
    cache = NMSCache(tmp_path, "staging")
    assert cache.query()["production_data"] is False
    assert any("test NOTAMs" in s for s in cache.query()["limitations"])
    with pytest.raises(ValueError, match="mix"):
        NMSCache(tmp_path, "production")
    with pytest.raises(ValueError):
        cache.query(limit=201)
    with pytest.raises(ValueError):
        cache.query(["KPAO?bad"])
    with sqlite3.connect(cache.path) as db:
        db.execute("PRAGMA user_version=100")
    with pytest.raises(ValueError, match="schema"):
        NMSCache(tmp_path, "staging")


def test_originals_are_hashed_atomic_and_corruption_is_not_silently_overwritten(tmp_path):
    cache = NMSCache(tmp_path, "staging")
    raw = gzip.compress(json.dumps([feature()]).encode())
    digest = cache.archive(raw)
    assert cache.archive(raw) == digest
    path = tmp_path / "originals" / (digest + ".bin")
    assert path.stat().st_mode & 0o777 == 0o600
    path.write_bytes(b"corrupt")
    with pytest.raises(NMSUnavailable, match="integrity"):
        cache.archive(raw)
    assert path.read_bytes() == b"corrupt"


@pytest.mark.parametrize(
    "payload",
    [
        [feature()],
        {"type": "FeatureCollection", "features": [feature()]},
        {"status": "Success", "data": {"geojson": [feature()]}},
    ],
)
def test_compressed_bulk_geojson_contract(payload):
    raw = json.dumps(payload).encode()
    assert decode_features(raw) == [feature()]
    assert decode_features(gzip.compress(raw)) == [feature()]
    with pytest.raises(NMSUnavailable):
        decode_features(gzip.compress(raw)[:-1])
    with pytest.raises(NMSUnavailable):
        decode_features(gzip.compress(raw) + gzip.compress(raw))


def test_content_bearer_is_sent_only_to_validated_same_origin_and_original_is_retained():
    raw = gzip.compress(json.dumps({"type": "FeatureCollection", "features": [feature()]}).encode())
    seen, archived = [], []

    def handler(request):
        seen.append(request)
        assert request.url.host == "api-staging.cgifederal-aim.com"
        if request.method == "POST":
            return httpx.Response(200, json={"access_token": "fixture-bearer", "expires_in": 1799})
        assert request.headers["authorization"] == "Bearer fixture-bearer"
        if request.url.path.endswith("/notams"):
            assert request.url.params["allowRedirect"] == "false"
            return httpx.Response(
                200, json={"status": "Success", "data": {"url": "/nmsapi/v1/content/opaque"}}
            )
        assert request.url.path == "/nmsapi/v1/content/opaque"
        return httpx.Response(200, content=raw)

    c = NMSClient(
        "staging",
        "fixture-key",
        "fixture-secret",
        transport=httpx.MockTransport(handler),
        pause=lambda _: None,
    )
    assert c.features({"classification": "DOMESTIC"}, archive=archived.append) == [feature()]
    assert archived == [raw] and len(seen) == 3
    c.close()


def test_missing_source_type_stays_unknown_and_is_visible(tmp_path):
    now = [BASE]
    cache = NMSCache(tmp_path, "production", clock=lambda: now[0])
    feed = Feed(now)
    feed.rows = [feature(type=None, icaoLocation=None)]
    for _ in range(len(CLASSES) + 1):
        assert cache.sync_once(feed)
        now[0] += 180
    row = cache.query(["PAO"])["notams"][0]
    assert row["type"] is None and row["activity"] == "unknown_type"
    assert cache.query(["KPAO"])["total"] == 0


def test_replay_retained_original_uses_existing_receipt_without_new_pull(tmp_path, monkeypatch):
    import app.services.nms_cache as module

    now = [BASE]
    cache = NMSCache(tmp_path, "production", clock=lambda: now[0])
    raw = gzip.compress(json.dumps([feature()]).encode())

    class ArchivedFeed(Feed):
        def features(self, params, archive):
            self.calls.append(params)
            archive(raw)
            return [feature()]

    feed = ArchivedFeed(now)

    def rejected(_):
        raise NMSUnavailable("prior parser rejected a valid source omission")

    with monkeypatch.context() as m:
        m.setattr(module, "normalize", rejected)
        with pytest.raises(NMSUnavailable):
            cache.sync_once(feed)
    assert len(feed.calls) == 1 and cache.query()["building_classes"] == []
    digest = next((tmp_path / "originals").glob("*.bin")).stem
    now[0] += 10
    cache.replay_full("DOMESTIC", digest)
    assert cache.query()["building_classes"] == ["DOMESTIC"]
    assert not cache.query()["complete_snapshot"]
    assert len(feed.calls) == 1 and cache.reserve() is None
    with cache.connection() as db:
        s = cache._state(db)
        assert s["last_attempt"] == BASE and s["full_started"] == BASE
    with pytest.raises(NMSUnavailable):
        cache.replay_full("DOMESTIC", digest)


def test_pagination_counts_before_limit_and_filters_unknown_type(tmp_path):
    now = [BASE]
    cache = NMSCache(tmp_path, "production", clock=lambda: now[0])
    feed = Feed(now)
    feed.rows = [
        feature("a"),
        feature("b", type=None),
        feature("c"),
        feature("other", location="SFO", icaoLocation="KSFO"),
    ]
    for _ in range(len(CLASSES) + 1):
        cache.sync_once(feed)
        now[0] += 180
    result = cache.query(["KPAO"], offset=1, limit=1)
    assert result["total"] == 3 and [r["id"] for r in result["notams"]] == ["b"]
    assert result["notams"][0]["activity"] == "unknown_type"


def test_true_empty_complete_snapshot_is_distinct_from_uninitialized(tmp_path):
    now = [BASE]
    cache = NMSCache(tmp_path, "production", clock=lambda: now[0])
    assert cache.query()["status"] == "unavailable"
    feed = Feed(now)
    feed.rows = []
    for _ in range(len(CLASSES) + 1):
        cache.sync_once(feed)
        now[0] += 180
    result = cache.query()
    assert result["status"] == "available" and result["complete_snapshot"] and result["total"] == 0


def test_source_omissions_are_flagged_and_long_notices_are_lossless(tmp_path):
    now = [BASE]
    cache = NMSCache(tmp_path, "production", clock=lambda: now[0])
    feed = Feed(now)
    incomplete = feature(effectiveStart=None, text=None)
    feed.rows = [incomplete, feature("long", text="X" * 200000)]
    for _ in range(len(CLASSES) + 1):
        cache.sync_once(feed)
        now[0] += 180
    result = cache.query(["KPAO"])
    assert result["status"] == "partial" and result["incomplete_records"] == 1
    by_id = {r["id"]: r for r in result["notams"]}
    assert by_id["one"]["activity"] == "source_incomplete"
    assert by_id["one"]["missing_fields"] == ["text", "effective_start"]
    assert by_id["one"]["text"] is None and by_id["one"]["effective_start"] is None
    assert len(by_id["long"]["text"]) == 200000
    with pytest.raises(NMSUnavailable):
        normalize(feature(text="X" * (1024 * 1024 + 1)))


def test_nonfinite_source_json_is_never_admitted():
    with pytest.raises(NMSUnavailable):
        decode_features(b'[{"type":"Feature","geometry":{"coordinates":[NaN,0]}}]')


@pytest.mark.parametrize(
    "metadata", [{"truncated": True}, {"numberMatched": 2}, {"totalFeatures": 2}]
)
def test_bulk_declared_partial_coverage_is_not_a_complete_snapshot(metadata):
    raw = json.dumps({"type": "FeatureCollection", "features": [feature()], **metadata}).encode()
    with pytest.raises(NMSUnavailable, match="incomplete"):
        decode_features(raw)


def test_inline_empty_response_retains_the_actual_provider_envelope():
    raw = b'{"status":"Success","data":{"geojson":[]}}'
    archived = []
    c = NMSClient(
        "staging",
        "fixture-key",
        "fixture-secret",
        pause=lambda _: None,
        transport=httpx.MockTransport(
            lambda r: (
                httpx.Response(200, json={"access_token": "fixture-token", "expires_in": 1799})
                if r.method == "POST"
                else httpx.Response(200, content=raw)
            )
        ),
    )
    try:
        assert c.features({"classification": "LOCAL_MILITARY"}, archive=archived.append) == []
        assert archived == [raw]
    finally:
        c.close()
