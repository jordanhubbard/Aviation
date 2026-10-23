"""Condition a RawTrack into a uniformly sampled, smoothed Track."""
from __future__ import annotations

from dataclasses import dataclass, field

import numpy as np
from scipy.ndimage import median_filter
from scipy.signal import savgol_filter

from .geo import G, MPS_TO_KT, to_enu, wrap180
from .kml import RawTrack

DT = 1.0
GAP_S = 15.0


@dataclass
class Track:
    name: str
    source: str
    t0: float
    t: np.ndarray
    lat: np.ndarray
    lon: np.ndarray
    lat0: float
    lon0: float
    x: np.ndarray
    y: np.ndarray
    alt: np.ndarray          # smoothed, metres
    alt_raw: np.ndarray
    vx: np.ndarray
    vy: np.ndarray
    gs: np.ndarray           # m/s
    course: np.ndarray       # deg 0..360
    turn: np.ndarray         # deg/s, + = right
    vs: np.ndarray           # m/s
    acc: np.ndarray          # m/s^2 along track
    valid: np.ndarray
    quality: dict = field(default_factory=dict)
    warnings: list = field(default_factory=list)
    recorded: dict = field(default_factory=dict)

    @property
    def n(self):
        return len(self.t)


def _hampel(v, win, floor):
    med = median_filter(v, size=win, mode="nearest")
    res = v - med
    mad = median_filter(np.abs(res), size=win, mode="nearest") * 1.4826
    return np.abs(res) > np.maximum(6.0 * mad, floor)


def _win(w, n):
    """Odd Savitzky-Golay window of about w samples that fits an n-sample series."""
    w = min(int(w), n if n % 2 else n - 1)
    w = w if w % 2 else w - 1
    return max(w, 5)


def build_track(raw: RawTrack) -> Track:
    warnings = list(raw.warnings)
    n_in = len(raw.t)
    ok = np.isfinite(raw.t) & np.isfinite(raw.lat) & np.isfinite(raw.lon) & np.isfinite(raw.alt_m)
    ok &= (np.abs(raw.lat) <= 90) & (np.abs(raw.lon) <= 180)
    order = np.argsort(raw.t, kind="stable")
    order = order[ok[order]]
    t = raw.t[order]
    keep = np.concatenate([[True], np.diff(t) > 0])
    order = order[keep]
    t, lat, lon, alt = raw.t[order], raw.lat[order], raw.lon[order], raw.alt_m[order]
    extras = {k: (v[order], h) for k, (v, h) in raw.extras.items()}
    if len(t) < 10:
        raise ValueError("fewer than 10 usable samples")

    lat0, lon0 = float(np.median(lat)), float(np.median(lon))
    x, y = to_enu(lat, lon, lat0, lon0)

    rej = np.zeros(len(t), bool)
    if len(t) >= 9:
        rej |= _hampel(x, 7, 100.0) | _hampel(y, 7, 100.0) | _hampel(alt, 7, 60.0)
    if rej.any():
        sel = ~rej
        t, lat, lon, alt, x, y = t[sel], lat[sel], lon[sel], alt[sel], x[sel], y[sel]
        extras = {k: (v[sel], h) for k, (v, h) in extras.items()}
    n_rejected = int(rej.sum())
    if n_rejected:
        warnings.append(f"{n_rejected} spike samples rejected")

    native = np.diff(t)
    native_dt = float(np.median(native))
    t0 = float(t[0])
    tr = np.arange(0.0, t[-1] - t0 + 1e-9, DT)
    ts = t - t0
    xr, yr = np.interp(tr, ts, x), np.interp(tr, ts, y)
    ar = np.interp(tr, ts, alt)
    # Mark resampled points that fall inside a long gap as invalid.
    idx = np.clip(np.searchsorted(ts, tr, side="right") - 1, 0, len(ts) - 2)
    gap_len = ts[idx + 1] - ts[idx]
    valid = ~((gap_len > GAP_S) & (tr - ts[idx] > 0) & (tr < ts[idx + 1]))
    n_gaps = int((native > GAP_S).sum())
    if n_gaps:
        warnings.append(f"{n_gaps} data gaps longer than {GAP_S:.0f}s")
    if native_dt > 5:
        warnings.append(f"sparse log (median interval {native_dt:.1f}s); derived rates are coarse")

    wp = _win(9 if native_dt <= 2 else 9 + 2 * native_dt, len(tr))
    wa = _win(11 if native_dt <= 2 else 11 + 2 * native_dt, len(tr))
    xs = savgol_filter(xr, wp, 2)
    ys = savgol_filter(yr, wp, 2)
    vx = savgol_filter(xr, wp, 2, deriv=1, delta=DT)
    vy = savgol_filter(yr, wp, 2, deriv=1, delta=DT)
    alt_s = savgol_filter(ar, wa, 2)
    vs = savgol_filter(ar, wa, 2, deriv=1, delta=DT)
    gs = np.hypot(vx, vy)
    course = np.degrees(np.arctan2(vx, vy)) % 360.0
    unwrapped = np.unwrap(np.radians(course))
    turn = np.degrees(savgol_filter(unwrapped, wp, 2, deriv=1, delta=DT))
    turn[gs < 5.0] = 0.0
    acc = savgol_filter(gs, wp, 2, deriv=1, delta=DT)
    lat_r, lon_r = np.interp(tr, ts, lat), np.interp(tr, ts, lon)

    recorded = _calibrate_recorded(extras, ts, tr, gs, vs, course, warnings)
    quality = {
        "input_samples": int(n_in), "usable_samples": int(len(t)), "rejected_samples": n_rejected,
        "native_interval_s": round(native_dt, 2), "gaps": n_gaps,
        "duration_s": float(tr[-1]), "recorded_fields": sorted(recorded.keys()),
    }
    return Track(name=raw.name, source=raw.source, t0=t0, t=tr, lat=lat_r, lon=lon_r, lat0=lat0, lon0=lon0,
                 x=xs, y=ys, alt=alt_s, alt_raw=ar, vx=vx, vy=vy, gs=gs, course=course, turn=turn, vs=vs,
                 acc=acc, valid=valid, quality=quality, warnings=warnings, recorded=recorded)


