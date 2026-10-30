"""Airport MSL is a calibrated touchdown reference, not proof of contact."""
from types import SimpleNamespace

import numpy as np
import pytest

from flightlab import airports as airport_module
from flightlab.airports import AirportIndex, default_airports
from flightlab.events import detect
from flightlab.geo import M_TO_FT, from_enu
from flightlab.analyze import analyze
from flightlab.kml import parse_kml
from tests.synth import LAT0, LON0, Sim, foreflight_kml


def _airport(code, x, elevation_m):
    lat, lon = from_enu(x, 0, LAT0, LON0)
    return {"icao": code, "name": code, "latitude": float(lat), "longitude": float(lon),
            "elevation": elevation_m * M_TO_FT, "type": "small_airport"}


def _cross_country_track(*, missed_approach=False):
    t = np.arange(900, dtype=float)
    gs = np.piecewise(t, [t < 20, (t >= 20) & (t < 80), (t >= 80) & (t < 750),
                          (t >= 750) & (t < 840), (t >= 840) & (t < 860), t >= 860],
                         [0, 50, 60, 25, 10, 5])
    x = np.cumsum(gs)
    alt = np.interp(t, [0, 20, 80, 700, 840, 899],
                    [330, 330, 630, 630, 550 if missed_approach else 530,
                     650 if missed_approach else 530])
    lat, lon = from_enu(x, np.zeros_like(x), LAT0, LON0)
    return SimpleNamespace(t=t, t0=0.0, n=len(t), lat0=LAT0, lon0=LON0,
                           x=x, y=np.zeros_like(x), lat=lat, lon=lon, alt=alt,
                           gs=gs, vs=np.gradient(alt), acc=np.gradient(gs),
                           course=np.full_like(t, 90), valid=np.ones(len(t), bool))


def test_calibrated_airport_msl_finds_landing_without_destination_stop():
    tr = _cross_country_track()
    destination_x = tr.x[840]
    index = AirportIndex([_airport("AAAA", 0, 300), _airport("BBBB", destination_x, 500)])

    assert not detect(tr, AirportIndex([]))["landings"]
    result = detect(tr, index)
    assert len(result["landings"]) == 1
    landing = result["landings"][0]
    assert landing["kind"] == "landing"
    assert landing["airport_icao"] == "BBBB"
    assert landing["airport_elev_ft"] == pytest.approx(500 * M_TO_FT)
    assert landing["field_elev_source"] == "airport-msl"
    assert result["fields"][landing["field_id"]]["source"] == "airport-calibrated"


@pytest.mark.parametrize("records", [
    lambda x: [_airport("AAAA", 0, 300)],
    lambda x: [_airport("AAAA", 0, 300), {**_airport("BBBB", x, 500), "elevation": None}],
    lambda x: [_airport("AAAA", 0, 0), _airport("BBBB", x, 500)],
])
def test_missing_or_untrusted_airport_data_cannot_create_landing(records):
    tr = _cross_country_track()
    assert not detect(tr, AirportIndex(records(tr.x[840])))["landings"]


def test_approach_above_airport_is_not_touchdown():
    tr = _cross_country_track(missed_approach=True)
    index = AirportIndex([_airport("AAAA", 0, 300), _airport("BBBB", tr.x[840], 500)])
    assert not detect(tr, index)["landings"]


def test_airport_match_keeps_touch_and_go_classification():
    sim = Sim(seed=4, gps_alt=1.5).run_standard()
    index = AirportIndex([_airport("AAAA", 0, 300)])
    result = analyze(parse_kml(foreflight_kml(sim))[0], "airport-pattern", airport_index=index)
    assert [landing["kind"] for landing in result["landings"]] == ["touch_and_go", "touch_and_go", "landing"]
    assert all(landing["airport_icao"] == "AAAA" for landing in result["landings"])
    assert result["fields"][0]["elev_source"] == "airport-msl"


def test_aviation_bundled_airport_data_exposes_msl_elevation():
    index = default_airports()
    assert index is not None and len(index.airports) > 50_000
    sfo = index.nearest(37.619806, -122.374821)
    assert sfo["icao"] == "KSFO" and sfo["elevation_ft"] == pytest.approx(13)


def test_default_airports_consumes_shared_sdk_records(monkeypatch):
    records = [_airport("SDK1", 0, 300)]
    default_airports.cache_clear()
    monkeypatch.setattr(airport_module, "load_airport_cache", lambda: records)
    try:
        index = default_airports()
        assert index.airports[0]["icao"] == "SDK1"
    finally:
        default_airports.cache_clear()
