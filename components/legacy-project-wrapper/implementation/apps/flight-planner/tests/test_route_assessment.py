from datetime import datetime, timezone
import pytest
from app.services import route_assessment as assessment


def route(start_alt=1000, end_alt=9000):
    return [
        dict(lat=0.0, lon=0.0, at="2026-11-16T10:00:00Z", altitude_ft_msl=start_alt),
        dict(lat=0.0, lon=1.0, at="2026-11-16T11:00:00Z", altitude_ft_msl=end_alt),
    ]


def candidate(**updates):
    value = dict(
        id="test",
        kind="airspace",
        name="test",
        geometry={
            "type": "Polygon",
            "coordinates": [[[0.2, -1], [0.8, -1], [0.8, 1], [0.2, 1], [0.2, -1]]],
        },
        window=None,
        floor=3000,
        ceiling=5000,
        notes=[],
        source={},
        raw={},
    )
    return {**value, **updates}


def test_climb_and_descent_are_clipped_at_actual_geometry_altitude_intervals():
    dense, _ = assessment.route_samples(route())
    hits, unknown, total = assessment.evaluate(dense, [candidate()], 0)
    assert not unknown and total == 1
    assert hits[0]["entry"]["altitude_ft_msl"] == pytest.approx(3000)
    assert hits[0]["exit"]["altitude_ft_msl"] == pytest.approx(5000)
    assert hits[0]["entry"]["at"] == "2026-11-16T10:15:00+00:00"
    assert hits[0]["exit"]["at"] == "2026-11-16T10:30:00+00:00"
    dense, _ = assessment.route_samples(route(9000, 1000))
    hits, _, _ = assessment.evaluate(dense, [candidate()], 0)
    assert hits[0]["entry"]["altitude_ft_msl"] == pytest.approx(5000)
    assert hits[0]["exit"]["altitude_ft_msl"] == pytest.approx(3000)


def test_advisory_activates_after_entry_before_exit_not_at_departure():
    dense, _ = assessment.route_samples(route(4000, 4000))
    start = datetime(2026, 11, 16, 10, 30, tzinfo=timezone.utc).timestamp()
    hits, _, _ = assessment.evaluate(
        dense, [candidate(window=(start, start + 600), kind="airsigmet")], 0
    )
    assert hits[0]["entry"]["at"] == "2026-11-16T10:30:00+00:00"
    assert hits[0]["exit"]["at"] == "2026-11-16T10:40:00+00:00"
    hits, _, _ = assessment.evaluate(
        dense, [candidate(window=(start + 7200, start + 8000), kind="airsigmet")], 0
    )
    assert not hits


def test_snapshot_outside_encounter_time_is_possible_not_absent():
    dense, _ = assessment.route_samples(route(4000, 4000))
    hits, _, _ = assessment.evaluate(
        dense, [candidate(window=(1, 1), kind="gairmet", notes=["snapshot"])], 0
    )
    assert hits and hits[0]["applicability"] == "possible"
    assert "Forecast snapshot" in hits[0]["uncertainties"][-1]


def test_variable_freezing_level_and_missing_weather_datum_are_not_zero():
    c = assessment.weather_candidate(
        {
            "coords": [{"lat": 0, "lon": 0}, {"lat": 0, "lon": 1}, {"lat": 1, "lon": 1}],
            "geom": "AREA",
            "base": "FZL",
            "top": "230",
            "validTime": "2026-11-16T15:00:00Z",
        },
        "gairmet",
        {},
    )
    assert c["floor"] is None
    assert c["raw"]["base"] == "FZL"
    assert c["notes"]


def test_partial_sources_and_missing_terrain_keep_coverage(monkeypatch):
    def unavailable(*a, **kw):
        raise assessment.data.DataUnavailable("provider offline")

    monkeypatch.setattr(assessment.sources, "weather_advisories", unavailable)
    monkeypatch.setattr(
        assessment.sources,
        "tfr_geometry",
        lambda: {
            "status": "available",
            "records": [{"summary": {"notam_id": "6/1234"}, "areas": []}],
            "sources": [{"provider": "FAA"}],
            "missing_geometry_ids": ["6/1234"],
        },
    )
    monkeypatch.setattr(
        assessment.sources,
        "obstacles",
        lambda *a, **kw: {
            "status": "no_records",
            "records": [],
            "source": {"provider": "FAA"},
            "truncated": False,
        },
    )
    monkeypatch.setattr(
        assessment.data,
        "airspace",
        lambda *a, **kw: {"features": [], "source": {"provider": "FAA"}},
    )
    monkeypatch.setattr(
        assessment.terrain_service,
        "profile_with_source",
        lambda points: ([(lat, lon, None) for lat, lon in points], {"provider": "test"}),
    )
    r = assessment.assess(route())
    assert len([s for s in r["sources"] if s["status"] == "unavailable"]) == 3
    assert r["unassessed"][0]["id"] == "tfr:6/1234"
    assert all(p["clearance_ft"] is None for p in r["terrain"])
    assert any("unknown" in gap for gap in r["coverage_gaps"])
    assert "safe" not in r


