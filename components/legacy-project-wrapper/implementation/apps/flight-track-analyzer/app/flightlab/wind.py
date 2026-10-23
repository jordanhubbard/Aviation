"""Wind and true-airspeed estimation from ground-velocity vectors (SciPy least squares).

Ground velocity = TAS * (unit heading) + wind, so velocities taken on varied headings at a
constant TAS lie on a circle of radius TAS centred on the wind vector.

Identifiability caveat, stated in every result: if TAS differs between headings (fast downwind,
slow final, as in a traffic pattern) the circle centre is biased toward the fast legs. Wind is
therefore graded:
  high - steady, straight, level legs on >= 3 distinct headings (cross-country flying);
  low  - circle fit over all airborne samples (pattern work); approximate, biased by speed
         differences between legs, so zero-wind normalisation is withheld.
Per-leg airspeed *deviations* are insensitive to a constant wind bias either way.
"""
from __future__ import annotations

import numpy as np
from scipy.optimize import least_squares

MIN_SAMPLES = 90
MIN_LEG_S = 60


def _circle(vx, vy, weights=None, f_scale=2.0):
    gs = np.hypot(vx, vy)
    w = np.ones_like(vx) if weights is None else weights

    def resid(p):
        return w * (np.hypot(vx - p[0], vy - p[1]) - p[2])

    lo, hi = np.array([-100.0, -100.0, 10.0]), np.array([100.0, 100.0, 350.0])   # up to jet speeds
    # Start from calm air at the mean ground speed (a mean *velocity* start can fall outside the bounds
    # on a fast, mostly one-directional flight), and keep the start strictly inside the bounds.
    x0 = np.clip([0.0, 0.0, gs.mean()], lo + 1e-6, hi - 1e-6)
    sol = least_squares(resid, x0, loss="soft_l1", f_scale=f_scale, bounds=(lo, hi))
    we, wn, tas = sol.x
    rms = float(np.sqrt(np.mean(((np.hypot(vx - we, vy - wn) - tas)) ** 2)))
    return float(we), float(wn), float(tas), rms


def _octants(vx, vy):
    ang = np.arctan2(vx - vx.mean(), vy - vy.mean())
    return np.clip(((ang + np.pi) / (2 * np.pi) * 8).astype(int), 0, 7), ang


def _legs(track, air):
    m = air & track.valid & (track.gs > 20.0) & (np.abs(track.turn) < 0.7) \
        & (np.abs(track.acc) < 0.25) & (np.abs(track.vs) < 1.5)
    legs, i, n = [], 0, track.n
    while i < n:
        if m[i]:
            j = i
            while j + 1 < n and m[j + 1]:
                j += 1
            if j - i + 1 >= MIN_LEG_S:
                legs.append((float(track.vx[i:j + 1].mean()), float(track.vy[i:j + 1].mean()), j - i + 1))
            i = j + 1
        else:
            i += 1
    return legs


def _distinct_headings(legs, sep=40.0):
    hs = sorted(np.degrees(np.arctan2(l[0], l[1])) % 360 for l in legs)
    kept = []
    for h in hs:
        if all(min(abs(h - k), 360 - abs(h - k)) >= sep for k in kept):
            kept.append(h)
    return len(kept)


def fit_flight_wind(track, air) -> dict | None:
    """Best wind estimate for the flight, or None when nothing sensible can be fitted."""
    legs = _legs(track, air)
    if len(legs) >= 3 and _distinct_headings(legs) >= 3:
        vx = np.array([l[0] for l in legs]); vy = np.array([l[1] for l in legs])
        w = np.sqrt(np.array([l[2] for l in legs], float))
        w /= w.mean()
        we, wn, tas, rms = _circle(vx, vy, w, f_scale=1.0)
        if rms < 0.04 * tas:
            return _pack(we, wn, tas, rms, "high", len(legs), "steady-legs", 1.5)
    m = air & track.valid & (track.gs > 20.0)
    if m.sum() < MIN_SAMPLES:
        return None
    vx, vy = track.vx[m], track.vy[m]
    octant, ang = _octants(vx, vy)
    occ = np.bincount(octant, minlength=8).astype(float)
    covered = int((occ >= max(3, 0.04 * len(vx))).sum())
    resultant = float(np.hypot(np.cos(ang).mean(), np.sin(ang).mean()))
    if covered < 5 or resultant > 0.55:
        return None
    wts = np.sqrt(1.0 / np.maximum(occ[octant], 1.0))
    wts /= wts.mean()
    we, wn, tas, rms = _circle(vx, vy, wts)
    if rms > 0.12 * tas:
        return None
    return _pack(we, wn, tas, rms, "low", int(m.sum()), "all-airborne", max(0.12 * tas, 3.0))


def _pack(we, wn, tas, rms, conf, n, basis, unc):
    return {"we": we, "wn": wn, "tas": tas, "rms": rms, "confidence": conf, "n": int(n), "basis": basis,
            "uncertainty": float(unc), "from_deg": float(np.degrees(np.arctan2(-we, -wn)) % 360.0),
            "speed": float(np.hypot(we, wn))}
