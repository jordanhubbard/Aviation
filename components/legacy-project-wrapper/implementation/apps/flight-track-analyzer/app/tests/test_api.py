import io

import pytest
from fastapi.testclient import TestClient

from flightlab import llm
from flightlab.api import create_app
from tests.synth import Sim, foreflight_kml, garmin_kml


@pytest.fixture(scope="module")
def kmls():
    a = Sim(wind_from=240, wind_kt=10, seed=1, gps_alt=1.5).run_standard()
    b = Sim(wind_from=300, wind_kt=14, seed=2, gps_alt=1.5).run_standard()
    return foreflight_kml(a), garmin_kml(b)


@pytest.fixture()
def client(tmp_path, monkeypatch):
    for k in ("ANTHROPIC_API_KEY", "KMLAB_LLM_BASE_URL", "KMLAB_LLM_API_KEY"):
        monkeypatch.delenv(k, raising=False)
    return TestClient(create_app(str(tmp_path)))


def up(client, files, tail="N172KM"):
    return client.post("/api/flights", data={"aircraft": [tail] * len(files)},
                       files=[("files", (n, io.BytesIO(d), "application/vnd.google-earth.kml+xml")) for n, d in files])


def test_upload_list_get_delete_and_dedupe(client, kmls):
    ff, gm = kmls
    r = up(client, [("a.kml", ff), ("b.kml", gm), ("bad.kml", b"<nope")])
    res = {x["filename"]: x for x in r.json()["results"]}
    assert r.status_code == 200 and "error" in res["bad.kml"] and "error" not in res["a.kml"]
    assert res["a.kml"]["source"] == "foreflight" and res["b.kml"]["source"] == "garmin"
    again = up(client, [("a.kml", ff)]).json()["results"][0]
    assert again["duplicate"] is True
    flights = client.get("/api/flights").json()["flights"]
    assert len(flights) == 2
    fid = res["a.kml"]["id"]
    full = client.get(f"/api/flights/{fid}").json()
    assert len(full["series"]["t"]) > 100 and full["landings"] and full["patterns"]
    assert client.get(f"/api/flights/{fid}?target_agl_ft=900").json()["accuracy"]["pattern_altitude"]["target_ft"] == 900
    assert client.get(f"/api/flights/{fid}?target_agl_ft=5").status_code == 422
    assert client.get("/api/flights/../../etc/passwd").status_code in (404, 422)
    assert client.get("/api/flights/nothex").json() == {"error": "flight not found"}
    s = client.get("/api/summary").json()
    assert s["flights"] == 2 and s["runways"][0]["runway"] == "27"
    assert s["runways"][0]["takeoff"]["dist50_ft"]["n"] == 2
    assert client.delete(f"/api/flights/{fid}").status_code == 200
    assert len(client.get("/api/flights").json()["flights"]) == 1


def test_static_frontend_served(client):
    r = client.get("/")
    assert r.status_code == 200 and "<title>" in r.text


def test_llm_disabled_fails_closed(client, kmls):
    assert client.get("/api/capabilities").json() == {"llm": False, "provider": None, "model": None}
    fid = up(client, [("a.kml", kmls[0])]).json()["results"][0]["id"]
    assert client.post(f"/api/flights/{fid}/debrief", json={}).status_code == 404
    assert client.post("/api/ask", json={"question": "hi"}).status_code == 404


def test_llm_enabled_sends_digest_only(client, kmls, monkeypatch):
    monkeypatch.setenv("ANTHROPIC_API_KEY", "sk-test")
    seen = {}
    monkeypatch.setattr(llm, "complete", lambda system, user, max_tokens=1200: seen.update(user=user) or "Nice pattern work.")
    assert client.get("/api/capabilities").json()["llm"] is True
    fid = up(client, [("a.kml", kmls[0])]).json()["results"][0]["id"]
    r = client.post(f"/api/flights/{fid}/debrief", json={"focus": "landings"})
    assert r.status_code == 200 and r.json()["text"] == "Nice pattern work."
    assert "landings" in seen["user"] and "DIGEST" in seen["user"]
    assert '"lat"' not in seen["user"] and '"lon"' not in seen["user"] and "37.0" not in seen["user"]
    r = client.post("/api/ask", json={"question": "How steady was my downwind altitude?", "flight_ids": [fid]})
    assert r.status_code == 200 and "downwind" in seen["user"]


def test_oversize_batch_rejected(client):
    files = [("files", (f"{i}.kml", b"x", "text/xml")) for i in range(26)]
    assert client.post("/api/flights", files=files).status_code == 413


def test_help_viewer_shipped_and_llm_text_only_built_conditionally(client):
    assert 'id="help-btn"' in client.get("/").text
    js = client.get("/help.js").text
    assert "Hampel" in js and "caps && caps.llm" in js     # the AI section is gated on capabilities
    assert "LLM" not in client.get("/").text                # nothing LLM-related in the static page itself
