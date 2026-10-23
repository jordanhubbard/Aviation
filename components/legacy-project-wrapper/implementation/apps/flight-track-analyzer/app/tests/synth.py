"""Synthetic flight generator with known truth, exported as ForeFlight / Garmin style KML.

Runway 27 (heading 270), left-hand pattern. Local frame: x east, y north, metres.
"""
from __future__ import annotations

import math
import sys
from datetime import datetime, timedelta, timezone

import numpy as np

LAT0, LON0 = 37.0, -122.0
R_EARTH = 6378137.0
FIELD_M = 300.0
GEOID_BIAS_M = 30.0
KT = 0.514444
FT = 0.3048


class Sim:
    def __init__(self, wind_from=240.0, wind_kt=10.0, seed=1, gps_pos=1.5, gps_alt=2.5):
        self.rng = np.random.default_rng(seed)
        wd = math.radians((wind_from + 180) % 360)
        self.w = np.array([wind_kt * KT * math.sin(wd), wind_kt * KT * math.cos(wd)])
        self.wind_from, self.wind_kt = wind_from, wind_kt
        self.x, self.y, self.agl = 700.0, -60.0, 0.0
        self.trk = 270.0
        self.gs = 0.0
        self.tas = 0.0
        self.vs = 0.0
        self.air = False
        self.t = 0.0
        self.rows = []
        self.truth = {"takeoffs": [], "landings": [], "laps": []}
        self.leg = "ground"
        self.gps_pos, self.gps_alt = gps_pos, gps_alt
        self._an = 0.0
        self._next = 0.0

    # --- integration -------------------------------------------------------
    def _d(self):
        a = math.radians(self.trk)
        return np.array([math.sin(a), math.cos(a)])

    def _record(self):
        while self._next <= self.t + 1e-9:
            self._an = 0.9 * self._an + math.sqrt(1 - 0.81) * self.rng.normal(0, self.gps_alt)
            self.rows.append((self._next, self.x + self.rng.normal(0, self.gps_pos),
                              self.y + self.rng.normal(0, self.gps_pos),
                              FIELD_M + GEOID_BIAS_M + self.agl + self._an, self.leg,
                              self.agl, self.tas, self.gs))
            self._next += 1.0

    def step(self, dt, trk_tgt=None, tas_tgt=None, vs_tgt=None, acc=None, turn_rate=3.0):
        if trk_tgt is not None:
            err = (trk_tgt - self.trk + 180) % 360 - 180
            self.trk = (self.trk + float(np.clip(err, -turn_rate * dt, turn_rate * dt))) % 360
        d = self._d()
        if self.air:
            if tas_tgt is not None:
                self.tas += float(np.clip(tas_tgt - self.tas, -1.0 * dt, 1.0 * dt))
            dw = float(d @ self.w)
            k = dw + math.sqrt(max(dw * dw - self.w @ self.w + self.tas ** 2, 0.0))
            self.gs = k
            if vs_tgt is not None:
                self.vs += float(np.clip(vs_tgt - self.vs, -1.0 * dt, 1.0 * dt))
            self.agl = max(self.agl + self.vs * dt, 0.0)
        else:
            self.gs = max(self.gs + (acc or 0.0) * dt, 0.0)
            dw = float(d @ self.w)
            self.tas = self.gs - dw
        self.x += d[0] * self.gs * dt
        self.y += d[1] * self.gs * dt
        self.t += dt
        self._record()

    def hold(self, secs):
        n = int(secs / 0.25)
        for _ in range(n):
            self.gs = 0.0
            self.step(0.25, acc=0.0)

    # --- manoeuvres --------------------------------------------------------
    def taxi_to_runway(self, rolling=False):
        self.leg = "taxi"
        while self.x > 500.0:
            self.step(0.25, trk_tgt=270.0, acc=1.0 if self.gs < 6 else 0.0)
        if rolling:
            return   # keep rolling at taxi speed straight into the take-off
        while self.gs > 0.2:
            self.step(0.25, acc=-1.5)
        self.hold(10)

    def takeoff_roll(self, accel=1.2, vr=30.0, record_truth=True, kind="takeoff"):
        self.leg = "takeoff_roll"
        x_start, t_start = self.x, self.t
        while self.tas < vr:
            self.step(0.25, trk_tgt=270.0, acc=accel)
        self.air = True
        self.vs = 0.0
        self.agl = 0.0
        if record_truth:
            self.truth["takeoffs"].append({
                "kind": kind, "t_lof": self.t, "x_lof": self.x, "ground_roll_m": abs(self.x - x_start) if kind == "takeoff" else None,
                "gs_lof": self.gs, "headwind": -float(self._d() @ self.w), "t_start": t_start,
                "agl_target_m": None})
        t_air = self.t
        while self.agl < OBST:
            self.step(0.25, trk_tgt=270.0, tas_tgt=38.0, vs_tgt=3.5)
        self.truth["takeoffs"][-1]["dist50_m"] = (abs(self.x - x_start) if kind == "takeoff" else None)

    def circuit(self, agl_target, td_x, tas_dw=45.0, full_stop=False, tas_final=36.0):
        lap = {"agl_target_m": agl_target, "downwind_tas": tas_dw}
        self.leg = "upwind"
        while self.x > -1300:
            self.step(0.25, trk_tgt=270.0, tas_tgt=38.0, vs_tgt=float(np.clip(0.2 * (agl_target - self.agl), -3, 3.5)))
        self.leg = "crosswind"
        while self.trk > 182 or self.trk < 90:
            self.step(0.25, trk_tgt=180.0, tas_tgt=42.0, vs_tgt=float(np.clip(0.2 * (agl_target - self.agl), -3, 3.5)))
        while self.y > -950:
            self.step(0.25, trk_tgt=180.0, tas_tgt=42.0, vs_tgt=float(np.clip(0.2 * (agl_target - self.agl), -3, 3.5)))
        self.leg = "downwind"
        while self.x < 1800:
            self.step(0.25, trk_tgt=90.0, tas_tgt=tas_dw, vs_tgt=float(np.clip(0.2 * (agl_target - self.agl), -3, 3.5)))
        self.leg = "base"
        while self.y < -700:
            self.step(0.25, trk_tgt=0.0, tas_tgt=40.0, vs_tgt=-2.5)
        self.leg = "final"
        tan3 = math.tan(math.radians(3.0))
        td_pending = True
        t_50 = None
        while td_pending:
            trk = 270.0 - float(np.clip(self.y * 0.03, -15, 15))
            tgt = max((self.x - td_x) * tan3, 0.0)
            if self.agl <= 4.0:
                vs = -0.7
            else:
                vs = float(np.clip(1.0 * (tgt - self.agl), -4.0, 1.0))
            self.step(0.25, trk_tgt=trk, tas_tgt=tas_final if self.agl > 6 else 33.0, vs_tgt=vs, turn_rate=2.0)
            if t_50 is None and self.agl < OBST:
                t_50 = (self.t, self.x, self.tas, self.gs)
            if self.agl <= 0.0:
                td_pending = False
        self.air = False
        self.vs = 0.0
        L = {"t_td": self.t, "x_td": self.x, "gs_td": self.gs, "x_50": t_50[1], "t_50": t_50[0],
             "tas_50": t_50[2], "gs_50": t_50[3], "headwind": -float(self._d() @ self.w), "kind": None}
        lap.update({"x_td": self.x, "lap_end": self.t})
        self.truth["laps"].append(lap)
        self.leg = "landing_roll"
        if full_stop:
            while self.gs > 7.7:
                self.step(0.25, trk_tgt=270.0, acc=-1.5)
            L["x_end"] = self.x
            L["kind"] = "landing"
            L["dist50_m"] = L["x_50"] - self.x
            L["roll_m"] = L["x_td"] - self.x
            while self.gs > 0.2:
                self.step(0.25, trk_tgt=270.0, acc=-1.5)
            self.hold(30)
        else:
            L["kind"] = "touch_and_go"
            t_end = self.t + 6.0
            while self.t < t_end:
                self.step(0.25, trk_tgt=270.0, acc=0.0)
            self.truth["landings"].append(L)
            self.takeoff_roll(accel=1.0, vr=33.0, record_truth=True, kind="touch_and_go")
            return
        self.truth["landings"].append(L)

    def run_standard(self, wind_noise=True, rolling=False):
        self.hold(60)
        self.taxi_to_runway(rolling)
        self.takeoff_roll()
        self.circuit(305.0, 200.0, 45.0)
        self.circuit(320.0, 260.0, 47.0)
        self.circuit(290.0, 150.0, 43.0, full_stop=True)
        # taxi back (short), then stop
        self.leg = "taxi"
        self.trk = 90.0
        while self.x < 650:
            self.step(0.25, trk_tgt=90.0, acc=1.0 if self.gs < 6 else 0.0)
        while self.gs > 0.2:
            self.step(0.25, acc=-1.5)
        self.hold(60)
        return self


