"""Ground reference, airborne state machine, take-off / landing / go-around events."""
from __future__ import annotations

import numpy as np
from scipy.signal import find_peaks

from .airports import default_airports
from .geo import M_TO_FT, MPS_TO_KT, circ_mean_deg, from_enu, runway_designator, to_enu, wrap180

OBSTACLE_M = 15.24        # 50 ft
UP_AGL = 9.0              # ~30 ft: considered airborne above this
DOWN_AGL = 4.0            # ~13 ft: considered on the ground below this
STOP_GS = 4.0             # m/s (~8 kt): stationary / parked block
TAXI_GS = 7.7             # m/s (15 kt): rollout complete


def _cluster_blocks(tr):
    still = (tr.gs < STOP_GS) & tr.valid
    blocks, i, n = [], 0, tr.n
    while i < n:
        if still[i]:
            j = i
            while j + 1 < n and still[j + 1]:
                j += 1
            if j - i + 1 >= 10:
                blocks.append((float(np.median(tr.x[i:j + 1])), float(np.median(tr.y[i:j + 1])),
                               float(np.median(tr.alt[i:j + 1])), j - i + 1))
            i = j + 1
        else:
            i += 1
    clusters = []
    for bx, by, ba, w in blocks:
        for c in clusters:
            if np.hypot(bx - c["x"], by - c["y"]) < 2000.0:
                c["alts"].append((ba, w))
                c["xs"].append((bx, w)); c["ys"].append((by, w))
                break
        else:
            clusters.append({"x": bx, "y": by, "alts": [(ba, w)], "xs": [(bx, w)], "ys": [(by, w)]})
    out = []
    for c in clusters:
        w = np.array([a[1] for a in c["alts"]], float)
        out.append({"x": float(np.average([a[0] for a in c["xs"]], weights=w)),
                    "y": float(np.average([a[0] for a in c["ys"]], weights=w)),
                    "alt": float(np.median([a[0] for a in c["alts"]])), "blocks": len(w)})
    return out


def ground_reference(tr, airport_index=None):
    fields = _cluster_blocks(tr)
    ref = np.full(tr.n, np.nan)
    fid = np.full(tr.n, -1, int)
    if fields:
        d = np.stack([np.hypot(tr.x - f["x"], tr.y - f["y"]) for f in fields])
        k = d.argmin(axis=0)
        near = d[k, np.arange(tr.n)] < 20000.0
        alts = np.array([f["alt"] for f in fields])
        ref[near] = alts[k][near]
        fid[near] = k[near]

    airport_index = default_airports() if airport_index is None else airport_index
    if airport_index is not None:
        biases = []
        for field in fields:
            lat, lon = from_enu(field["x"], field["y"], tr.lat0, tr.lon0)
            airport = airport_index.nearest(float(lat), float(lon))
            if airport is None:
                continue
            bias = field["alt"] - airport["elevation_ft"] / M_TO_FT
            if abs(bias) > 150.0:  # reject implausible GPS datum or wrong-airport matches
                continue
            field.update({"airport_icao": airport["icao"], "airport_name": airport["name"],
                          "airport_elev_ft": airport["elevation_ft"],
                          "airport_distance_km": airport["distance_km"], "source": "track"})
            biases.append(bias)
        if biases and max(biases) - min(biases) <= 45.0:
            # An observed ground block calibrates the GPS MSL datum before the
            # airport elevation is used at a different field without a stop.
            bias = float(np.median(biases))
            nearest, distance = airport_index.nearest_many(tr.lat, tr.lon)
            for index in np.unique(nearest[(nearest >= 0) & np.isnan(ref)]):
                airport = airport_index.airports[int(index)]
                mask = (nearest == index) & np.isnan(ref)
                if not mask.any():
                    continue
                x, y = to_enu(airport["latitude"], airport["longitude"], tr.lat0, tr.lon0)
                fields.append({"x": float(x), "y": float(y),
                               "alt": airport["elevation_ft"] / M_TO_FT + bias,
                               "blocks": 0, "source": "airport-calibrated",
                               "airport_icao": airport["icao"], "airport_name": airport["name"],
                               "airport_elev_ft": airport["elevation_ft"],
                               "airport_distance_km": float(np.min(distance[mask]))})
                ref[mask] = fields[-1]["alt"]
                fid[mask] = len(fields) - 1
    return fields, ref, fid


