"""Per-flight performance: climb, cruise, descent, turns, extremes."""
from __future__ import annotations

import numpy as np

from .geo import M_TO_FT, M_TO_NM, MPS_TO_KT
from .pattern import _runs
from .track import bank_angle_deg


def analyse(tr, air, agl, airspeed, events):
    p = {}
    ok = air & tr.valid
    a = np.where(ok)[0]
    p["airborne_s"] = float(len(a))
    p["distance_nm"] = float(np.sum(tr.gs[tr.valid]) * M_TO_NM)
    p["max_alt_ft"] = float(np.max(tr.alt) * M_TO_FT)
    p["max_gs_kt"] = float(np.max(tr.gs) * MPS_TO_KT)
    p["max_agl_ft"] = float(np.nanmax(agl[ok]) * M_TO_FT) if ok.any() and np.isfinite(agl[ok]).any() else None

    def seg_rows(mask, minlen):
        rows = []
        for i, j in _runs(ok & mask, minlen):
            sl = slice(i, j + 1)
            sp = airspeed[sl] * MPS_TO_KT
            rows.append({"t0": float(tr.t[i]), "t1": float(tr.t[j]), "duration_s": float(j - i),
                         "alt_start_ft": float(tr.alt[i] * M_TO_FT), "alt_end_ft": float(tr.alt[j] * M_TO_FT),
                         "rate_fpm": float(np.mean(tr.vs[sl]) * M_TO_FT * 60.0),
                         "speed_kt": float(np.nanmean(sp)),
                         "gs_kt": float(np.mean(tr.gs[sl]) * MPS_TO_KT),
                         "gradient_ft_nm": float(np.mean(tr.vs[sl]) / max(np.mean(tr.gs[sl]), 1.0) * M_TO_FT * 1852.0)})
        return rows

    climbs = seg_rows(tr.vs > 1.5, 30)
    descents = seg_rows(tr.vs < -1.5, 30)
    levels = [r for r in seg_rows(np.abs(tr.vs) < 1.0, 90)]
    p["climbs"], p["descents"], p["levels"] = climbs, descents, levels
    if climbs:
        w = np.array([c["duration_s"] for c in climbs])
        p["climb"] = {"mean_rate_fpm": float(np.average([c["rate_fpm"] for c in climbs], weights=w)),
                      "max_rate_fpm": float(max(c["rate_fpm"] for c in climbs)),
                      "mean_speed_kt": float(np.average([c["speed_kt"] for c in climbs], weights=w)),
                      "mean_gradient_ft_nm": float(np.average([c["gradient_ft_nm"] for c in climbs], weights=w))}
    if descents:
        w = np.array([c["duration_s"] for c in descents])
        rate = np.average([c["rate_fpm"] for c in descents], weights=w)
        gs = np.average([c["gs_kt"] for c in descents], weights=w)
        p["descent"] = {"mean_rate_fpm": float(rate),
                        "mean_speed_kt": float(np.average([c["speed_kt"] for c in descents], weights=w)),
                        "glide_ratio": float(gs * 101.269 / max(-rate, 1.0))}   # kt -> ft/min
    if levels:
        w = np.array([c["duration_s"] for c in levels])
        p["cruise"] = {"mean_speed_kt": float(np.average([c["speed_kt"] for c in levels], weights=w)),
                       "mean_gs_kt": float(np.average([c["gs_kt"] for c in levels], weights=w)),
                       "mean_alt_ft": float(np.average([(c["alt_start_ft"] + c["alt_end_ft"]) / 2 for c in levels], weights=w))}
    # best-rate climb speed: needs real spread of climb airspeeds
    m = ok & (tr.vs > 1.0) & (np.abs(tr.turn) < 1.0) & np.isfinite(airspeed)
    if m.sum() >= 60:
        spd = airspeed[m] * MPS_TO_KT
        vs = tr.vs[m] * M_TO_FT * 60.0
        if spd.max() - spd.min() >= 8.0:
            c = np.polyfit(spd, vs, 2)
            if c[0] < 0:
                v = -c[1] / (2 * c[0])
                if spd.min() <= v <= spd.max():
                    p["best_rate_speed_kt"] = float(v)
                    p["best_rate_fpm"] = float(np.polyval(c, v))
    turning = ok & (tr.gs > 15.0)
    if turning.any():
        bank = bank_angle_deg(tr.gs, tr.turn)
        p["max_turn_rate_dps"] = float(np.max(np.abs(tr.turn[turning])))
        p["max_bank_deg"] = float(np.percentile(bank[turning], 99.5))
        p["p95_bank_deg"] = float(np.percentile(bank[turning], 95))
    # landing performance summary
    full = [L for L in events["landings"] if L["kind"] == "landing"]
    if full:
        p["landing"] = {"approach_speed_kt": _mean([L.get("tas_50_kt") for L in full]),
                        "touchdown_gs_kt": _mean([L["gs_td_kt"] for L in full]),
                        "sink_fpm": _mean([L["sink_fpm"] for L in full])}
    return p


def _mean(v):
    v = [x for x in v if x is not None and np.isfinite(x)]
    return float(np.mean(v)) if v else None
