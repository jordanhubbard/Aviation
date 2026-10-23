"""Traffic pattern geometry in a runway frame (origin at touchdown, u along landing course)."""
from __future__ import annotations

import numpy as np

from .geo import M_TO_FT, M_TO_NM, MPS_TO_KT, wrap180
from .track import bank_angle_deg

MIN_RUN = 8  # samples


def _runs(mask, min_len=MIN_RUN):
    out, i, n = [], 0, len(mask)
    while i < n:
        if mask[i]:
            j = i
            while j + 1 < n and mask[j + 1]:
                j += 1
            if j - i + 1 >= min_len:
                out.append((i, j))
            i = j + 1
        else:
            i += 1
    return out


def _stat(v):
    v = np.asarray(v, float)
    v = v[np.isfinite(v)]
    return (float(np.median(v)), float(np.std(v))) if v.size else (None, None)


def runway_frame(tr, L):
    h = np.radians(L["heading"])
    e = np.array([np.sin(h), np.cos(h)])
    r = np.array([np.cos(h), -np.sin(h)])
    dx, dy = tr.x - L["x"], tr.y - L["y"]
    return dx * e[0] + dy * e[1], dx * r[0] + dy * r[1]


def analyse_landing(tr, L, agl, airspeed, prev_liftoff_t=None, target_agl_ft=None):
    idn = int(round(L["t"]))
    i0 = max(0, idn - 900)
    if prev_liftoff_t is not None and 0 < L["t"] - prev_liftoff_t < 1200:
        i0 = max(i0, int(prev_liftoff_t))
    u, v = runway_frame(tr, L)
    rel = wrap180(tr.course - L["heading"])
    sl = slice(i0, idn + 1)
    idx = np.arange(i0, idn + 1)
    near = (np.hypot(u[sl], v[sl]) < 12000.0) & (tr.gs[sl] > 15.0)
    airb = agl[sl] > 6.0
    ok = near & (airb | np.isnan(agl[sl]))

    # final: walk back from touchdown while tracking within 25 degrees of the runway
    f0 = idn
    while f0 > i0 and abs(rel[f0 - 1]) < 25.0 and u[f0 - 1] < 100.0 and gs_ok(tr, f0 - 1):
        f0 -= 1
    final = (f0, idn)

    dw_runs = _runs(ok & (np.abs(rel[sl]) > 150.0), 8)
    legs = {}
    side = None
    if dw_runs:
        a, b = max(dw_runs, key=lambda r: r[1] - r[0])
        a, b = a + i0, b + i0
        side = "left" if np.median(v[a:b + 1]) < 0 else "right"
        legs["downwind"] = (a, b)
        base_rel = 90.0 if side == "left" else -90.0
        cross_rel = -base_rel
        bm = ok & (np.abs(wrap180(rel[sl] - base_rel)) < 35.0)
        cands = [(p + i0, q + i0) for p, q in _runs(bm, 6) if p + i0 > b and q + i0 <= f0 + 3]
        if cands:
            legs["base"] = max(cands, key=lambda r: r[1] - r[0])
        cm = ok & (np.abs(wrap180(rel[sl] - cross_rel)) < 35.0)
        cands = [(p + i0, q + i0) for p, q in _runs(cm, 6) if q + i0 < a + 3]
        if cands:
            legs["crosswind"] = max(cands, key=lambda r: r[1])
            ca = legs["crosswind"][0]
            um = ok & (np.abs(rel[sl]) < 35.0)
            cands = [(p + i0, q + i0) for p, q in _runs(um, 6) if q + i0 < ca + 3]
            if cands:
                legs["upwind"] = max(cands, key=lambda r: r[1])
    legs["final"] = final

    def leg_stats(name):
        a, b = legs[name]
        sel = slice(a, b + 1)
        am, asd = _stat(agl[sel] * M_TO_FT)
        sm, ssd = _stat(airspeed[sel] * MPS_TO_KT)
        vm, vsd = _stat(v[sel] * M_TO_FT)
        d = {"t0": float(tr.t[a]), "t1": float(tr.t[b]), "duration_s": float(b - a),
             "length_nm": float(np.sum(tr.gs[sel]) * M_TO_NM), "agl_ft": am, "agl_std_ft": asd,
             "speed_kt": sm, "speed_std_kt": ssd, "offset_ft": vm, "offset_std_ft": vsd,
             "u_start_ft": float(u[a] * M_TO_FT), "u_end_ft": float(u[b] * M_TO_FT)}
        return d

    out = {"landing_t": L["t"], "kind": L["kind"], "runway": L["runway"], "side": side,
           "straight_in": "downwind" not in legs,
           "legs": {k: leg_stats(k) for k in legs}}

    # final approach quality
    a, b = final
    fs = np.arange(a, b + 1)
    hi = fs[np.isfinite(agl[fs]) & (agl[fs] > 20.0) & (agl[fs] < 300.0)]
    if len(hi) >= 6:
        d_to = -u[hi]
        slope, icpt = np.polyfit(d_to, agl[hi], 1)
        resid = agl[hi] - (slope * d_to + icpt)
        out["final"] = {
            "turn_to_final_ft": float(-u[a] * M_TO_FT),
            "glidepath_deg": float(np.degrees(np.arctan(slope))),
            "glidepath_err_std_ft": float(np.std(resid) * M_TO_FT),
            "centerline_err_std_ft": float(np.std(v[hi]) * M_TO_FT),
            "centerline_err_mean_ft": float(np.mean(v[hi]) * M_TO_FT),
            "height_at_start_ft": float(agl[a] * M_TO_FT) if np.isfinite(agl[a]) else None,
        }
        sp = fs[np.isfinite(agl[fs]) & (agl[fs] < 152.4) & (agl[fs] > 15.24)]   # 500 ft .. 50 ft
        if len(sp) >= 4:
            out["final"]["speed_500_50_kt"] = float(np.mean(airspeed[sp]) * MPS_TO_KT)
            out["final"]["speed_500_50_std_kt"] = float(np.std(airspeed[sp]) * MPS_TO_KT)
    first = min(a for a, _ in legs.values())
    seg = np.arange(first, idn + 1)
    bank = bank_angle_deg(tr.gs[seg], tr.turn[seg])
    out["max_bank_deg"] = float(np.max(bank)) if len(bank) else None
    if "downwind" in legs and target_agl_ft is not None:
        out["agl_error_ft"] = out["legs"]["downwind"]["agl_ft"] - target_agl_ft
    # path for plotting
    step = 2
    sel = np.arange(first, idn + 1, step)
    leg_of = np.array([""] * len(sel), dtype=object)
    for k, (p, q) in legs.items():
        leg_of[(sel >= p) & (sel <= q)] = k
    out["path"] = {"u_ft": np.round(u[sel] * M_TO_FT, 0).tolist(), "v_ft": np.round(v[sel] * M_TO_FT, 0).tolist(),
                   "agl_ft": [None if not np.isfinite(a) else round(float(a * M_TO_FT), 0) for a in agl[sel]],
                   "leg": leg_of.tolist()}
    out["_first"] = int(first)
    return out


def gs_ok(tr, i):
    return tr.gs[i] > 15.0
