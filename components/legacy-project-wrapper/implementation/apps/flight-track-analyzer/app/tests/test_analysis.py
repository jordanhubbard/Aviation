import numpy as np
import pytest

from flightlab.analyze import analyze
from flightlab.kml import KmlError, parse_kml
from tests.synth import KT, Sim, foreflight_kml, garmin_kml, run_xc

FT = 3.28084


@pytest.fixture(scope="module")
def pattern_flight():
    sim = Sim(wind_from=240, wind_kt=10, seed=1, gps_alt=1.5).run_standard()
    return sim, analyze(parse_kml(foreflight_kml(sim))[0], "t-0")


def test_foreflight_events_recovered(pattern_flight):
    sim, a = pattern_flight
    kinds = [t["kind"] for t in a["takeoffs"]]
    assert kinds == ["takeoff", "touch_and_go", "touch_and_go"]
    assert [l["kind"] for l in a["landings"]] == ["touch_and_go", "touch_and_go", "landing"]
    assert not a["go_arounds"]
    assert all(t["runway"] == "27" for t in a["takeoffs"] + a["landings"])


def test_distances_within_15_percent(pattern_flight):
    sim, a = pattern_flight
    t, tt = a["takeoffs"][0], sim.truth["takeoffs"][0]
    assert t["ground_roll_ft"] == pytest.approx(tt["ground_roll_m"] * FT, rel=0.15)
    assert t["dist50_ft"] == pytest.approx(tt["dist50_m"] * FT, rel=0.15)
    l, tl = a["landings"][-1], sim.truth["landings"][-1]
    assert l["dist50_ft"] == pytest.approx(tl["dist50_m"] * FT, rel=0.15)
    # touchdown timing is GPS-limited: the roll must agree within the event's own stated uncertainty
    assert abs(l["roll_ft"] - tl["roll_m"] * FT) <= l["timing_uncertainty_ft"] * 1.5


def test_pattern_geometry(pattern_flight):
    sim, a = pattern_flight
    assert len(a["patterns"]) == 3
    for p, lap in zip(a["patterns"], sim.truth["laps"]):
        assert p["side"] == "left" and not p["straight_in"]
        assert set(p["legs"]) >= {"upwind", "crosswind", "downwind", "base", "final"}
        assert p["legs"]["downwind"]["agl_ft"] == pytest.approx(lap["agl_target_m"] * FT, abs=100)
        assert 2.0 < p["final"]["glidepath_deg"] < 4.5
    assert a["accuracy"]["pattern_altitude"]["target_is_default"]


def test_pattern_target_param_gives_signed_error(pattern_flight):
    sim, _ = pattern_flight
    a = analyze(parse_kml(foreflight_kml(sim))[0], "t-0", target_agl_ft=900)
    errs = [p["agl_error_ft"] for p in a["patterns"]]
    assert all(e > 0 for e in errs) and a["accuracy"]["pattern_altitude"]["target_ft"] == 900


def test_accuracy_metrics_sane(pattern_flight):
    _, a = pattern_flight
    ah = a["accuracy"]["altitude_hold"]
    assert ah["rms_ft"] < 40 and ah["within_100ft_pct"] > 90
    assert a["accuracy"]["airspeed_hold"]["level"]["std_kt"] < 6
    assert a["accuracy"]["touchdown_repeatability"][0]["n"] == 3


def test_pattern_wind_is_graded_low_and_not_normalised(pattern_flight):
    _, a = pattern_flight
    assert a["wind"]["confidence"] == "low"
    assert not any("zero_wind_roll_ft" in t for t in a["takeoffs"])
    assert any("approximate" in w for w in a["warnings"])


def test_cross_country_wind_high_confidence():
    sim = run_xc(Sim(wind_from=240, wind_kt=12, seed=3, gps_alt=1.5))
    a = analyze(parse_kml(foreflight_kml(sim))[0], "xc-0")
    w = a["wind"]
    assert w["confidence"] == "high"
    assert w["speed_kt"] == pytest.approx(12, abs=3)
    assert abs(((w["from_deg"] - 240 + 180) % 360) - 180) < 8
    assert w["tas_kt"] == pytest.approx(55 / KT, rel=0.03)
    assert "zero_wind_roll_ft" in a["takeoffs"][0]
    assert a["performance"]["cruise"]["mean_speed_kt"] == pytest.approx(55 / KT, rel=0.05)
    assert a["performance"]["climb"]["mean_rate_fpm"] == pytest.approx(3.5 * FT * 60, rel=0.15)


