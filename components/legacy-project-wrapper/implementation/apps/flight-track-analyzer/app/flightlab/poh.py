"""AFM/POH-style take-off and landing performance derived from measured events.

POH charts tabulate ground roll and total distance over a 50 ft obstacle by pressure altitude and
OAT at a stated weight, zero wind, paved level dry runway. A tracklog carries none of the conditions
except field elevation, so pressure altitude, OAT, weight and (optionally) reported wind come from
per-flight metadata; anything not supplied is assumed and labelled as such.
"""

from __future__ import annotations

import math
import re

import numpy as np
from aviation.navigation import density_altitude, isa_temperature, pressure_altitude
from scipy.interpolate import LinearNDInterpolator, RegularGridInterpolator

TAIL = re.compile(r"\bN\d{1,5}[A-Z]{0,2}\b", re.I)
DEFAULT_OAT_AXIS = [0, 10, 20, 30, 40]


def guess_aircraft(a: dict) -> str | None:
    for s in (a.get("name"), a.get("filename")):
        m = TAIL.search(s or "")
        if m:
            return m.group(0).upper()
    return None


def conditions(field_elev_ft, meta):
    """Pressure altitude, OAT, density altitude, with flags saying which were assumed."""
    alt = meta.get("altimeter_inhg")
    pa = pressure_altitude(field_elev_ft, alt) if alt else field_elev_ft
    oat = meta.get("oat_c")
    isa = isa_temperature(pa)
    t = oat if oat is not None else isa
    return {
        "pa_ft": pa,
        "oat_c": t,
        "da_ft": density_altitude(pa, t),
        "pa_assumed": not alt,
        "oat_assumed": oat is None,
    }


def _wind(e, a, meta):
    """(headwind_kt, crosswind_kt, source) for an event."""
    if meta.get("wind_kt") is not None and meta.get("wind_from_deg") is not None:
        rel = math.radians(meta["wind_from_deg"] - e["heading"])
        return (
            meta["wind_kt"] * math.cos(rel),
            meta["wind_kt"] * math.sin(rel),
            "reported",
        )
    if e.get("headwind_kt") is not None:
        return (
            e["headwind_kt"],
            e.get("crosswind_kt"),
            f"estimated-{e.get('wind_confidence', 'low')}",
        )
    return None, None, None


def _zero_wind(d, gs, hw):
    if d is None or hw is None or gs is None or gs < 15.0:
        return None
    return d * ((gs + hw) / gs) ** 2


def event_rows(a: dict, meta: dict) -> list[dict]:
    rows = []
    base = {
        "flight_id": a["id"],
        "flight_name": a["name"],
        "weight_lb": meta.get("weight_lb"),
    }
    for e in a["takeoffs"]:
        if e["kind"] != "takeoff":
            continue
        hw, xw, src = _wind(e, a, meta)
        trusted = src in ("reported", "estimated-high")
        gs = e["gs_lof_kt"]
        rows.append(
            {
                **base,
                **conditions(e["field_elev_ft"], meta),
                "type": "takeoff",
                "style": e["style"],
                "t_iso": e["t_iso"],
                "runway": e["runway"],
                "lat": e["lat"],
                "lon": e["lon"],
                "field_elev_ft": e["field_elev_ft"],
                "headwind_kt": hw,
                "crosswind_kt": xw,
                "wind_source": src,
                "ground_roll_ft": e["ground_roll_ft"],
                "total50_ft": e["dist50_ft"],
                "zw_ground_roll_ft": (
                    _zero_wind(e["ground_roll_ft"], gs, hw)
                    if trusted and e["style"] != "rolling"
                    else None
                ),
                "zw_total50_ft": (
                    _zero_wind(e["dist50_ft"], gs, hw)
                    if trusted and e["style"] != "rolling"
                    else None
                ),
                "speed_kt": gs,
                "speed_label": "lift-off GS",
                "uncertainty_ft": e["timing_uncertainty_ft"],
                "roll_entry_gs_kt": e.get("roll_entry_gs_kt"),
            }
        )
    for e in a["landings"]:
        if e["kind"] != "landing":
            continue
        hw, xw, src = _wind(e, a, meta)
        trusted = src in ("reported", "estimated-high")
        rows.append(
            {
                **base,
                **conditions(e["field_elev_ft"], meta),
                "type": "landing",
                "style": e.get("type") or "full_stop",
                "t_iso": e["t_iso"],
                "runway": e["runway"],
                "lat": e["lat"],
                "lon": e["lon"],
                "field_elev_ft": e["field_elev_ft"],
                "headwind_kt": hw,
                "crosswind_kt": xw,
                "wind_source": src,
                "ground_roll_ft": e["roll_ft"],
                "total50_ft": e["dist50_ft"],
                "zw_ground_roll_ft": (
                    _zero_wind(e["roll_ft"], e["gs_td_kt"], hw) if trusted else None
                ),
                "zw_total50_ft": (
                    _zero_wind(e["dist50_ft"], e["gs_50_kt"], hw) if trusted else None
                ),
                "speed_kt": (
                    e.get("tas_50_kt")
                    if e.get("tas_50_kt") is not None
                    else e["gs_50_kt"]
                ),
                "speed_label": "speed @50 ft"
                + (" (est. airspeed)" if e.get("tas_50_kt") is not None else " (GS)"),
                "uncertainty_ft": e["timing_uncertainty_ft"],
            }
        )
    return rows


