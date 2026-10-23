import io
import sqlite3
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from flightlab.api import create_app
from tests.synth import Sim, foreflight_kml


@pytest.fixture(scope="module")
def kml():
    return foreflight_kml(Sim(seed=1, gps_alt=1.5).run_standard())


@pytest.fixture()
def env(tmp_path, monkeypatch):
    monkeypatch.delenv("ANTHROPIC_API_KEY", raising=False)
    monkeypatch.delenv("KMLAB_LLM_BASE_URL", raising=False)
    return TestClient(create_app(str(tmp_path))), tmp_path


def post(client, files, tails=None):
    return client.post("/api/flights", data={"aircraft": tails} if tails is not None else None,
                       files=[("files", (n, io.BytesIO(d), "text/xml")) for n, d in files])


def rows(path, sql, *a):
    c = sqlite3.connect(Path(path) / "kmlab.sqlite3")
    try:
        return c.execute(sql, a).fetchall()
    finally:
        c.close()


@pytest.mark.parametrize("tails", [None, [], [""], ["   "], ["bad tail!"], ["TOOLONGTAIL12"], ["N1", "N2", "N3"]])
def test_upload_rejected_without_valid_tail_and_nothing_is_stored(env, kml, tails):
    client, root = env
    r = post(client, [("a.kml", kml)], tails)
    assert r.status_code == 422 and "tail" in r.json()["error"] and r.json()["files"] == ["a.kml"]
    assert client.get("/api/flights").json()["flights"] == []
    assert list((root / "raw").iterdir()) == []                      # rejected before anything was parsed or written
    assert rows(root, "SELECT count(*) FROM aircraft")[0][0] == 0


def test_one_tail_applies_to_all_files_and_distinct_tails_per_file(env, kml):
    client, root = env
    other = foreflight_kml(Sim(seed=2, wind_from=300, wind_kt=14, gps_alt=1.5).run_standard())
    r = post(client, [("a.kml", kml), ("b.kml", other)], ["n172km"])
    assert r.status_code == 200 and {x["aircraft"] for x in r.json()["results"]} == {"N172KM"}
    client.delete(f"/api/flights/{r.json()['results'][0]['id']}")
    client.delete(f"/api/flights/{r.json()['results'][1]['id']}")
    r = post(client, [("a.kml", kml), ("b.kml", other)], ["N1AA", "N2BB"])
    assert [x["aircraft"] for x in r.json()["results"]] == ["N1AA", "N2BB"]
    assert {t["tail"]: t["flights"] for t in client.get("/api/aircraft").json()["aircraft"]}["N1AA"] == 1
    assert client.get("/api/summary?aircraft=N2BB").json()["flights"] == 1
    assert client.get("/api/summary").json()["flights"] == 2


def test_every_table_has_tail_as_leading_primary_key_column(env):
    _, root = env
    tables = [r[0] for r in rows(root, "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'")]
    assert {"aircraft", "flights", "flight_conditions", "events", "patterns", "poh_reference", "poh_meta"} <= set(tables)
    for t in tables:
        info = rows(root, f"PRAGMA table_info({t})")
        pk = sorted((r[5], r[1]) for r in info if r[5] > 0)
        assert pk and pk[0][1] == "tail", f"{t}: primary key must start with tail, got {pk}"
        assert any(r[1] == "tail" and r[3] == 1 for r in info), f"{t}.tail must be NOT NULL"


def test_events_and_patterns_rows_keyed_by_tail_and_follow_retag_and_delete(env, kml):
    client, root = env
    fid = post(client, [("a.kml", kml)], ["N172KM"]).json()["results"][0]["id"]
    assert rows(root, "SELECT DISTINCT tail FROM events WHERE flight_id=?", fid) == [("N172KM",)]
    assert rows(root, "SELECT count(*) FROM events WHERE kind='takeoff'")[0][0] == 3
    assert rows(root, "SELECT count(*) FROM events WHERE kind='landing'")[0][0] == 3
    assert rows(root, "SELECT count(*) FROM patterns")[0][0] == 3
    assert client.put(f"/api/flights/{fid}/meta", json={"aircraft": "N999ZZ", "oat_c": 20}).status_code == 200      # re-tag
    for t in ("flights", "flight_conditions", "events", "patterns"):
        assert {r[0] for r in rows(root, f"SELECT tail FROM {t}")} == {"N999ZZ"}, t
    assert client.get("/api/performance?aircraft=N999ZZ").json()["aircraft"][0]["flights"] == 1
    assert client.get("/api/performance?aircraft=N172KM").json()["aircraft"] == []
    assert client.delete(f"/api/flights/{fid}").status_code == 200
    for t in ("flights", "flight_conditions", "events", "patterns"):
        assert rows(root, f"SELECT count(*) FROM {t}")[0][0] == 0, t


def test_reupload_with_different_tail_moves_the_flight(env, kml):
    client, root = env
    a = post(client, [("a.kml", kml)], ["N1AA"]).json()["results"][0]
    b = post(client, [("a.kml", kml)], ["N2BB"]).json()["results"][0]
    assert b["duplicate"] is True and a["id"] == b["id"]
    assert rows(root, "SELECT tail FROM flights") == [("N2BB",)]
    assert rows(root, "SELECT DISTINCT tail FROM events") == [("N2BB",)]


def test_meta_cannot_clear_the_tail(env, kml):
    client, _ = env
    fid = post(client, [("a.kml", kml)], ["N1AA"]).json()["results"][0]["id"]
    assert client.put(f"/api/flights/{fid}/meta", json={"aircraft": None, "oat_c": 10}).status_code == 422
    assert client.put(f"/api/flights/{fid}/meta", json={"aircraft": "", "oat_c": 10}).status_code == 422


def test_poh_reference_rows_keyed_by_tail(env, kml):
    client, root = env
    post(client, [("a.kml", kml)], ["N1AA"])
    body = {"takeoff": [{"pa_ft": 0, "oat_c": 15, "ground_roll_ft": 800, "total50_ft": 1400}], "landing": [], "weight_lb": 2300}
    assert client.put("/api/aircraft/n1aa/poh", json=body).status_code == 200
    assert rows(root, "SELECT tail, type, pa_ft FROM poh_reference") == [("N1AA", "takeoff", 0.0)]
    assert client.get("/api/aircraft/N1AA/poh").json()["weight_lb"] == 2300
    assert client.get("/api/aircraft").json()["aircraft"][0]["has_poh"] is True