def test_garmin_point_placemarks():
    sim = Sim(wind_from=300, wind_kt=14, seed=2, gps_alt=1.5).run_standard()
    tr = parse_kml(garmin_kml(sim))
    assert tr[0].source == "garmin" and "speed" in tr[0].extras
    a = analyze(tr[0], "g-0")
    assert a["recorded"]["speed_unit"] == "kt"
    assert len(a["landings"]) == 3 and a["takeoffs"][0]["kind"] == "takeoff"


def test_foreflight_recorded_speed_unit_inferred(pattern_flight):
    _, a = pattern_flight
    assert a["recorded"]["speed_unit"] == "mps"


def test_linestring_timespan_is_accepted_with_warning():
    kml = b"""<kml xmlns="http://www.opengis.net/kml/2.2"><Placemark><name>x</name>
    <TimeSpan><begin>2025-01-01T10:00:00Z</begin><end>2025-01-01T10:01:00Z</end></TimeSpan>
    <LineString><coordinates>""" + b" ".join(f"-122.{i:03d},37.0,100".encode() for i in range(20)) + b"""</coordinates></LineString></Placemark></kml>"""
    t = parse_kml(kml)
    assert len(t[0].t) == 20 and any("interpolated" in w for w in t[0].warnings)


@pytest.mark.parametrize("payload", [
    b"not xml at all",
    b'<?xml version="1.0"?><!DOCTYPE x [<!ENTITY a "aaaa"><!ENTITY b "&a;&a;&a;">]><kml>&b;</kml>',
    b'<?xml version="1.0"?><!DOCTYPE x [<!ENTITY e SYSTEM "file:///etc/passwd">]><kml>&e;</kml>',
    b'<kml xmlns="http://www.opengis.net/kml/2.2"><Document/></kml>',
    b'<html/>',
])
def test_hostile_or_trackless_input_rejected(payload):
    with pytest.raises(KmlError):
        parse_kml(payload)


def test_spike_samples_rejected():
    sim = Sim(seed=5, gps_alt=1.5).run_standard()
    kml = foreflight_kml(sim)
    raw = parse_kml(kml)[0]
    raw.lat[300] += 0.5          # ~55 km teleport
    raw.alt_m[500] += 900
    a = analyze(raw, "s-0")
    assert a["quality"]["rejected_samples"] >= 2
    assert a["performance"]["max_alt_ft"] < 5000


def test_takeoff_and_landing_types(pattern_flight):
    _, a = pattern_flight
    assert [t["style"] for t in a["takeoffs"]] == ["standing", "touch_and_go", "touch_and_go"]
    assert [l["type"] for l in a["landings"]] == ["touch_and_go", "touch_and_go", "full_stop"]


def test_rolling_takeoff_is_classified_and_kept_out_of_standing_stats():
    sim = Sim(wind_from=240, wind_kt=10, seed=4, gps_alt=1.5).run_standard(rolling=True)
    a = analyze(parse_kml(foreflight_kml(sim))[0], "r-0")
    t = a["takeoffs"][0]
    assert t["kind"] == "takeoff" and t["style"] == "rolling" and t["roll_entry_gs_kt"] > 8
    assert "zero_wind_roll_ft" not in t
    from flightlab import aggregate
    s = aggregate.summarize([a])
    assert s["counts"]["takeoff_style"]["rolling"] == 1
    assert s["runways"][0]["takeoff_rolling"]["dist50_ft"]["n"] == 1
    assert s["runways"][0]["takeoff"]["dist50_ft"] is None


def test_stop_and_go_detected():
    sim = Sim(seed=6, gps_alt=1.5)
    sim.hold(60); sim.taxi_to_runway(); sim.takeoff_roll()
    sim.circuit(305.0, 200.0, 45.0, full_stop=True)
    sim.hold(20)
    sim.leg = "takeoff_roll"
    sim.takeoff_roll(record_truth=False)
    sim.circuit(305.0, 200.0, 45.0, full_stop=True)
    a = analyze(parse_kml(foreflight_kml(sim))[0], "sg-0")
    assert [l["type"] for l in a["landings"]] == ["stop_and_go", "full_stop"]
    assert a["takeoffs"][1]["style"] == "stop_and_go"


