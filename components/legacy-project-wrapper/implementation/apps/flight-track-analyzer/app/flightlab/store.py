"""SQLite persistence. The aircraft tail (N-number) is the leading primary-key column of every table.

  aircraft(tail PK)
  flights(tail, flight_id)              PK; flight_id also UNIQUE (a flight belongs to exactly one aircraft)
  flight_conditions(tail, flight_id)    PK; OAT / altimeter / weight / reported wind
  events(tail, flight_id, kind, seq)    PK; one row per take-off / landing
  patterns(tail, flight_id, seq)        PK; one row per analysed traffic pattern
  poh_reference(tail, type, pa_ft, oat_c) PK; documented AFM/POH table values
  poh_meta(tail)                        PK

Child tables reference their parent with ON UPDATE CASCADE / ON DELETE CASCADE, so re-tagging a flight with
another tail moves every dependent row, and deleting a flight removes them. Raw KML stays on disk keyed by
content hash. Every flight must be given a tail when it is uploaded.
"""
from __future__ import annotations

import hashlib
import json
import os
import re
import sqlite3
import threading
from contextlib import contextmanager
from pathlib import Path

from .analyze import SCHEMA, analyze
from .kml import parse_kml

_ID = re.compile(r"^[0-9a-f]{12}-\d+$")
_TAIL = re.compile(r"^[A-Z0-9-]{1,10}$")

DDL = """
CREATE TABLE IF NOT EXISTS aircraft (
  tail TEXT NOT NULL PRIMARY KEY CHECK (length(tail) BETWEEN 1 AND 10),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now'))
);
CREATE TABLE IF NOT EXISTS flights (
  tail TEXT NOT NULL REFERENCES aircraft(tail) ON UPDATE CASCADE ON DELETE CASCADE,
  flight_id TEXT NOT NULL UNIQUE,
  name TEXT, source TEXT, filename TEXT, start_iso TEXT NOT NULL, duration_s REAL,
  schema_version INTEGER NOT NULL, summary_json TEXT NOT NULL, analysis_json TEXT NOT NULL,
  PRIMARY KEY (tail, flight_id)
);
CREATE TABLE IF NOT EXISTS flight_conditions (
  tail TEXT NOT NULL, flight_id TEXT NOT NULL,
  oat_c REAL, altimeter_inhg REAL, weight_lb REAL, wind_from_deg REAL, wind_kt REAL,
  PRIMARY KEY (tail, flight_id),
  FOREIGN KEY (tail, flight_id) REFERENCES flights(tail, flight_id) ON UPDATE CASCADE ON DELETE CASCADE
);
CREATE TABLE IF NOT EXISTS events (
  tail TEXT NOT NULL, flight_id TEXT NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('takeoff','landing')), seq INTEGER NOT NULL,
  event_kind TEXT, style TEXT, t_iso TEXT, runway TEXT, field_elev_ft REAL,
  ground_roll_ft REAL, total50_ft REAL, gs_kt REAL, speed50_kt REAL, sink_fpm REAL,
  headwind_kt REAL, uncertainty_ft REAL, zw_ground_roll_ft REAL, zw_total50_ft REAL,
  PRIMARY KEY (tail, flight_id, kind, seq),
  FOREIGN KEY (tail, flight_id) REFERENCES flights(tail, flight_id) ON UPDATE CASCADE ON DELETE CASCADE
);
CREATE TABLE IF NOT EXISTS patterns (
  tail TEXT NOT NULL, flight_id TEXT NOT NULL, seq INTEGER NOT NULL,
  runway TEXT, side TEXT, straight_in INTEGER, downwind_agl_ft REAL, downwind_offset_ft REAL,
  glidepath_deg REAL, centerline_err_std_ft REAL, max_bank_deg REAL,
  PRIMARY KEY (tail, flight_id, seq),
  FOREIGN KEY (tail, flight_id) REFERENCES flights(tail, flight_id) ON UPDATE CASCADE ON DELETE CASCADE
);
CREATE TABLE IF NOT EXISTS poh_meta (
  tail TEXT NOT NULL PRIMARY KEY REFERENCES aircraft(tail) ON UPDATE CASCADE ON DELETE CASCADE,
  weight_lb REAL, notes TEXT NOT NULL DEFAULT ''
);
CREATE TABLE IF NOT EXISTS poh_reference (
  tail TEXT NOT NULL REFERENCES aircraft(tail) ON UPDATE CASCADE ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('takeoff','landing')),
  pa_ft REAL NOT NULL, oat_c REAL NOT NULL, ground_roll_ft REAL, total50_ft REAL,
  PRIMARY KEY (tail, type, pa_ft, oat_c)
);
CREATE INDEX IF NOT EXISTS flights_start ON flights(start_iso);
"""
META_KEYS = ("oat_c", "altimeter_inhg", "weight_lb", "wind_from_deg", "wind_kt")