def _cum_path(tr):
    return np.concatenate([[0.0], np.cumsum(0.5 * (tr.gs[1:] + tr.gs[:-1]) * 1.0)])


def _at(tr, arr, t):
    return float(np.interp(t, tr.t, arr))


def detect(tr, airport_index=None) -> dict:
    fields, ref, fid = ground_reference(tr, airport_index)
    agl = tr.alt - ref
    s = _cum_path(tr)
    n = tr.n

    state = bool(np.isnan(agl[0]) or agl[0] > UP_AGL) and tr.gs[0] > 20.0
    ups, downs = [], []
    for i in range(n):
        if not state:
            if (np.isnan(agl[i]) or agl[i] > UP_AGL) and tr.gs[i] > 20.0:
                state = True
                ups.append(i)
        else:
            if not np.isnan(agl[i]) and agl[i] < DOWN_AGL and abs(tr.vs[i]) < 3.0:
                state = False
                downs.append(i)
    air = np.zeros(n, bool)
    ev_ups = sorted(set(ups))
    for a in _pair_segments(ev_ups, downs, n, tr, agl):
        air[a[0]:a[1]] = True

    takeoffs, landings = [], []
    for iu in ev_ups:
        e = _takeoff(tr, iu, agl, ref, fid, fields, s)
        if e:
            takeoffs.append(e)
    for idn in downs:
        e = _landing(tr, idn, agl, ref, fid, fields, s)
        if e:
            landings.append(e)

    # Classify touch-and-go: re-liftoff soon after touchdown without slowing to taxi speed.
    for L in landings:
        for T in takeoffs:
            if 0 < T["t"] - L["t"] < 120.0:
                seg = tr.gs[int(L["t"]):int(T["t"]) + 1]
                if seg.size and seg.min() > 12.0:
                    L["kind"], T["kind"] = "touch_and_go", "touch_and_go"
                    L["type"], T["style"] = "touch_and_go", "touch_and_go"
                    L["roll_ft"] = (_at(tr, s, T["t"]) - _at(tr, s, L["t"])) * M_TO_FT
                    L["dist50_ft"] = None
                    L["rollout_end_t"] = T["t"]
                    T["roll_start_t"] = L["t"]
                    T["ground_roll_ft"] = L["roll_ft"]
                    T["dist50_ft"] = None
                    break

    # Stop-and-go: slowed to taxi speed, then took off again from the same runway within 4 minutes.
    for L in landings:
        if L["kind"] != "landing":
            continue
        for T in takeoffs:
            gap = T["roll_start_t"] - L["rollout_end_t"]
            if T["kind"] == "takeoff" and -5.0 <= gap < 240.0 and np.hypot(T["x"] - L["x"], T["y"] - L["y"]) < 2500.0:
                L["type"], T["style"] = "stop_and_go", "stop_and_go"
                break

    go_arounds = _go_arounds(tr, agl, air, landings)
    phase = _phases(tr, air, takeoffs, landings)
    return {"fields": fields, "ref": ref, "agl": agl, "air": air, "takeoffs": takeoffs,
            "landings": landings, "go_arounds": go_arounds, "phase": phase, "cum": s}


def _pair_segments(ups, downs, n, tr, agl):
    """Airborne intervals as [start, end) index pairs."""
    segs, events = [], sorted([(i, "u") for i in ups] + [(i, "d") for i in downs])
    cur = 0 if (not events or events[0][1] == "d") and tr.gs[0] > 20.0 else None
    for i, k in events:
        if k == "u" and cur is None:
            cur = i
        elif k == "d" and cur is not None:
            segs.append((cur, i)); cur = None
    if cur is not None:
        segs.append((cur, n))
    return segs


def _event_common(tr, kind, t, x, y, fields, fid_i, heading, extra=None):
    lat, lon = from_enu(x, y, tr.lat0, tr.lon0)
    f = fields[fid_i] if 0 <= fid_i < len(fields) else None
    d = {"kind": kind, "t": float(t), "lat": float(lat), "lon": float(lon), "x": float(x), "y": float(y),
         "field_elev_ft": f.get("airport_elev_ft", f["alt"] * M_TO_FT) if f else None,
         "field_elev_source": ("airport-msl" if "airport_elev_ft" in f else "track-ground") if f else None,
         "airport_icao": f.get("airport_icao") if f else None,
         "airport_name": f.get("airport_name") if f else None,
         "airport_elev_ft": f.get("airport_elev_ft") if f else None,
         "airport_distance_km": f.get("airport_distance_km") if f else None,
         "field_id": int(fid_i) if f else None,
         "heading": float(heading), "runway": runway_designator(heading)}
    d.update(extra or {})
    return d