# ---------------------------------------------------------------- POH reference interpolation
def _interpolator(ref_rows, key):
    pts = [(r["pa_ft"], r["oat_c"], r[key]) for r in ref_rows if r.get(key) is not None]
    if len(pts) < 2:
        return None
    pa, oat, val = (np.array(c, float) for c in zip(*pts))
    upa, uoat = np.unique(pa), np.unique(oat)
    if len(uoat) == 1:
        o = np.argsort(pa)
        return lambda p, t: float(
            np.interp(p, pa[o], val[o], left=np.nan, right=np.nan)
        )
    if len(upa) == 1:
        o = np.argsort(oat)
        return lambda p, t: float(
            np.interp(t, oat[o], val[o], left=np.nan, right=np.nan)
        )
    if len(pts) == len(upa) * len(uoat):
        grid = np.full((len(upa), len(uoat)), np.nan)
        for p, t, v in pts:
            grid[np.searchsorted(upa, p), np.searchsorted(uoat, t)] = v
        if not np.isnan(grid).any() and len(upa) > 1 and len(uoat) > 1:
            rg = RegularGridInterpolator(
                (upa, uoat), grid, bounds_error=False, fill_value=np.nan
            )
            return lambda p, t: float(rg([[p, t]])[0])
    try:
        nd = LinearNDInterpolator(np.c_[pa, oat], val, fill_value=np.nan)
        return lambda p, t: float(nd([[p, t]])[0])
    except Exception:
        return None


def _ok(v):
    return v is not None and isinstance(v, (int, float)) and math.isfinite(v)


def attach_poh(rows, ref):
    """Add documented-performance values (interpolated, never extrapolated) and deltas to rows."""
    for typ in ("takeoff", "landing"):
        tab = (ref or {}).get(typ) or []
        gr, tot = _interpolator(tab, "ground_roll_ft"), _interpolator(tab, "total50_ft")
        for r in (x for x in rows if x["type"] == typ):
            pg = gr(r["pa_ft"], r["oat_c"]) if gr else None
            pt = tot(r["pa_ft"], r["oat_c"]) if tot else None
            r["poh_ground_roll_ft"] = pg if _ok(pg) else None
            r["poh_total50_ft"] = pt if _ok(pt) else None
            # Compare like with like: documented values assume zero wind, so use the zero-wind equivalent.
            cmp_gr, cmp_tot = r["zw_ground_roll_ft"], r["zw_total50_ft"]
            if (
                cmp_gr is None
                and r["wind_source"]
                and r["headwind_kt"] is not None
                and abs(r["headwind_kt"]) <= 3.0
                and r["style"] != "rolling"
            ):
                cmp_gr, cmp_tot = (
                    r["ground_roll_ft"],
                    r["total50_ft"],
                )  # effectively calm
            r["delta_ground_roll_pct"] = (
                100.0 * (cmp_gr / r["poh_ground_roll_ft"] - 1.0)
                if _ok(cmp_gr) and r["poh_ground_roll_ft"]
                else None
            )
            r["delta_total50_pct"] = (
                100.0 * (cmp_tot / r["poh_total50_ft"] - 1.0)
                if _ok(cmp_tot) and r["poh_total50_ft"]
                else None
            )
    return rows


