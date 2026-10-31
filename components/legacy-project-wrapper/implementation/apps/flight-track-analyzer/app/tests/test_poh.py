import inspect
import io

import pytest
from fastapi.testclient import TestClient

from flightlab import poh
from flightlab.api import create_app
from tests.synth import Sim, foreflight_kml


@pytest.fixture(scope="module")
def kmls():
    out = []
    for seed, wf, wk in ((1, 240, 10), (2, 250, 8)):
        sim = Sim(wind_from=wf, wind_kt=wk, seed=seed, gps_alt=1.5).run_standard()
        out.append((sim, foreflight_kml(sim, name=f"N172KM sortie {seed}")))
    return out


@pytest.fixture()
def client(tmp_path, monkeypatch):
    monkeypatch.delenv("ANTHROPIC_API_KEY", raising=False)
    monkeypatch.delenv("KMLAB_LLM_BASE_URL", raising=False)
    return TestClient(create_app(str(tmp_path)))


def load(client, kmls):
    from datetime import datetime, timedelta, timezone

    ids = []
    for i, (sim, kml) in enumerate(kmls):
        kml = foreflight_kml(
            sim,
            t0=datetime(2025, 6, 14 + i, 17, tzinfo=timezone.utc),
            name=f"N172KM sortie {i}",
        )
        r = client.post(
            "/api/flights",
            data={"aircraft": "N172KM"},
            files=[("files", (f"f{i}.kml", io.BytesIO(kml), "text/xml"))],
        ).json()["results"][0]
        ids.append(r["id"])
    return ids


def test_tail_stored_and_listed(client, kmls):
    load(client, kmls)
    assert client.get("/api/flights").json()["flights"][0]["aircraft"] == "N172KM"
    assert client.get("/api/aircraft").json()["aircraft"] == [
        {"tail": "N172KM", "flights": 2, "has_poh": False}
    ]


def test_isa_and_altimeter_conditions():
    c = poh.conditions(1000.0, {})
    assert (
        c["pa_ft"] == 1000
        and c["oat_c"] == pytest.approx(13.02, abs=0.01)
        and c["da_ft"] == pytest.approx(1000, abs=1)
    )
    assert c["pa_assumed"] and c["oat_assumed"]
    c = poh.conditions(1000.0, {"altimeter_inhg": 29.42, "oat_c": 30})
    assert (
        c["pa_ft"] == pytest.approx(1500) and c["da_ft"] > 3000 and not c["pa_assumed"]
    )


def test_performance_altitude_uses_common_sdk():
    source = inspect.getsource(poh.conditions)
    assert "pressure_altitude(" in source
    assert "isa_temperature(" in source
    assert "density_altitude(" in source
    assert "29.92" not in source
    assert "120.0 *" not in source


def test_performance_rows_means_and_reported_wind(client, kmls):
    ids = load(client, kmls)
    for i in ids:  # reported wind 240/10 -> headwind on runway 27 about 8.7 kt
        assert (
            client.put(
                f"/api/flights/{i}/meta",
                json={
                    "aircraft": "n172km",
                    "oat_c": 20,
                    "weight_lb": 2300,
                    "wind_from_deg": 240,
                    "wind_kt": 10,
                },
            ).status_code
            == 200
        )
    ac = client.get("/api/performance").json()["aircraft"]
    assert len(ac) == 1 and ac[0]["aircraft"] == "N172KM" and ac[0]["flights"] == 2
    to = ac[0]["sections"]["takeoff"]
    assert len(to["rows"]) == 2 and to["mean"]["n"] == 2 and to["mean"]["flights"] == 2
    r = to["rows"][0]
    assert r["wind_source"] == "reported" and r["headwind_kt"] == pytest.approx(
        8.7, abs=0.6
    )
    assert (
        r["zw_total50_ft"] > r["total50_ft"]
    )  # headwind helped, so zero-wind distance is longer
    assert r["oat_c"] == 20 and r["weight_lb"] == 2300 and not r["oat_assumed"]
    ld = ac[0]["sections"]["landing"]
    assert len(ld["rows"]) == 2 and ld["rows"][0]["zw_total50_ft"] is not None
    assert ac[0]["sections"]["takeoff_rolling"] is None
    assert to["matrix"]["cells"][0]["n"] == 2


def test_poh_reference_interpolated_and_compared(client, kmls):
    ids = load(client, kmls)
    for i in ids:
        client.put(
            f"/api/flights/{i}/meta",
            json={
                "aircraft": "N172KM",
                "oat_c": 15,
                "wind_from_deg": 270,
                "wind_kt": 0,
            },
        )
    poh_body = {
        "takeoff": [
            {
                "pa_ft": p,
                "oat_c": t,
                "ground_roll_ft": 800 + 40 * p / 1000 + 5 * t,
                "total50_ft": 1400 + 60 * p / 1000 + 8 * t,
            }
            for p in (0, 2000, 4000)
            for t in (0, 20, 40)
        ],
        "landing": [],
    }
    assert client.put("/api/aircraft/N172KM/poh", json=poh_body).status_code == 200
    r = client.get("/api/performance?aircraft=N172KM").json()["aircraft"][0][
        "sections"
    ]["takeoff"]["rows"][0]
    # field is ~1084 ft, 15 C -> bilinear on an exactly linear table
    assert r["poh_total50_ft"] == pytest.approx(1400 + 60 * 1.084 + 8 * 15, rel=0.01)
    assert r["delta_total50_pct"] is not None and abs(r["delta_total50_pct"]) < 40
    assert client.get("/api/performance?aircraft=N172KM").json()["aircraft"][0][
        "sections"
    ]["takeoff"]["matrix"]["pa_axis"] == [0, 2000, 4000]


def test_no_extrapolation_outside_poh_table(client, kmls):
    ids = load(client, kmls)
    client.put(
        f"/api/flights/{ids[0]}/meta",
        json={"aircraft": "N172KM", "altimeter_inhg": 28.0, "oat_c": 15},
    )  # PA ~ 3000 ft
    body = {
        "takeoff": [
            {"pa_ft": p, "oat_c": t, "ground_roll_ft": 900, "total50_ft": 1500}
            for p in (0, 1000)
            for t in (0, 30)
        ],
        "landing": [],
    }
    client.put("/api/aircraft/N172KM/poh", json=body)
    rows = client.get("/api/performance").json()["aircraft"][0]["sections"]["takeoff"][
        "rows"
    ]
    hi = [r for r in rows if r["pa_ft"] > 2500][0]
    assert hi["poh_total50_ft"] is None and hi["delta_total50_pct"] is None


@pytest.mark.parametrize(
    "body",
    [
        {"aircraft": "N1", "oat_c": 200},
        {"aircraft": "bad tail!"},
        {"oat_c": 20},
        {"aircraft": "N1", "wind_kt": 10},
        {"aircraft": "N1", "altimeter_inhg": 5},
    ],
)
def test_meta_validation(client, kmls, body):
    fid = load(client, kmls)[0]
    assert client.put(f"/api/flights/{fid}/meta", json=body).status_code == 422


def test_poh_validation_and_traversal(client):
    assert (
        client.put(
            "/api/aircraft/N1/poh",
            json={"takeoff": [{"pa_ft": 0, "oat_c": 0, "ground_roll_ft": -5}]},
        ).status_code
        == 422
    )
    assert client.get("/api/aircraft/..%2F..%2Fx/poh").status_code in (404, 422)
    assert client.get("/api/aircraft/bad!tail/poh").status_code == 422