def _walk_back(tr, agl, li):
    i = li
    # The roll begins at the onset of sustained acceleration (taxi speed is roughly constant), while
    # still on the runway heading. The acceleration test is waived at high speed where gs plateaus.
    while i > 0 and tr.gs[i - 1] > 3.0 and tr.gs[i - 1] <= tr.gs[i] + 1.5 and agl[i - 1] < DOWN_AGL \
            and (tr.acc[i - 1] > 0.3 or tr.gs[i - 1] > 0.5 * tr.gs[li]) \
            and abs(wrap180(tr.course[i - 1] - tr.course[li])) < 12.0:
        i -= 1
    return i


def _takeoff(tr, iu, agl, ref, fid, fields, s):
    n = tr.n
    if np.isnan(ref[min(iu, n - 1)]):
        return None
    j = iu
    while j > 0 and agl[j] >= DOWN_AGL:
        j -= 1
    i = _walk_back(tr, agl, j)
    # GPS altitude error drifts slowly, so re-reference AGL to the runway altitude seen during the roll.
    roll_end = max(i + 5, i + int(0.7 * (j - i)))
    local = float(np.median(tr.alt[i:min(roll_end, j) + 1])) if j - i >= 4 else float(ref[iu])
    agl_l = tr.alt - local
    lo, hi = max(0, iu - 8), min(n, iu + 40)
    w = np.arange(lo, hi)
    w = w[(agl_l[w] > 3.0) & (agl_l[w] < 30.0)]
    t_lof = float(tr.t[iu])
    if len(w) >= 4:
        slope, icpt = np.polyfit(tr.t[w], agl_l[w], 1)
        if slope > 0.3:
            t_lof = float(np.clip(-icpt / slope, tr.t[iu] - 15.0, tr.t[iu] + 1.0))
    ahead = np.where(agl_l[max(0, iu - 3):min(n, iu + 120)] >= OBSTACLE_M)[0]
    if len(ahead) == 0:
        return None  # never cleared 50 ft: aborted or log ended
    t50 = float(tr.t[max(0, iu - 3) + ahead[0]])
    li = int(np.clip(round(t_lof), 0, n - 1))
    heading = circ_mean_deg(tr.course[i:li + 1], tr.gs[i:li + 1] + 1e-3) if li > i else tr.course[li]
    # standing: roll begins from (near) rest on the runway; rolling (soft-field style): the aircraft
    # is already moving at taxi speed when the take-off roll begins. Log starting mid-roll is partial.
    kind = "partial" if i < 3 else "takeoff"
    style = None if kind == "partial" else ("rolling" if tr.gs[i] >= 4.0 else "standing")
    gs_lof = _at(tr, tr.gs, t_lof)
    e = _event_common(tr, kind, t_lof, _at(tr, tr.x, t_lof), _at(tr, tr.y, t_lof), fields, int(fid[li]), heading)
    e.update({
        "style": style, "roll_entry_gs_kt": float(tr.gs[i] * MPS_TO_KT),
        "roll_start_t": float(tr.t[i]),
        "ground_roll_ft": (_at(tr, s, t_lof) - s[i]) * M_TO_FT,
        "dist50_ft": (_at(tr, s, t50) - s[i]) * M_TO_FT,
        "t50": t50,
        "gs_lof_kt": gs_lof * MPS_TO_KT,
        "timing_uncertainty_ft": gs_lof * M_TO_FT * 1.5,
        "mean_accel_ms2": float((gs_lof - tr.gs[i]) / max(t_lof - tr.t[i], 1.0)),
    })
    return e