def test_summary_survives_runway_with_only_rolling_takeoff():
    from flightlab import aggregate
    sim2 = Sim(seed=9, gps_alt=1.5)
    sim2.hold(60); sim2.taxi_to_runway(rolling=True); sim2.takeoff_roll()
    # airborne-only log after a rolling start: one runway, one rolling take-off, no landing
    while sim2.agl < 300:
        sim2.step(0.25, trk_tgt=270.0, tas_tgt=38.0, vs_tgt=3.5)
    a = analyze(parse_kml(foreflight_kml(sim2))[0], "ro-0")
    assert a["takeoffs"][0]["style"] == "rolling" and not a["landings"]
    s = aggregate.summarize([a])
    assert s["runways"][0]["takeoff_rolling"]["dist50_ft"]["n"] == 1


def test_wind_fit_start_inside_bounds_for_fast_one_way_flight():
    import numpy as np
    from flightlab import wind
    rng = np.random.default_rng(0)
    th = np.radians(80 + rng.normal(0, 25, 300))           # mostly eastbound at 75 m/s ground speed
    vx, vy = 75 * np.sin(th), 75 * np.cos(th)
    we, wn, tas, rms = wind._circle(vx, vy)                 # used to raise: initial guess outside bounds
    assert 10 <= tas <= 150 and abs(we) <= 60 and abs(wn) <= 60
    we, wn, tas, rms = wind._circle(np.full(100, 3.0), np.full(100, 2.0))   # slow: radius below lower bound
    assert 10 <= tas


def _move_arrays_to_document(kml: bytes) -> bytes:
    import re
    m = re.search(rb"<ExtendedData>.*?</ExtendedData>", kml, re.S)
    ext = m.group(0).replace(b"</SchemaData>", b'<gx:SimpleArrayData name="acc_vert">' + b"".join(b"<gx:value>5</gx:value>" for _ in range(kml.count(b"<when>"))) + b"</gx:SimpleArrayData></SchemaData>")
    kml = kml.replace(m.group(0), b"")
    return kml.replace(b"</Document>", ext + b"</Document>")      # ForeFlight layout: Document-level ExtendedData


def test_document_level_arrays_and_accuracy_not_mistaken_for_vertical_speed():
    sim = Sim(seed=7, gps_alt=1.5).run_standard()
    raw = parse_kml(_move_arrays_to_document(foreflight_kml(sim)))[0]
    assert {"speed", "course", "acc_v"} <= set(raw.extras) and "vs" not in raw.extras
    a = analyze(raw, "doc-0")
    assert a["recorded"]["speed_unit"] == "mps" and a["recorded"]["gps_acc_vert_median_m"] == 5.0
    assert "vs_unit" not in a["recorded"]


def test_placeholder_altitude_samples_removed_and_no_phantom_events():
    sim = Sim(seed=8, gps_alt=1.5).run_standard()
    import re
    txt = foreflight_kml(sim).decode()            # ForeFlight "no altitude" placeholder on the first two fixes
    txt = re.sub(r"(<gx:coord>\S+ \S+ )\S+(</gx:coord>)", r"\g<1>-100000\2", txt, count=2)
    a = analyze(parse_kml(txt.encode())[0], "ph-0")
    assert any("placeholder" in w for w in a["warnings"])
    assert a["performance"]["max_alt_ft"] > 1000 and len(a["takeoffs"]) == 3 and len(a["landings"]) == 3
    assert min(a["series"]["alt_ft"]) > -1000


def test_wind_bounds_allow_jet_speeds():
    import numpy as np
    from flightlab import wind
    th = np.radians(np.linspace(0, 360, 200, endpoint=False))
    vx, vy = 240 * np.sin(th) + 20, 240 * np.cos(th) - 10          # ~466 kt TAS, wind toward ENE-ish
    we, wn, tas, rms = wind._circle(vx, vy)
    assert tas == pytest.approx(240, rel=0.02) and we == pytest.approx(20, abs=2) and wn == pytest.approx(-10, abs=2)
