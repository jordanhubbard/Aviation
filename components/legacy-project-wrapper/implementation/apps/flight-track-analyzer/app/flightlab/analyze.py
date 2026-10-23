"""Run the whole pipeline on one RawTrack and produce a JSON-safe analysis dict."""
from __future__ import annotations

import math
from datetime import datetime, timezone

import numpy as np

from . import accuracy, events as ev_mod, pattern, performance, wind
from .geo import M_TO_FT, MPS_TO_KT, from_enu
from .kml import RawTrack
from .track import Track, build_track

SCHEMA = 4
MAX_POINTS = 2500


def jsonable(o):
    if isinstance(o, dict):
        return {k: jsonable(v) for k, v in o.items() if not str(k).startswith("_")}
    if isinstance(o, (list, tuple)):
        return [jsonable(v) for v in o]
    if isinstance(o, np.ndarray):
        return jsonable(o.tolist())
    if isinstance(o, (np.floating, float)):
        f = float(o)
        return None if not math.isfinite(f) else f
    if isinstance(o, np.integer):
        return int(o)
    if isinstance(o, np.bool_):
        return bool(o)
    return o


def _iso(t):
    return datetime.fromtimestamp(t, timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def _wind_components(w, heading):
    """(headwind, crosswind-from-right) in m/s for wind vector w=(we,wn) and runway heading."""
    h = math.radians(heading)
    r = (math.sin(h), math.cos(h))
    right = (math.cos(h), -math.sin(h))
    along = w[0] * r[0] + w[1] * r[1]
    across = w[0] * right[0] + w[1] * right[1]
    return -along, -across


def _enrich_events(tr, ev, wfit, airspeed):
    w = (wfit["we"], wfit["wn"]) if wfit else None
    high = bool(wfit and wfit["confidence"] == "high")
    for e in ev["takeoffs"] + ev["landings"]:
        e["t_iso"] = _iso(tr.t0 + e["t"])
        if w:
            hw, xw = _wind_components(w, e["heading"])
            e["headwind_kt"], e["crosswind_kt"] = hw * MPS_TO_KT, xw * MPS_TO_KT
            e["wind_confidence"] = wfit["confidence"]
    for T in ev["takeoffs"]:
        if w:
            T["tas_lof_kt"] = T["gs_lof_kt"] + T["headwind_kt"]
        if high and T["kind"] == "takeoff" and T.get("style") != "rolling" and T["gs_lof_kt"] > 15:
            k = (T["tas_lof_kt"] / T["gs_lof_kt"]) ** 2
            T["zero_wind_roll_ft"], T["zero_wind_dist50_ft"] = T["ground_roll_ft"] * k, T["dist50_ft"] * k
    for L in ev["landings"]:
        L["tas_50_kt"] = float(np.interp(L["t50"], tr.t, airspeed) * MPS_TO_KT) if w else None
        L["tas_td_kt"] = L["gs_td_kt"] + L["headwind_kt"] if w else None
        if high and L["kind"] == "landing" and L["gs_td_kt"] > 15 and L["gs_50_kt"] > 15:
            L["zero_wind_roll_ft"] = L["roll_ft"] * ((L["gs_td_kt"] + L["headwind_kt"]) / L["gs_td_kt"]) ** 2
            L["zero_wind_dist50_ft"] = L["dist50_ft"] * ((L["gs_50_kt"] + L["headwind_kt"]) / L["gs_50_kt"]) ** 2


def analyze(raw: RawTrack, flight_id: str, target_agl_ft: float | None = None, airport_index=None) -> dict:
    tr: Track = build_track(raw)
    ev = ev_mod.detect(tr, airport_index)
    air, agl = ev["air"], ev["agl"]

    try:
        wfit = wind.fit_flight_wind(tr, air)
    except Exception as e:      # a failed wind fit must not lose the whole flight
        wfit = None
        tr.warnings.append(f"wind estimate failed ({type(e).__name__}); speeds are ground speeds")
    if wfit:
        a = np.hypot(tr.vx - wfit["we"], tr.vy - wfit["wn"])
        airspeed = np.where(air, a, tr.gs)
        basis = f"wind-corrected estimate ({wfit['confidence']} confidence)"
    else:
        airspeed = tr.gs.copy()
        basis = "ground speed (no usable wind estimate)"
    _enrich_events(tr, ev, wfit, airspeed)

    pats = []
    to_t = sorted(T["t"] for T in ev["takeoffs"])
    for L in ev["landings"]:
        prev = max([t for t in to_t if t < L["t"]], default=None)
        try:
            p = pattern.analyse_landing(tr, L, agl, airspeed, prev)
        except Exception as e:  # a pattern failure must not sink the whole flight
            tr.warnings.append(f"pattern analysis failed for landing at t={L['t']:.0f}s: {e}")
            continue
        pats.append(p)
    laps = [p for p in pats if not p["straight_in"]]
    dw = [p["legs"]["downwind"]["agl_ft"] for p in laps if p["legs"]["downwind"]["agl_ft"] is not None]
    target = target_agl_ft if target_agl_ft else (float(np.median(dw)) if dw else None)
    for p in laps:
        if target is not None and p["legs"]["downwind"]["agl_ft"] is not None:
            p["target_ft"] = target
            p["agl_error_ft"] = p["legs"]["downwind"]["agl_ft"] - target

    acc = accuracy.analyse(tr, air, agl, airspeed, basis, pats, ev["landings"])
    if acc.get("pattern_altitude") is not None:
        acc["pattern_altitude"]["target_ft"] = target
        acc["pattern_altitude"]["target_is_default"] = not bool(target_agl_ft)
    perf = performance.analyse(tr, air, agl, airspeed, ev)

    warnings = list(tr.warnings)
    if not ev["fields"]:
        warnings.append("no stationary period found: take-off / landing distances and AGL unavailable")
    if wfit is None:
        warnings.append("not enough heading variety for a wind estimate; speeds are ground speeds")
    elif wfit["confidence"] == "low":
        warnings.append("wind estimate is approximate (pattern-style flying); airspeed values are indicative, "
                        "deviations are reliable, zero-wind distances withheld")

    step = max(1, int(math.ceil(tr.n / MAX_POINTS)))
    sl = slice(None, None, step)
    series = {
        "t": tr.t[sl], "lat": tr.lat[sl], "lon": tr.lon[sl], "x": tr.x[sl], "y": tr.y[sl],
        "alt_ft": tr.alt[sl] * M_TO_FT, "agl_ft": np.where(np.isfinite(agl), agl * M_TO_FT, np.nan)[sl],
        "gs_kt": tr.gs[sl] * MPS_TO_KT, "as_kt": airspeed[sl] * MPS_TO_KT, "vs_fpm": tr.vs[sl] * M_TO_FT * 60.0,
        "course": tr.course[sl], "turn_dps": tr.turn[sl], "phase": ev["phase"][sl].astype(int),
    }
    series = {k: (np.round(v, 2) if v.dtype.kind == "f" else v) for k, v in series.items()}

    out = {
        "schema": SCHEMA, "id": flight_id, "name": raw.name, "source": raw.source,
        "start_iso": _iso(tr.t0), "duration_s": float(tr.t[-1]),
        "origin": {"lat": tr.lat0, "lon": tr.lon0},
        "quality": tr.quality, "warnings": warnings,
        "recorded": {k: v for k, v in tr.recorded.items() if not isinstance(v, np.ndarray)},
        "wind": ({"from_deg": wfit["from_deg"], "speed_kt": wfit["speed"] * MPS_TO_KT,
                  "tas_kt": wfit["tas"] * MPS_TO_KT, "confidence": wfit["confidence"], "basis": wfit["basis"],
                  "uncertainty_kt": wfit["uncertainty"] * MPS_TO_KT, "rms_kt": wfit["rms"] * MPS_TO_KT}
                 if wfit else None),
        "speed_basis": basis,
        "fields": [{"lat": from_enu(f["x"], f["y"], tr.lat0, tr.lon0)[0], "lon": from_enu(f["x"], f["y"], tr.lat0, tr.lon0)[1],
                    "elev_ft": f.get("airport_elev_ft", f["alt"] * M_TO_FT),
                    "track_ground_elev_ft": f["alt"] * M_TO_FT,
                    "elev_source": "airport-msl" if "airport_elev_ft" in f else "track-ground",
                    "airport_icao": f.get("airport_icao"), "airport_name": f.get("airport_name"),
                    "airport_distance_km": f.get("airport_distance_km"),
                    "source": f.get("source", "track"), "x": f["x"], "y": f["y"]} for f in ev["fields"]],
        "takeoffs": ev["takeoffs"], "landings": ev["landings"], "go_arounds": ev["go_arounds"],
        "patterns": pats, "performance": perf, "accuracy": acc, "series": series,
    }
    out["summary"] = summarize(out)
    return jsonable(out)


def summarize(a: dict) -> dict:
    return {
        "id": a["id"], "name": a["name"], "source": a["source"], "start_iso": a["start_iso"],
        "duration_s": a["duration_s"], "distance_nm": a["performance"]["distance_nm"],
        "airborne_s": a["performance"]["airborne_s"], "max_alt_ft": a["performance"]["max_alt_ft"],
        "takeoffs": len([t for t in a["takeoffs"]]), "landings": len(a["landings"]),
        "patterns": len(a["patterns"]), "warnings": len(a["warnings"]),
    }