def _landing(tr, idn, agl, ref, fid, fields, s):
    n = tr.n
    back = agl[max(0, idn - 120):idn]
    above = np.where(back >= OBSTACLE_M)[0]
    if len(above) == 0:
        return None
    stop = None
    for j in range(idn, min(n, idn + 240)):
        if tr.gs[j] < TAXI_GS:
            stop = j
            break
    t_coarse = float(tr.t[idn])
    t_td = t_coarse
    agl_l = agl
    if stop is not None and stop - idn >= 8:
        # Runway altitude from the roll-out (aircraft certainly on the ground) cancels slow GPS drift.
        local = float(np.median(tr.alt[max(idn + 6, stop - 12):stop + 4]))
        agl_l = tr.alt - local
        for j in range(max(0, idn - 10), stop):
            if agl_l[j] < 0.8 and tr.vs[j] > -1.5:
                t_td = float(tr.t[j])
                break
    else:
        for k in range(0, min(25, n - idn)):   # no usable roll-out: use where descent ends
            if tr.vs[idn + k] > -0.15:
                t_td = float(tr.t[idn + k])
                break
    idn = int(round(t_td))
    back = agl_l[max(0, idn - 120):idn]
    above = np.where(back >= OBSTACLE_M)[0]
    if len(above) == 0:
        return None
    t50 = float(tr.t[max(0, idn - 120) + above[-1]])
    end_t = float(tr.t[stop]) if stop is not None else float(tr.t[min(n - 1, idn + 60)])
    seg = slice(idn, max(idn + 3, min(n, idn + 12)))
    heading = circ_mean_deg(tr.course[seg], tr.gs[seg] + 1e-3)
    sink = float(-np.mean(tr.vs[max(0, idn - 4):max(1, idn - 1)]))
    e = _event_common(tr, "landing" if stop is not None else "partial", t_td, _at(tr, tr.x, t_td), _at(tr, tr.y, t_td), fields, int(fid[min(idn, n - 1)]), heading)
    e.update({
        "t50": t50,
        "rollout_end_t": end_t,
        "dist50_ft": (_at(tr, s, end_t) - _at(tr, s, t50)) * M_TO_FT,
        "roll_ft": (_at(tr, s, end_t) - _at(tr, s, t_td)) * M_TO_FT,
        "air_ft": (_at(tr, s, t_td) - _at(tr, s, t50)) * M_TO_FT,
        "gs_td_kt": _at(tr, tr.gs, t_td) * MPS_TO_KT,
        "gs_50_kt": _at(tr, tr.gs, t50) * MPS_TO_KT,
        "sink_fpm": sink * M_TO_FT * 60.0,
        "timing_uncertainty_ft": float(tr.gs[min(idn, n - 1)] * M_TO_FT * 4.0),
        "type": "full_stop" if stop is not None else None,
        "idx": idn,
    })
    return e


def _go_arounds(tr, agl, air, landings):
    out = []
    labs = np.where(air, agl, np.nan)
    a = np.nan_to_num(labs, nan=1e4)
    peaks, props = find_peaks(-a, prominence=45.0)
    for p in peaks:
        if a[p] < 35.0 and a[p] >= DOWN_AGL and 5 < p < tr.n - 5 and np.isfinite(agl[p]):
            before = labs[max(0, p - 120):p]
            after = labs[p + 1:p + 121]
            if not (np.isfinite(before).any() and np.isfinite(after).any()):
                continue
            if np.nanmax(before) < a[p] + 45.0 or np.nanmax(after) < a[p] + 45.0:
                continue   # a dip must follow a real descent and precede a real climb
            if not any(abs(L["t"] - tr.t[p]) < 30.0 for L in landings):
                out.append({"kind": "go_around", "t": float(tr.t[p]), "min_agl_ft": float(a[p] * M_TO_FT),
                            "lat": float(from_enu(tr.x[p], tr.y[p], tr.lat0, tr.lon0)[0]),
                            "lon": float(from_enu(tr.x[p], tr.y[p], tr.lat0, tr.lon0)[1])})
    return out


PHASE_NAMES = ["ground", "takeoff_roll", "climb", "level", "descent", "landing_roll"]


def _phases(tr, air, takeoffs, landings):
    ph = np.zeros(tr.n, np.int8)
    a = np.where(air)[0]
    ph[a] = np.where(tr.vs[a] > 2.0, 2, np.where(tr.vs[a] < -2.0, 4, 3))
    for T in takeoffs:
        i0, i1 = int(T["roll_start_t"]), int(round(T["t"]))
        ph[i0:i1 + 1] = 1
    for L in landings:
        i0, i1 = int(round(L["t"])), int(round(L["rollout_end_t"]))
        ph[i0:i1 + 1] = 5
    return ph
