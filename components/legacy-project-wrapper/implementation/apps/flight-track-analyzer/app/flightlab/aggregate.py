"""Pool take-off / landing / accuracy statistics across flights."""
from __future__ import annotations

import numpy as np


def _stats(v):
    v = np.array([x for x in v if x is not None], float)
    if v.size == 0:
        return None
    return {"n": int(v.size), "mean": float(v.mean()), "median": float(np.median(v)),
            "std": float(v.std(ddof=1)) if v.size > 1 else None, "min": float(v.min()), "max": float(v.max())}


def _cluster_fields(flights):
    """Group airfields by proximity (3 km) across flights; returns {(fi, field_id): cluster_index}."""
    reps, mapping = [], {}
    for fi, f in enumerate(flights):
        for k, fld in enumerate(f["fields"]):
            for ci, (lat, lon) in enumerate(reps):
                if abs(lat - fld["lat"]) < 0.03 and abs(lon - fld["lon"]) < 0.04:
                    mapping[(fi, k)] = ci
                    break
            else:
                reps.append((fld["lat"], fld["lon"]))
                mapping[(fi, k)] = len(reps) - 1
    return mapping, reps


def summarize(flights: list[dict]) -> dict:
    mapping, reps = _cluster_fields(flights)
    groups: dict = {}
    for fi, f in enumerate(flights):
        for kind_key, evs in (("takeoffs", f["takeoffs"]), ("landings", f["landings"])):
            for e in evs:
                if e["kind"] not in ("takeoff", "landing") or e.get("field_id") is None:
                    continue
                ci = mapping.get((fi, e["field_id"]))
                key = (ci, e["runway"])
                g = groups.setdefault(key, {"takeoffs": [], "landings": []})
                g[kind_key].append({**e, "flight": f["id"], "flight_name": f["name"]})
    runways = []
    for (ci, rwy), g in sorted(groups.items(), key=lambda kv: -(len(kv[1]["takeoffs"]) + len(kv[1]["landings"]))):
        T_all, L = g["takeoffs"], g["landings"]
        T = [e for e in T_all if e.get("style") != "rolling"]      # standing and stop-and-go starts
        R = [e for e in T_all if e.get("style") == "rolling"]      # rolling (soft-field style) starts
        runways.append({
            "airfield": {"lat": reps[ci][0], "lon": reps[ci][1],
                         "elev_ft": _stats([e["field_elev_ft"] for e in T_all + L])["mean"]},
            "runway": rwy,
            "takeoff": {"ground_roll_ft": _stats([e["ground_roll_ft"] for e in T]),
                        "dist50_ft": _stats([e["dist50_ft"] for e in T]),
                        "zero_wind_roll_ft": _stats([e.get("zero_wind_roll_ft") for e in T]),
                        "zero_wind_dist50_ft": _stats([e.get("zero_wind_dist50_ft") for e in T]),
                        "lift_off_gs_kt": _stats([e["gs_lof_kt"] for e in T]),
                        "headwind_kt": _stats([e.get("headwind_kt") for e in T])},
            "takeoff_rolling": {"ground_roll_ft": _stats([e["ground_roll_ft"] for e in R]),
                                "dist50_ft": _stats([e["dist50_ft"] for e in R]),
                                "entry_speed_kt": _stats([e.get("roll_entry_gs_kt") for e in R]),
                                "lift_off_gs_kt": _stats([e["gs_lof_kt"] for e in R])},
            "landing": {"dist50_ft": _stats([e["dist50_ft"] for e in L]),
                        "ground_roll_ft": _stats([e["roll_ft"] for e in L]),
                        "zero_wind_dist50_ft": _stats([e.get("zero_wind_dist50_ft") for e in L]),
                        "approach_speed_kt": _stats([e.get("tas_50_kt") for e in L]),
                        "touchdown_gs_kt": _stats([e["gs_td_kt"] for e in L]),
                        "sink_fpm": _stats([e["sink_fpm"] for e in L]),
                        "headwind_kt": _stats([e.get("headwind_kt") for e in L])},
            "events": [{"flight": e["flight"], "flight_name": e["flight_name"], "kind": e["kind"], "style": e.get("style") or e.get("type"), "t_iso": e.get("t_iso"),
                        "dist50_ft": e.get("dist50_ft"), "roll_ft": e.get("ground_roll_ft", e.get("roll_ft")),
                        "headwind_kt": e.get("headwind_kt")} for e in T_all + L],
        })
    acc = {"altitude_rms_ft": [], "pattern_alt_std_ft": [], "approach_speed_std_kt": [], "centerline_ft": [], "glidepath_ft": []}
    trend = []
    for f in flights:
        a = f["accuracy"]
        ah = a.get("altitude_hold")
        pa = a.get("pattern_altitude")
        fa = a.get("final_approach")
        acc["altitude_rms_ft"].append(ah["rms_ft"] if ah else None)
        acc["pattern_alt_std_ft"].append(pa["std_ft"] if pa else None)
        acc["approach_speed_std_kt"].append(fa.get("approach_speed_std_across_landings_kt") if fa else None)
        acc["centerline_ft"].append(fa["centerline_err_std_ft"] if fa else None)
        acc["glidepath_ft"].append(fa["glidepath_err_std_ft"] if fa else None)
        trend.append({"id": f["id"], "name": f["name"], "start_iso": f["start_iso"],
                      "altitude_rms_ft": ah["rms_ft"] if ah else None,
                      "pattern_alt_std_ft": pa["std_ft"] if pa else None,
                      "centerline_ft": fa["centerline_err_std_ft"] if fa else None,
                      "glidepath_ft": fa["glidepath_err_std_ft"] if fa else None})
    trend.sort(key=lambda r: r["start_iso"])
    perf = {"climb_rate_fpm": _stats([f["performance"].get("climb", {}).get("mean_rate_fpm") for f in flights]),
            "climb_speed_kt": _stats([f["performance"].get("climb", {}).get("mean_speed_kt") for f in flights]),
            "cruise_speed_kt": _stats([f["performance"].get("cruise", {}).get("mean_speed_kt") for f in flights]),
            "descent_rate_fpm": _stats([f["performance"].get("descent", {}).get("mean_rate_fpm") for f in flights]),
            "glide_ratio": _stats([f["performance"].get("descent", {}).get("glide_ratio") for f in flights]),
            "max_bank_deg": _stats([f["performance"].get("max_bank_deg") for f in flights])}
    counts = {"takeoff_style": {}, "landing_type": {}}
    for f in flights:
        for e in f["takeoffs"]:
            k = e.get("style") or e["kind"]; counts["takeoff_style"][k] = counts["takeoff_style"].get(k, 0) + 1
        for e in f["landings"]:
            k = e.get("type") or e["kind"]; counts["landing_type"][k] = counts["landing_type"].get(k, 0) + 1
    return {"flights": len(flights), "counts": counts, "hours": sum(f["performance"]["airborne_s"] for f in flights) / 3600.0,
            "runways": runways, "performance": perf,
            "accuracy": {k: _stats(v) for k, v in acc.items()}, "trend": trend}