OBST = 15.24


def run_xc(sim: "Sim", tas=55.0, agl_m=1200.0, leg_s=240.0):
    """Take off, climb, then fly four steady level legs on N/E/S/W tracks; the log ends airborne."""
    sim.hold(60)
    sim.taxi_to_runway()
    sim.takeoff_roll()
    sim.leg = "climb"
    while sim.agl < agl_m:
        sim.step(0.25, trk_tgt=270.0, tas_tgt=38.0, vs_tgt=3.5)
    for trk in (0.0, 90.0, 180.0, 270.0, 0.0):
        sim.leg = f"xc{int(trk)}"
        t_end = sim.t + leg_s
        while sim.t < t_end:
            sim.step(0.25, trk_tgt=trk, tas_tgt=tas, vs_tgt=float(np.clip(0.2 * (agl_m - sim.agl), -2, 2)))
    return sim


def to_latlon(x, y):
    lat = LAT0 + math.degrees(y / R_EARTH)
    lon = LON0 + math.degrees(x / (R_EARTH * math.cos(math.radians(LAT0))))
    return lat, lon


def _iso(t0, t):
    return (t0 + timedelta(seconds=float(t))).strftime("%Y-%m-%dT%H:%M:%SZ")


def foreflight_kml(sim: Sim, t0=None, name="ForeFlight Track Log") -> bytes:
    t0 = t0 or datetime(2025, 6, 14, 17, 0, 0, tzinfo=timezone.utc)
    whens, coords, spd, crs = [], [], [], []
    prev = None
    for (t, x, y, alt, *_r) in sim.rows:
        lat, lon = to_latlon(x, y)
        whens.append(f"<when>{_iso(t0, t)}</when>")
        coords.append(f"<gx:coord>{lon:.7f} {lat:.7f} {alt:.2f}</gx:coord>")
        if prev:
            dx, dy = x - prev[0], y - prev[1]
            spd.append(math.hypot(dx, dy)); crs.append(math.degrees(math.atan2(dx, dy)) % 360)
        else:
            spd.append(0.0); crs.append(0.0)
        prev = (x, y)
    arr = lambda nm, v: f'<gx:SimpleArrayData name="{nm}">' + "".join(f"<gx:value>{a:.2f}</gx:value>" for a in v) + "</gx:SimpleArrayData>"
    return f"""<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2" xmlns:gx="http://www.google.com/kml/ext/2.2">
<Document><name>{name}</name>
<Schema id="s"><gx:SimpleArrayField name="speed" type="float"/><gx:SimpleArrayField name="course" type="float"/></Schema>
<Placemark><name>N172KM 2025-06-14</name>
<gx:Track><altitudeMode>absolute</altitudeMode>
{''.join(whens)}
{''.join(coords)}
<ExtendedData><SchemaData schemaUrl="#s">{arr('speed', spd)}{arr('course', crs)}</SchemaData></ExtendedData>
</gx:Track></Placemark></Document></kml>""".encode()