_SPEED_UNITS = {"mps": 1.0, "kt": 0.514444, "mph": 0.44704, "kph": 0.277778}
_VS_UNITS = {"mps": 1.0, "fpm": 0.00508, "fps": 0.3048}


def _best_scale(ratio, units, hint):
    if hint in units:
        return hint, units[hint]
    name = min(units, key=lambda u: abs(np.log(ratio / units[u])))
    return name, units[name]


def _calibrate_recorded(extras, ts, tr, gs, vs, course, warnings):
    """Resample recorded speed / course / vs and infer units against derived values."""
    out = {}
    if "speed" in extras:
        vals, hint = extras["speed"]
        rs = np.interp(tr, ts, np.nan_to_num(vals, nan=np.nanmedian(vals)))
        m = (gs > 10) & (rs > 0)
        if m.sum() > 20:
            ratio = float(np.median(gs[m] / rs[m]))
            unit, k = _best_scale(ratio, _SPEED_UNITS, None)
            if hint and hint != unit:
                warnings.append(f"recorded speed labelled {hint} but matches {unit}; using {unit}")
            out["speed"] = rs * k
            out["speed_unit"] = unit
            out["speed_rmse_kt"] = float(np.sqrt(np.mean((out["speed"][m] - gs[m]) ** 2)) * MPS_TO_KT)
    if "vs" in extras:
        vals, hint = extras["vs"]
        rv = np.interp(tr, ts, np.nan_to_num(vals))
        m = np.abs(vs) > 1.0
        if m.sum() > 20 and np.abs(rv[m]).max() > 0:
            ratio = float(np.median(np.abs(vs[m]) / np.maximum(np.abs(rv[m]), 1e-9)))
            unit, k = _best_scale(ratio, _VS_UNITS, None)
            out["vs"] = rv * k
            out["vs_unit"] = unit
    for key, label in (("acc_h", "horiz"), ("acc_v", "vert")):
        if key in extras:       # reported GPS accuracy (metres); median and 95th percentile over the log
            v = extras[key][0]
            v = v[np.isfinite(v)]
            if v.size:
                out[f"gps_acc_{label}_median_m"] = float(np.median(v))
                out[f"gps_acc_{label}_p95_m"] = float(np.percentile(v, 95))
    if "course" in extras:
        vals, _ = extras["course"]
        rc = np.interp(tr, ts, np.nan_to_num(vals)) % 360.0
        m = gs > 10
        if m.sum() > 20:
            out["course_rmse_deg"] = float(np.sqrt(np.mean(wrap180(rc[m] - course[m]) ** 2)))
    return out


def bank_angle_deg(gs, turn_dps):
    """Coordinated-turn bank implied by ground speed and turn rate."""
    return np.degrees(np.arctan(gs * np.radians(np.abs(turn_dps)) / G))
