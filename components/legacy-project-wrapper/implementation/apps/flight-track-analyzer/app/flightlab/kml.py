"""Tolerant KML tracklog reader for ForeFlight, Garmin and generic exports.

Elements are matched by local name so that gx:/kml namespaces and vendor prefixes
do not matter. XML is parsed with defusedxml: entity expansion and external
entities are refused.
"""
from __future__ import annotations

import re
from dataclasses import dataclass, field
from datetime import datetime, timezone

import numpy as np
from defusedxml import ElementTree as SafeET
from defusedxml.common import DefusedXmlException

MAX_BYTES = 64 * 1024 * 1024


class KmlError(ValueError):
    pass


@dataclass
class RawTrack:
    name: str
    source: str
    t: np.ndarray            # epoch seconds
    lat: np.ndarray
    lon: np.ndarray
    alt_m: np.ndarray
    extras: dict = field(default_factory=dict)   # name -> (values, unit_hint)
    warnings: list = field(default_factory=list)


def _ln(el) -> str:
    tag = el.tag
    return tag.rsplit("}", 1)[-1] if isinstance(tag, str) else ""


def _kids(el, name):
    return [c for c in el if _ln(c) == name]


def _desc(el, name):
    return [c for c in el.iter() if _ln(c) == name]


def parse_time(s: str) -> float:
    s = (s or "").strip()
    if not s:
        raise ValueError("empty time")
    if re.fullmatch(r"-?\d+(\.\d+)?", s):
        return float(s)
    s = s.replace("Z", "+00:00").replace("z", "+00:00")
    m = re.match(r"^(.*?T\d\d:\d\d:\d\d)(\.\d+)?(.*)$", s)
    if m:  # normalise fractional seconds for fromisoformat on every Python
        frac = (m.group(2) or "")[:7]
        s = m.group(1) + frac + m.group(3)
    dt = datetime.fromisoformat(s)
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt.timestamp()


def _floats(txt):
    return [float(v) for v in re.split(r"[,\s]+", txt.strip()) if v]


def _unit_hint(name: str) -> str | None:
    n = name.lower()
    for key, unit in (("kt", "kt"), ("knot", "kt"), ("mph", "mph"), ("km/h", "kph"), ("kph", "kph"),
                      ("m/s", "mps"), ("mps", "mps"), ("fpm", "fpm"), ("ft/s", "fps")):
        if key in n:
            return unit
    return None


def _classify(name: str) -> str | None:
    n = name.lower()
    if n.startswith("acc"):          # GPS accuracy estimates, e.g. acc_horiz / acc_vert (not a rate!)
        return "acc_v" if "vert" in n else "acc_h" if "horiz" in n else None
    if re.search(r"vert|climb|\bvs\b|vspd|vvel", n):
        return "vs"
    if re.search(r"speed|\bgs\b|gspd|velocity", n):
        return "speed"
    if re.search(r"course|heading|bearing|\btrk\b|\btrack\b|\bhdg\b", n):
        return "course"
    if re.search(r"^(ele|alt)|altitude|elevation", n):
        return "alt"
    return None


def _detect_source(text_head: str) -> str:
    h = text_head.lower()
    if "foreflight" in h:
        return "foreflight"
    if "garmin" in h:
        return "garmin"
    return "generic"


def _arrays(scope, n):
    """Recorded per-sample arrays (speed, course, ...) under `scope` whose length matches n samples."""
    extras = {}
    for arr in _desc(scope, "SimpleArrayData"):
        nm = arr.get("name") or ""
        vals = []
        for v in _kids(arr, "value"):
            try:
                vals.append(float(v.text))
            except (TypeError, ValueError):
                vals.append(np.nan)
        kind = _classify(nm)
        if kind and kind not in extras and len(vals) == n and np.isfinite(vals).sum() > 0:
            extras[kind] = (np.array(vals, float), _unit_hint(nm))
    return extras


def _parse_gx_track(tr, warnings):
    whens = [parse_time(w.text) for w in _kids(tr, "when")]
    coords = []
    for c in _kids(tr, "coord"):
        v = _floats(c.text or "")
        if len(v) == 2:
            v.append(np.nan)
        if len(v) < 3:
            raise KmlError("malformed gx:coord")
        coords.append(v[:3])
    if len(whens) != len(coords):
        n = min(len(whens), len(coords))
        warnings.append(f"track has {len(whens)} times but {len(coords)} coords; truncated to {n}")
        whens, coords = whens[:n], coords[:n]
    extras = _arrays(tr, len(whens))
    return whens, coords, extras


_DESC_RE = re.compile(r"(speed|course|heading|altitude|elevation)\s*[:=]\s*(-?\d+(?:\.\d+)?)\s*"
                      r"(kts?|knots?|mph|km/h|kph|m/s|ft|feet|m|deg|°)?", re.I)