@pytest.mark.parametrize(
    "change",
    [
        {"at": "2026-11-16T10:00:00"},
        {"at": "2026-11-16T09:00:00Z"},
        {"lon": float("nan")},
        {"lat": 0.0, "lon": 0.0},
    ],
)
def test_bad_routes_rejected_before_sources(change):
    points = route()
    points[1].update(change)
    with pytest.raises(assessment.AssessmentError):
        assessment.route_samples(points)


def test_dateline_queries_split_without_transworld_envelope():
    points = [
        dict(lat=10.0, lon=179.0, altitude_ft_msl=5000.0, at="2026-11-16T10:00:00Z"),
        dict(lat=10.0, lon=-179.0, altitude_ft_msl=5000.0, at="2026-11-16T11:00:00Z"),
    ]
    dense, _ = assessment.route_samples(points)
    boxes = assessment.bounds_for_route(dense, 5)
    assert len(boxes) == 2
    assert sum(b[2] - b[0] for b in boxes) < 5


def test_corridor_proximity_is_distinct_from_centerline_contact():
    dense, _ = assessment.route_samples(route(4000, 4000))
    c = candidate(geometry={"type": "Point", "coordinates": [0.5, 0.01]})
    hits, _, _ = assessment.evaluate(dense, [c], 2)
    assert hits and all(h["mode"] == "proximity" for h in hits)
    hits, _, _ = assessment.evaluate(dense, [c], 0)
    assert not hits


def test_api_validation_and_capacity_release(monkeypatch):
    from fastapi import FastAPI
    from fastapi.testclient import TestClient
    import app.routers.route_assessment as api

    app = FastAPI()
    app.include_router(api.router, prefix="/api")
    client = TestClient(app)
    monkeypatch.setattr(
        api,
        "assess",
        lambda *a, **kw: (_ for _ in ()).throw(assessment.AssessmentError("fixture route error")),
    )
    assert client.post("/api/route-assessment", json={"waypoints": route()}).status_code == 422
    assert api._capacity.acquire(blocking=False)
    api._capacity.release()
    bad = route()
    bad[0]["at"] = "2026-11-16T10:00:00"
    assert client.post("/api/route-assessment", json={"waypoints": bad}).status_code == 422
    bad = route()
    bad[0]["lat"] = True
    assert client.post("/api/route-assessment", json={"waypoints": bad}).status_code == 422
    schema = app.openapi()
    assert schema["paths"]["/api/route-assessment"]["post"]["responses"]["200"]["content"][
        "application/json"
    ]["schema"]["$ref"].endswith("AssessmentResponse")


def test_repeated_profile_keeps_original_snapshot_time_and_different_profile_isolated(monkeypatch):
    import app.routers.route_assessment as api
    from app.services import ga_data

    ga_data._CACHE.clear()
    calls = []

    def snapshot(points, **kwargs):
        calls.append(points)
        return {"assessed_at_utc": str(len(calls))}

    monkeypatch.setattr(api, "assess", snapshot)
    first = api.AssessmentRequest(waypoints=route())
    assert api.route_assessment(first)["assessed_at_utc"] == "1"
    assert api.route_assessment(first)["assessed_at_utc"] == "1"
    different = route()
    different[1]["altitude_ft_msl"] = 7000
    assert (
        api.route_assessment(api.AssessmentRequest(waypoints=different))["assessed_at_utc"] == "2"
    )
    assert len(calls) == 2
    ga_data._CACHE.clear()


def test_composite_cache_loader_can_wait_for_another_worker_without_global_lock():
    from threading import Thread
    from app.services import ga_data

    result = []

    def load():
        thread = Thread(
            target=lambda: result.append(
                ga_data.cached(("worker-cache",), 60, lambda: {"value": 1})
            )
        )
        thread.start()
        thread.join(timeout=2)
        assert not thread.is_alive(), "Composite cache held a lock needed by its worker"
        return result[0]

    assert ga_data.cached(("composite-cache",), 60, load) == {"value": 1}


def test_concurrent_cache_misses_share_one_loader_and_failure_releases_key():
    from threading import Event
    from concurrent.futures import ThreadPoolExecutor
    from app.services import ga_data

    started, release = Event(), Event()
    calls = []

    def load():
        calls.append(1)
        started.set()
        assert release.wait(3)
        return {"value": 1}

    with ThreadPoolExecutor(max_workers=2) as pool:
        first = pool.submit(ga_data.cached, ("shared-miss",), 60, load)
        assert started.wait(2)
        second = pool.submit(ga_data.cached, ("shared-miss",), 60, load)
        release.set()
        assert first.result(timeout=2) == second.result(timeout=2) == {"value": 1}
    assert len(calls) == 1

    def fail():
        raise ga_data.DataUnavailable("fixture failure")

    with pytest.raises(ga_data.DataUnavailable):
        ga_data.cached(("failed-miss",), 60, fail)
    assert ga_data.cached(("failed-miss",), 60, lambda: {"recovered": True}) == {"recovered": True}


