from __future__ import annotations

import argparse
import csv
import json
from pathlib import Path
from typing import Any, Dict, List, Optional


def _repo_root() -> Path:
    return Path(__file__).resolve().parents[1]


def _pick_code(row: Dict[str, Any]) -> str:
    gps = (row.get("gps_code") or "").strip().upper()
    icao = (row.get("icao_code") or "").strip().upper()
    ident = (row.get("ident") or "").strip().upper()
    iata = (row.get("iata_code") or "").strip().upper()

    # Prefer GPS/ICAO-style 4-letter codes, then fallback.
    for c in (gps, icao, ident, iata):
        if len(c) == 4 and c.isalnum():
            return c

    return gps or icao or ident or iata


def _to_float(v: Any) -> Optional[float]:
    if v is None:
        return None
    try:
        return float(v)
    except Exception:
        return None


def build_airports_cache(*, airports_csv: Path, out_json: Path) -> None:
    seen: set[str] = set()
    out: List[Dict[str, Any]] = []

    with airports_csv.open("r", encoding="utf-8", newline="") as f:
        reader = csv.DictReader(f)
        for row in reader:
            lat = _to_float(row.get("latitude_deg"))
            lon = _to_float(row.get("longitude_deg"))
            if lat is None or lon is None:
                continue

            icao = _pick_code(row)
            iata = (row.get("iata_code") or "").strip().upper()
            key = icao or iata or f"{lat},{lon}"
            if key in seen:
                continue
            seen.add(key)

            out.append(
                {
                    "icao": icao,
                    "iata": iata,
                    "name": row.get("name") or None,
                    "city": row.get("municipality") or "",
                    "country": row.get("iso_country") or "",
                    "latitude": lat,
                    "longitude": lon,
                    "elevation": _to_float(row.get("elevation_ft")),
                    "type": row.get("type") or "",
                }
            )

    out_json.parent.mkdir(parents=True, exist_ok=True)
    out_json.write_text(json.dumps(out, separators=(",", ":")), encoding="utf-8")


def build_airspaces_us(*, airspaces_json: Path, out_json: Path) -> None:
    raw = json.loads(airspaces_json.read_text(encoding="utf-8"))
    if not isinstance(raw, list):
        raise ValueError("Expected a list in airspaces JSON")

    simplified: List[Dict[str, Any]] = []
    for asp in raw:
        if not isinstance(asp, dict):
            continue
        geom = asp.get("geometry")
        if not geom:
            continue

        simplified.append(
            {
                "id": asp.get("_id") or asp.get("id"),
                "name": asp.get("name"),
                "category": asp.get("icaoClass"),
                "type": asp.get("type"),
                "geometry": geom,
            }
        )

    out_json.parent.mkdir(parents=True, exist_ok=True)
    out_json.write_text(json.dumps(simplified, separators=(",", ":")), encoding="utf-8")


def build_airspace_geojson(
    *, airspaces_us_json: Path, ch_geojson: Optional[Path], out_geojson: Path
) -> None:
    raw = json.loads(airspaces_us_json.read_text(encoding="utf-8"))
    if not isinstance(raw, list):
        raise ValueError("Expected a list in simplified airspaces JSON")

    features: List[Dict[str, Any]] = []
    for asp in raw:
        if not isinstance(asp, dict):
            continue
        geom = asp.get("geometry")
        if not geom:
            continue
        features.append(
            {
                "type": "Feature",
                "geometry": geom,
                "properties": {
                    "id": asp.get("id"),
                    "name": asp.get("name"),
                    "icaoClass": asp.get("category"),
                    "type": asp.get("type"),
                },
            }
        )

    if ch_geojson and ch_geojson.exists() and ch_geojson.stat().st_size > 0:
        ch = json.loads(ch_geojson.read_text(encoding="utf-8"))
        if isinstance(ch, dict) and isinstance(ch.get("features"), list):
            for feat in ch["features"]:
                if isinstance(feat, dict) and feat.get("geometry"):
                    features.append(feat)

    out_geojson.parent.mkdir(parents=True, exist_ok=True)
    out_geojson.write_text(
        json.dumps({"type": "FeatureCollection", "features": features}, separators=(",", ":")),
        encoding="utf-8",
    )


def main() -> None:
    root = _repo_root()
    src = root / "sources" / "xctry-planner" / "backend"
    out_dir = root / "backend" / "data"

    parser = argparse.ArgumentParser()
    parser.add_argument("--airports-csv", default=str(src / "airports.csv"))
    parser.add_argument("--airspaces-json", default=str(src / "airspaces_us.json"))
    parser.add_argument("--airspaces-ch-geojson", default=str(src / "airspaces_ch.geojson"))
    parser.add_argument("--out-airports", default=str(out_dir / "airports_cache.json"))
    parser.add_argument("--out-airspaces-us", default=str(out_dir / "airspaces_us.json"))
    parser.add_argument("--out-airspace-geojson", default=str(out_dir / "airspace_cache.json"))
    args = parser.parse_args()

    build_airports_cache(airports_csv=Path(args.airports_csv), out_json=Path(args.out_airports))
    build_airspaces_us(
        airspaces_json=Path(args.airspaces_json), out_json=Path(args.out_airspaces_us)
    )
    build_airspace_geojson(
        airspaces_us_json=Path(args.out_airspaces_us),
        ch_geojson=Path(args.airspaces_ch_geojson),
        out_geojson=Path(args.out_airspace_geojson),
    )


if __name__ == "__main__":
    main()