# ---------------------------------------------------------------- means and matrix
_NUM = (
    "pa_ft",
    "oat_c",
    "da_ft",
    "headwind_kt",
    "weight_lb",
    "ground_roll_ft",
    "total50_ft",
    "zw_ground_roll_ft",
    "zw_total50_ft",
    "speed_kt",
    "poh_ground_roll_ft",
    "poh_total50_ft",
    "delta_ground_roll_pct",
    "delta_total50_pct",
)


def mean_row(rows, label):
    out = {
        "label": label,
        "n": len(rows),
        "flights": len({r["flight_id"] for r in rows}),
    }
    for k in _NUM:
        v = [r[k] for r in rows if _ok(r.get(k))]
        out[k] = float(np.mean(v)) if v else None
        out[k + "_n"] = len(v)
        if k in ("ground_roll_ft", "total50_ft"):
            out[k + "_std"] = float(np.std(v, ddof=1)) if len(v) > 1 else None
    return out


def _nearest(axis, v):
    return min(axis, key=lambda a: abs(a - v))


def matrix(rows, ref_rows):
    """POH layout: pressure altitude rows x OAT columns; each cell = ground roll / total over 50 ft."""
    if ref_rows:
        pas = sorted({r["pa_ft"] for r in ref_rows})
        oats = sorted({r["oat_c"] for r in ref_rows})
    else:
        pas = sorted({round(r["pa_ft"] / 1000.0) * 1000 for r in rows}) or [0]
        oats = DEFAULT_OAT_AXIS
    cells = {}
    for r in rows:
        key = (_nearest(pas, r["pa_ft"]), _nearest(oats, r["oat_c"]))
        cells.setdefault(key, []).append(r)
    out = []
    for (p, t), rs in sorted(cells.items()):
        zw = [x for x in rs if _ok(x["zw_total50_ft"])]
        use_zw = len(zw) == len(rs)
        gr = [x["zw_ground_roll_ft"] if use_zw else x["ground_roll_ft"] for x in rs]
        tot = [x["zw_total50_ft"] if use_zw else x["total50_ft"] for x in rs]
        poh = next(
            (q for q in (ref_rows or []) if q["pa_ft"] == p and q["oat_c"] == t), None
        )
        out.append(
            {
                "pa_ft": p,
                "oat_c": t,
                "n": len(rs),
                "zero_wind": use_zw,
                "ground_roll_ft": (
                    float(np.mean([g for g in gr if _ok(g)]))
                    if any(_ok(g) for g in gr)
                    else None
                ),
                "total50_ft": (
                    float(np.mean([g for g in tot if _ok(g)]))
                    if any(_ok(g) for g in tot)
                    else None
                ),
                "poh_ground_roll_ft": poh and poh.get("ground_roll_ft"),
                "poh_total50_ft": poh and poh.get("total50_ft"),
            }
        )
    return {"pa_axis": pas, "oat_axis": oats, "cells": out}


def build(rows, ref):
    """Tables for one aircraft: take-off (standing/stop-and-go), rolling take-off, landing."""
    rows = attach_poh(rows, ref)
    sections = {}
    for name, typ, pred in (
        ("takeoff", "takeoff", lambda r: r["style"] != "rolling"),
        ("takeoff_rolling", "takeoff", lambda r: r["style"] == "rolling"),
        ("landing", "landing", lambda r: True),
    ):
        rs = sorted(
            (r for r in rows if r["type"] == typ and pred(r)), key=lambda r: r["t_iso"]
        )
        if not rs:
            sections[name] = None
            continue
        groups = {}
        for r in rs:
            groups.setdefault(
                (r["runway"], round(r["field_elev_ft"] / 50.0)), []
            ).append(r)
        sections[name] = {
            "rows": rs,
            "mean": mean_row(rs, "Mean, all"),
            "by_runway": [
                mean_row(g, f"Mean, runway {k[0]} ({g[0]['field_elev_ft']:.0f} ft)")
                for k, g in sorted(groups.items())
                if len(groups) > 1
            ],
            "matrix": (
                matrix(rs, (ref or {}).get(typ)) if name != "takeoff_rolling" else None
            ),
        }
    return sections