def _parse_point_placemarks(placemarks, warnings):
    rows = []
    for pm in placemarks:
        pts = _desc(pm, "Point")
        if not pts:
            continue
        co = [c for c in _desc(pts[0], "coordinates")]
        if not co:
            continue
        v = _floats(co[0].text or "")
        if len(v) < 2:
            continue
        ts = [e for e in _desc(pm, "when")] or [e for e in _desc(pm, "begin")]
        if not ts:
            continue
        try:
            t = parse_time(ts[0].text)
        except ValueError:
            continue
        info = {"speed": np.nan, "course": np.nan}
        hints = {}
        texts = [(d.get("name") or "", d.text or "") for d in _desc(pm, "Data")]
        texts += [("", d.text or "") for d in _desc(pm, "description")]
        for k, val in texts:
            kind = _classify(k)
            if kind in ("speed", "course") and val.strip():
                try:
                    info[kind] = float(val.split()[0])
                    hints[kind] = _unit_hint(k) or _unit_hint(val)
                except ValueError:
                    pass
            for m in _DESC_RE.finditer(val):
                key = m.group(1).lower()
                key = {"heading": "course", "elevation": "alt"}.get(key, key)
                if key in ("speed", "course"):
                    info[key] = float(m.group(2))
                    hints[key] = _unit_hint(m.group(3) or "")
        rows.append((t, v[0], v[1], v[2] if len(v) > 2 else np.nan, info, hints))
    if len(rows) < 2:
        return None
    rows.sort(key=lambda r: r[0])
    t = [r[0] for r in rows]
    co = [[r[1], r[2], r[3]] for r in rows]
    extras = {}
    for k in ("speed", "course"):
        vals = np.array([r[4][k] for r in rows], float)
        if np.isfinite(vals).sum() > len(vals) * 0.5:
            hint = next((r[5].get(k) for r in rows if r[5].get(k)), None)
            extras[k] = (vals, hint)
    return t, co, extras


def _parse_linestring(pm, warnings):
    ls = _desc(pm, "LineString")
    if not ls:
        return None
    co = _desc(ls[0], "coordinates")
    if not co:
        return None
    nums = _floats(co[0].text or "")
    if len(nums) < 6 or len(nums) % 3:
        pts = [nums[i:i + 2] + [np.nan] for i in range(0, len(nums) - 1, 2)] if len(nums) % 3 else []
    else:
        pts = [nums[i:i + 3] for i in range(0, len(nums), 3)]
    b, e = _desc(pm, "begin"), _desc(pm, "end")
    if not (b and e) or len(pts) < 2:
        return None
    t0, t1 = parse_time(b[0].text), parse_time(e[0].text)
    t = list(np.linspace(t0, t1, len(pts)))
    warnings.append("LineString with TimeSpan: sample times interpolated linearly")
    return t, pts, {}


def parse_kml(data: bytes, filename: str = "") -> list[RawTrack]:
    if len(data) > MAX_BYTES:
        raise KmlError("file too large")
    try:
        root = SafeET.fromstring(data, forbid_dtd=True)
    except DefusedXmlException as e:
        raise KmlError(f"rejected unsafe XML ({type(e).__name__})")
    except Exception as e:
        raise KmlError(f"not well-formed XML: {e}")
    if _ln(root) != "kml":
        raise KmlError("not a KML document")
    source = _detect_source(data[:4096].decode("utf-8", "ignore"))

    tracks: list[RawTrack] = []
    placemarks = _desc(root, "Placemark")
    point_only = []
    for idx, pm in enumerate(placemarks):
        w: list = []
        nm_el = _kids(pm, "name")
        name = (nm_el[0].text or "").strip() if nm_el else ""
        whens, coords, extras = [], [], {}
        try:
            gx = [e for e in _desc(pm, "Track")]
            for tr in gx:
                a, b, ex = _parse_gx_track(tr, w)
                if not ex and len(gx) == 1:
                    # ForeFlight puts the per-sample arrays in a Document-level ExtendedData after the
                    # placemarks; accept arrays (here or in the Placemark) only when the length matches.
                    ex = _arrays(pm, len(a)) or _arrays(root, len(a))
                if whens and ex.keys() != extras.keys():
                    ex = {}
                    extras = {}
                whens += a
                coords += b
                for k, (vals, hint) in ex.items():
                    if k in extras:
                        extras[k] = (np.concatenate([extras[k][0], vals]), hint)
                    else:
                        extras[k] = (vals, hint)
            if not whens:
                ls = _parse_linestring(pm, w)
                if ls:
                    whens, coords, extras = ls
        except (ValueError, KmlError) as e:
            raise KmlError(f"placemark '{name or idx}': {e}")
        if not whens:
            if _desc(pm, "Point"):
                point_only.append(pm)
            continue
        tracks.append(_make(name or filename or f"track {idx + 1}", source, whens, coords, extras, w))
    if point_only:
        w = []
        res = _parse_point_placemarks(point_only, w)
        if res:
            nm = (_kids(_desc(root, "Document")[0], "name") if _desc(root, "Document") else [])
            tracks.append(_make((nm[0].text.strip() if nm and nm[0].text else filename or "points"),
                                source, *res, w))
    if not tracks:
        raise KmlError("no time-stamped track found (need gx:Track, time-stamped Points, or LineString+TimeSpan)")
    return tracks


def _make(name, source, whens, coords, extras, warnings) -> RawTrack:
    arr = np.array(coords, float)
    t = np.array(whens, float)
    if arr.shape[0] < 10:
        raise KmlError(f"track '{name}' has only {arr.shape[0]} points")
    bad = np.isfinite(arr[:, 2]) & ((arr[:, 2] < -1000.0) | (arr[:, 2] > 30000.0))
    if bad.any():      # e.g. -100000 "no altitude" placeholder on the first fixes
        keep = ~bad
        arr, t = arr[keep], t[keep]
        extras = {k: (v[keep], h) for k, (v, h) in extras.items() if len(v) == len(keep)}
        warnings.append(f"{int(bad.sum())} sample(s) with placeholder/invalid altitude removed")
    if np.isnan(arr[:, 2]).all():
        warnings.append("no altitude in track; vertical analysis unavailable")
        arr[:, 2] = 0.0
    return RawTrack(name=name, source=source, t=t, lon=arr[:, 0], lat=arr[:, 1],
                    alt_m=arr[:, 2], extras=extras, warnings=warnings)
