"""Altitude and airspeed holding accuracy."""
from __future__ import annotations

import numpy as np

from .geo import M_TO_FT, MPS_TO_KT
from .pattern import _runs


def _regime_runs(tr, air, agl, kind):
    base = air & tr.valid
    if kind == "level":
        m = base & (np.abs(tr.vs) < 2.0) & ~(np.isfinite(agl) & (agl < 30.0))
        return _runs(m, 60)
    if kind == "climb":
        return _runs(base & (tr.vs > 2.0), 30)
    return _runs(base & (tr.vs < -2.0), 30)


def analyse(tr, air, agl, airspeed, speed_basis, patterns, landings):
    out = {"altitude_basis": "GPS geometric altitude (includes GPS error)", "speed_basis": speed_basis}
    segs = []
    for a, b in _regime_runs(tr, air, agl, "level"):
        alt = tr.alt[a:b + 1] * M_TO_FT
        med = float(np.median(alt))
        dev = alt - med
        segs.append({"t0": float(tr.t[a]), "t1": float(tr.t[b]), "duration_s": float(b - a),
                     "altitude_ft": med, "std_ft": float(np.std(dev)), "max_dev_ft": float(np.max(np.abs(dev))),
                     "within_100ft_pct": float(100.0 * np.mean(np.abs(dev) <= 100.0)),
                     "speed_std_kt": float(np.nanstd(airspeed[a:b + 1]) * MPS_TO_KT)})
    out["level_segments"] = segs
    if segs:
        d = np.array([s["duration_s"] for s in segs])
        out["altitude_hold"] = {
            "rms_ft": float(np.sqrt(np.sum(d * np.array([s["std_ft"] for s in segs]) ** 2) / d.sum())),
            "max_dev_ft": float(max(s["max_dev_ft"] for s in segs)),
            "within_100ft_pct": float(np.sum(d * np.array([s["within_100ft_pct"] for s in segs])) / d.sum()),
            "time_s": float(d.sum()),
        }
    speed = {}
    for kind in ("climb", "level", "descent"):
        rows = []
        for a, b in _regime_runs(tr, air, agl, kind):
            sp = airspeed[a:b + 1] * MPS_TO_KT
            if np.isfinite(sp).sum() < 20:
                continue
            m = float(np.nanmean(sp))
            rows.append({"n": int(b - a + 1), "mean_kt": m, "std_kt": float(np.nanstd(sp)),
                         "within_5kt_pct": float(100.0 * np.nanmean(np.abs(sp - m) <= 5.0))})
        if rows:
            n = np.array([r["n"] for r in rows], float)
            speed[kind] = {"segments": len(rows), "time_s": float(n.sum()),
                           "std_kt": float(np.sqrt(np.sum(n * np.array([r["std_kt"] for r in rows]) ** 2) / n.sum())),
                           "within_5kt_pct": float(np.sum(n * np.array([r["within_5kt_pct"] for r in rows])) / n.sum())}
    out["airspeed_hold"] = speed

    laps = [p for p in patterns if not p["straight_in"]]
    if laps:
        dwa = [p["legs"]["downwind"]["agl_ft"] for p in laps if p["legs"]["downwind"]["agl_ft"] is not None]
        if dwa:
            out["pattern_altitude"] = {"downwind_agl_ft": [float(a) for a in dwa], "median_ft": float(np.median(dwa)),
                                       "std_ft": float(np.std(dwa)) if len(dwa) > 1 else None,
                                       "target_ft": laps[0].get("target_ft"),
                                       "mean_abs_error_ft": (float(np.mean([abs(p["agl_error_ft"]) for p in laps if "agl_error_ft" in p]))
                                                             if any("agl_error_ft" in p for p in laps) else None)}
        off = [p["legs"]["downwind"]["offset_ft"] for p in laps if p["legs"]["downwind"]["offset_ft"] is not None]
        if off:
            out["downwind_offset"] = {"values_ft": [float(abs(o)) for o in off], "mean_ft": float(np.mean(np.abs(off))),
                                      "std_ft": float(np.std(np.abs(off))) if len(off) > 1 else None}
    fin = [p["final"] for p in patterns if "final" in p]
    if fin:
        out["final_approach"] = {
            "centerline_err_std_ft": float(np.mean([f["centerline_err_std_ft"] for f in fin])),
            "glidepath_deg": float(np.mean([f["glidepath_deg"] for f in fin])),
            "glidepath_err_std_ft": float(np.mean([f["glidepath_err_std_ft"] for f in fin])),
        }
        sp = [f["speed_500_50_kt"] for f in fin if "speed_500_50_kt" in f]
        if sp:
            out["final_approach"]["approach_speed_mean_kt"] = float(np.mean(sp))
            out["final_approach"]["approach_speed_std_across_landings_kt"] = float(np.std(sp)) if len(sp) > 1 else None
            out["final_approach"]["speed_std_within_final_kt"] = float(np.mean([f["speed_500_50_std_kt"] for f in fin if "speed_500_50_std_kt" in f]))
    # touchdown repeatability along the runway axis
    tds = [L for L in landings if L.get("field_id") is not None]
    groups = {}
    for L in tds:
        groups.setdefault((L["field_id"], L["runway"]), []).append(L)
    reps = []
    for (fid, rwy), Ls in groups.items():
        if len(Ls) >= 2:
            h = np.radians(np.mean([l["heading"] for l in Ls]))
            e = np.array([np.sin(h), np.cos(h)])
            pos = np.array([l["x"] * e[0] + l["y"] * e[1] for l in Ls])
            reps.append({"runway": rwy, "n": len(Ls), "std_ft": float(np.std(pos) * M_TO_FT),
                         "range_ft": float((pos.max() - pos.min()) * M_TO_FT)})
    if reps:
        out["touchdown_repeatability"] = reps
    return out