class Store:
    def __init__(self, root: str | os.PathLike):
        self.root = Path(root)
        (self.root / "raw").mkdir(parents=True, exist_ok=True)
        self.db_path = self.root / "kmlab.sqlite3"
        self._lock = threading.RLock()
        with self._tx() as c:
            c.executescript(DDL)

    # ------------------------------------------------------------------ plumbing
    @contextmanager
    def _tx(self):
        with self._lock:
            c = sqlite3.connect(self.db_path, timeout=30)
            c.row_factory = sqlite3.Row
            c.execute("PRAGMA foreign_keys=ON")
            c.execute("PRAGMA journal_mode=WAL")
            try:
                yield c
                c.commit()
            except Exception:
                c.rollback()
                raise
            finally:
                c.close()

    @staticmethod
    def valid_id(fid: str) -> bool:
        return bool(_ID.match(fid or ""))

    @staticmethod
    def valid_tail(t: str) -> bool:
        return bool(_TAIL.match(t or ""))

    # ------------------------------------------------------------------ flights
    def ingest(self, data: bytes, filename: str, aircraft: str) -> list[dict]:
        """Parse, analyse and store one uploaded file for `aircraft`. One result per flight in the file."""
        if not self.valid_tail(aircraft):
            raise ValueError("invalid aircraft tail")
        digest = hashlib.sha256(data).hexdigest()[:12]
        tracks = parse_kml(data, filename)       # raises KmlError for bad input
        (self.root / "raw" / f"{digest}.kml").write_bytes(data)
        out = []
        for i, raw in enumerate(tracks):
            fid = f"{digest}-{i}"
            existing = self._tail_of(fid)
            if existing is not None:
                self._move(fid, existing, aircraft)          # re-upload with a tail corrects the association
                out.append({**self.get(fid)["summary"], "aircraft": aircraft, "duplicate": True})
                continue
            try:
                a = analyze(raw, fid)
            except Exception as e:
                out.append({"id": fid, "name": raw.name, "error": f"analysis failed: {e}"})
                continue
            a["filename"] = filename
            a["summary"]["filename"] = filename
            self._save(aircraft, a)
            out.append({**a["summary"], "aircraft": aircraft, "duplicate": False})
        return out

    def _tail_of(self, fid: str) -> str | None:
        with self._tx() as c:
            r = c.execute("SELECT tail FROM flights WHERE flight_id=?", (fid,)).fetchone()
        return r["tail"] if r else None

    def _save(self, tail: str, a: dict):
        """Insert or replace the flight and its derived event / pattern rows (conditions are kept)."""
        with self._tx() as c:
            c.execute("INSERT OR IGNORE INTO aircraft(tail) VALUES (?)", (tail,))
            c.execute("DELETE FROM events WHERE flight_id=?", (a["id"],))
            c.execute("DELETE FROM patterns WHERE flight_id=?", (a["id"],))
            conds = c.execute("SELECT * FROM flight_conditions WHERE flight_id=?", (a["id"],)).fetchone()
            c.execute("DELETE FROM flights WHERE flight_id=?", (a["id"],))          # cascades the conditions row
            c.execute("INSERT INTO flights(tail, flight_id, name, source, filename, start_iso, duration_s, schema_version,"
                      " summary_json, analysis_json) VALUES (?,?,?,?,?,?,?,?,?,?)",
                      (tail, a["id"], a["name"], a["source"], a.get("filename"), a["start_iso"], a["duration_s"], SCHEMA,
                       json.dumps(a["summary"], separators=(",", ":")), json.dumps(a, separators=(",", ":"))))
            if conds:
                c.execute("INSERT INTO flight_conditions(tail, flight_id, oat_c, altimeter_inhg, weight_lb, wind_from_deg, wind_kt)"
                          " VALUES (?,?,?,?,?,?,?)", (tail, a["id"], *[conds[k] for k in META_KEYS]))
            for n, t in enumerate(a["takeoffs"]):
                c.execute("INSERT INTO events(tail, flight_id, kind, seq, event_kind, style, t_iso, runway, field_elev_ft, ground_roll_ft,"
                          " total50_ft, gs_kt, headwind_kt, uncertainty_ft, zw_ground_roll_ft, zw_total50_ft) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
                          (tail, a["id"], "takeoff", n, t["kind"], t.get("style"), t.get("t_iso"), t["runway"], t["field_elev_ft"],
                           t["ground_roll_ft"], t.get("dist50_ft"), t["gs_lof_kt"], t.get("headwind_kt"), t["timing_uncertainty_ft"],
                           t.get("zero_wind_roll_ft"), t.get("zero_wind_dist50_ft")))
            for n, l in enumerate(a["landings"]):
                c.execute("INSERT INTO events(tail, flight_id, kind, seq, event_kind, style, t_iso, runway, field_elev_ft, ground_roll_ft,"
                          " total50_ft, gs_kt, speed50_kt, sink_fpm, headwind_kt, uncertainty_ft, zw_ground_roll_ft, zw_total50_ft)"
                          " VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
                          (tail, a["id"], "landing", n, l["kind"], l.get("type"), l.get("t_iso"), l["runway"], l["field_elev_ft"],
                           l["roll_ft"], l.get("dist50_ft"), l["gs_td_kt"], l.get("tas_50_kt") if l.get("tas_50_kt") is not None else l["gs_50_kt"],
                           l["sink_fpm"], l.get("headwind_kt"), l["timing_uncertainty_ft"], l.get("zero_wind_roll_ft"), l.get("zero_wind_dist50_ft")))
            for n, p in enumerate(a["patterns"]):
                dw = (p.get("legs") or {}).get("downwind") or {}
                fin = p.get("final") or {}
                c.execute("INSERT INTO patterns(tail, flight_id, seq, runway, side, straight_in, downwind_agl_ft, downwind_offset_ft,"
                          " glidepath_deg, centerline_err_std_ft, max_bank_deg) VALUES (?,?,?,?,?,?,?,?,?,?,?)",
                          (tail, a["id"], n, p.get("runway"), p.get("side"), int(bool(p.get("straight_in"))), dw.get("agl_ft"),
                           dw.get("offset_ft"), fin.get("glidepath_deg"), fin.get("centerline_err_std_ft"), p.get("max_bank_deg")))

    def _move(self, fid: str, old: str, new: str):
        """Re-tag a flight; ON UPDATE CASCADE carries its conditions, events and patterns along."""
        if old == new:
            return
        with self._tx() as c:
            c.execute("INSERT OR IGNORE INTO aircraft(tail) VALUES (?)", (new,))
            c.execute("UPDATE flights SET tail=? WHERE flight_id=?", (new, fid))

    def get(self, fid: str, target_agl_ft: float | None = None) -> dict | None:
        if not self.valid_id(fid):
            return None
        with self._tx() as c:
            r = c.execute("SELECT tail, schema_version, analysis_json, filename FROM flights WHERE flight_id=?", (fid,)).fetchone()
        if r is None:
            return None
        a = json.loads(r["analysis_json"])
        if r["schema_version"] != SCHEMA:
            a = self._reanalyse(fid, r["tail"], None, persist=True) or a
        if target_agl_ft:
            a = self._reanalyse(fid, r["tail"], target_agl_ft, persist=False) or a
        a["aircraft"] = r["tail"]
        return a

    def _reanalyse(self, fid, tail, target=None, persist=True):
        digest, idx = fid.split("-")
        raw_path = self.root / "raw" / f"{digest}.kml"
        if not raw_path.exists():
            return None
        tracks = parse_kml(raw_path.read_bytes())
        if int(idx) >= len(tracks):
            return None
        a = analyze(tracks[int(idx)], fid, target)
        with self._tx() as c:
            r = c.execute("SELECT filename FROM flights WHERE flight_id=?", (fid,)).fetchone()
        a["filename"] = r["filename"] if r else None
        a["summary"]["filename"] = a["filename"]
        if persist:
            self._save(tail, a)
        return a

    def list(self, aircraft: str | None = None) -> list[dict]:
        q = "SELECT tail, summary_json FROM flights" + (" WHERE tail=?" if aircraft else "") + " ORDER BY start_iso DESC"
        with self._tx() as c:
            rows = c.execute(q, (aircraft,) if aircraft else ()).fetchall()
        out = []
        for r in rows:
            s = json.loads(r["summary_json"])
            s["aircraft"] = r["tail"]
            out.append(s)
        return out

    def delete(self, fid: str) -> bool:
        if not self.valid_id(fid):
            return False
        with self._tx() as c:
            n = c.execute("DELETE FROM flights WHERE flight_id=?", (fid,)).rowcount
            left = c.execute("SELECT 1 FROM flights WHERE flight_id LIKE ?", (fid.split("-")[0] + "-%",)).fetchone()
        if n and not left:
            (self.root / "raw" / f"{fid.split('-')[0]}.kml").unlink(missing_ok=True)
        return bool(n)

    # ------------------------------------------------------------------ conditions and aircraft
    def get_meta(self, fid: str) -> dict:
        with self._tx() as c:
            r = c.execute("SELECT f.tail, fc.oat_c, fc.altimeter_inhg, fc.weight_lb, fc.wind_from_deg, fc.wind_kt FROM flights f"
                          " LEFT JOIN flight_conditions fc ON fc.tail=f.tail AND fc.flight_id=f.flight_id WHERE f.flight_id=?", (fid,)).fetchone()
        if r is None:
            return {"aircraft": None, **{k: None for k in META_KEYS}}
        return {"aircraft": r["tail"], **{k: r[k] for k in META_KEYS}}

    def set_meta(self, fid: str, meta: dict) -> dict:
        """Update conditions; a different `aircraft` re-tags the flight (all dependent rows follow)."""
        old = self._tail_of(fid)
        if old is None:
            raise KeyError(fid)
        new = meta.get("aircraft") or old
        if not self.valid_tail(new):
            raise ValueError("invalid aircraft tail")
        self._move(fid, old, new)
        with self._tx() as c:
            c.execute("INSERT INTO flight_conditions(tail, flight_id) VALUES (?,?) ON CONFLICT(tail, flight_id) DO NOTHING", (new, fid))
            c.execute("UPDATE flight_conditions SET oat_c=?, altimeter_inhg=?, weight_lb=?, wind_from_deg=?, wind_kt=? WHERE tail=? AND flight_id=?",
                      (*[meta.get(k) for k in META_KEYS], new, fid))
        return self.get_meta(fid)

    def aircraft_list(self) -> list[dict]:
        with self._tx() as c:
            rows = c.execute("SELECT a.tail, (SELECT count(*) FROM flights f WHERE f.tail=a.tail) AS flights,"
                             " (SELECT count(*) FROM poh_reference p WHERE p.tail=a.tail) AS poh_rows FROM aircraft a ORDER BY a.tail").fetchall()
        return [{"tail": r["tail"], "flights": r["flights"], "has_poh": r["poh_rows"] > 0} for r in rows]

    def get_poh(self, tail: str) -> dict:
        out = {"takeoff": [], "landing": [], "weight_lb": None, "notes": ""}
        with self._tx() as c:
            for r in c.execute("SELECT type, pa_ft, oat_c, ground_roll_ft, total50_ft FROM poh_reference WHERE tail=? ORDER BY type, pa_ft, oat_c", (tail,)):
                out[r["type"]].append({"pa_ft": r["pa_ft"], "oat_c": r["oat_c"], "ground_roll_ft": r["ground_roll_ft"], "total50_ft": r["total50_ft"]})
            m = c.execute("SELECT weight_lb, notes FROM poh_meta WHERE tail=?", (tail,)).fetchone()
        if m:
            out["weight_lb"], out["notes"] = m["weight_lb"], m["notes"]
        return out

    def set_poh(self, tail: str, poh: dict) -> dict:
        with self._tx() as c:
            c.execute("INSERT OR IGNORE INTO aircraft(tail) VALUES (?)", (tail,))
            c.execute("DELETE FROM poh_reference WHERE tail=?", (tail,))
            for typ in ("takeoff", "landing"):
                for r in poh.get(typ) or []:
                    c.execute("INSERT OR REPLACE INTO poh_reference(tail, type, pa_ft, oat_c, ground_roll_ft, total50_ft) VALUES (?,?,?,?,?,?)",
                              (tail, typ, r["pa_ft"], r["oat_c"], r.get("ground_roll_ft"), r.get("total50_ft")))
            c.execute("INSERT INTO poh_meta(tail, weight_lb, notes) VALUES (?,?,?) ON CONFLICT(tail) DO UPDATE SET weight_lb=excluded.weight_lb, notes=excluded.notes",
                      (tail, poh.get("weight_lb"), poh.get("notes") or ""))
        return self.get_poh(tail)