def garmin_kml(sim: Sim, t0=None) -> bytes:
    t0 = t0 or datetime(2025, 6, 15, 15, 0, 0, tzinfo=timezone.utc)
    pms = []
    prev = None
    for (t, x, y, alt, *_r) in sim.rows[::2]:  # Garmin logs here at 0.5 Hz
        lat, lon = to_latlon(x, y)
        if prev:
            dt = t - prev[2]
            v = math.hypot(x - prev[0], y - prev[1]) / dt / KT
            c = math.degrees(math.atan2(x - prev[0], y - prev[1])) % 360
        else:
            v, c = 0.0, 0.0
        prev = (x, y, t)
        pms.append(f"<Placemark><TimeStamp><when>{_iso(t0, t)}</when></TimeStamp>"
                   f"<description>Speed: {v:.1f} kt Course: {c:.0f} deg</description>"
                   f"<Point><coordinates>{lon:.7f},{lat:.7f},{alt:.1f}</coordinates></Point></Placemark>")
    return ("""<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2"><Document><name>Garmin Pilot flight</name>"""
            + "".join(pms) + "</Document></kml>").encode()


if __name__ == "__main__":
    out = sys.argv[1] if len(sys.argv) > 1 else "."
    s1 = Sim(240, 10, seed=1).run_standard()
    s2 = Sim(300, 14, seed=2).run_standard()
    open(f"{out}/demo_foreflight.kml", "wb").write(foreflight_kml(s1))
    open(f"{out}/demo_garmin.kml", "wb").write(garmin_kml(s2))
    print("wrote demo_foreflight.kml demo_garmin.kml")