def test_wide_wgs84_source_edge_is_not_rejected_by_projection_shortcut():
    points = [
        dict(lat=50.1, lon=-100.0, altitude_ft_msl=4000.0, at="2026-11-16T10:00:00Z"),
        dict(lat=50.1, lon=-99.0, altitude_ft_msl=4000.0, at="2026-11-16T11:00:00Z"),
    ]
    geometry = {
        "type": "Polygon",
        "coordinates": [[[-160, 50], [-40, 50], [-40, 60], [-160, 60], [-160, 50]]],
    }
    dense, _ = assessment.route_samples(points)
    hits, unknown, total = assessment.evaluate(dense, [candidate(geometry=geometry)], 0)
    assert not unknown and total == 1
    assert hits[0]["entry"]["along_route_nm"] == pytest.approx(0)
    assert hits[0]["exit"]["along_route_nm"] == pytest.approx(dense[-1]["along_route_nm"])


def test_wrapped_polygon_hole_does_not_become_a_filled_dateline_encounter():
    points = [
        dict(lat=0.0, lon=179.6, altitude_ft_msl=4000.0, at="2026-11-16T10:00:00Z"),
        dict(lat=0.0, lon=-179.6, altitude_ft_msl=4000.0, at="2026-11-16T11:00:00Z"),
    ]
    geometry = {
        "type": "Polygon",
        "coordinates": [
            [[179, -1], [-179, -1], [-179, 1], [179, 1], [179, -1]],
            [[179.5, -0.5], [-179.5, -0.5], [-179.5, 0.5], [179.5, 0.5], [179.5, -0.5]],
        ],
    }
    dense, _ = assessment.route_samples(points)
    hits, unknown, total = assessment.evaluate(dense, [candidate(geometry=geometry)], 0)
    assert not unknown and not hits and total == 0


def test_geographic_pruning_matches_unpruned_clipping_and_reduces_off_route_work(monkeypatch):
    dense, _ = assessment.route_samples(route(4000, 4000))
    fixtures = [candidate(), candidate(id="hole", geometry={"type": "Polygon", "coordinates": [
        [[0.1,-1],[0.9,-1],[0.9,1],[0.1,1],[0.1,-1]],
        [[0.4,-0.5],[0.6,-0.5],[0.6,0.5],[0.4,0.5],[0.4,-0.5]],
    ]})]
    fixtures += [candidate(id=f"off-{i}", geometry={"type":"Point", "coordinates":[20+i/100,20]}) for i in range(100)]
    real_clip, real_tree = assessment.segment_geometry_intervals, assessment.STRtree
    real_batch = assessment.segments_geometry_intervals
    calls = []
    def clip(*args):
        calls.append(1)
        return real_clip(*args)
    def batch_clip(pairs, geometry):
        calls.extend([1] * len(pairs))
        return real_batch(pairs, geometry)
    monkeypatch.setattr(assessment, "segment_geometry_intervals", clip)
    monkeypatch.setattr(assessment, "segments_geometry_intervals", batch_clip)
    optimized = assessment.evaluate(dense, fixtures, 0)
    optimized_calls = len(calls)
    class AllGeographicSegments:
        def __init__(self, lines): self.tree, self.count = real_tree(lines), len(lines)
        def query(self, geometry, **kwargs):
            return self.tree.query(geometry, **kwargs) if kwargs.get("predicate") else range(self.count)
    monkeypatch.setattr(assessment, "STRtree", AllGeographicSegments)
    calls.clear()
    reference = assessment.evaluate(dense, fixtures, 0)
    assert optimized == reference
    assert optimized_calls < len(calls) / 10


def test_geographic_pruning_preserves_dateline_and_near_boundary_contacts(monkeypatch):
    cases = [
        ([dict(lat=0.,lon=179.5,at="2026-11-16T10:00:00Z",altitude_ft_msl=4000),
          dict(lat=0.,lon=-179.5,at="2026-11-16T11:00:00Z",altitude_ft_msl=4000)],
         {"type":"Polygon","coordinates":[[[179.7,-1],[-179.7,-1],[-179.7,1],[179.7,1],[179.7,-1]]]}),
        (route(4000,4000), {"type":"LineString","coordinates":[[0.5,0.00000000001],[0.5,1]]}),
    ]
    real_tree = assessment.STRtree
    class AllGeographicSegments:
        def __init__(self, lines): self.tree, self.count = real_tree(lines), len(lines)
        def query(self, geometry, **kwargs):
            return self.tree.query(geometry, **kwargs) if kwargs.get("predicate") else range(self.count)
    for points, geometry in cases:
        dense, _ = assessment.route_samples(points)
        item = candidate(geometry=geometry)
        monkeypatch.setattr(assessment, "STRtree", real_tree)
        optimized = assessment.evaluate(dense, [item], 0)
        monkeypatch.setattr(assessment, "STRtree", AllGeographicSegments)
        assert optimized == assessment.evaluate(dense, [item], 0)


def test_geographically_disjoint_malformed_ring_remains_unassessed():
    dense, _ = assessment.route_samples(route())
    malformed = candidate(geometry={"type":"Polygon","coordinates":[[[20,20],[21,20],[21,21],[20,21]]]})
    findings, unknown, _ = assessment.evaluate(dense, [malformed], 0)
    assert not findings and len(unknown) == 1
