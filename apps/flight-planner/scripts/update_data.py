from __future__ import annotations

import argparse
import json
import os
import time
from pathlib import Path
from typing import Any, Dict, List, Optional

import httpx

from build_data_caches import build_airports_cache, build_airspace_geojson, build_airspaces_us


OURAIRPORTS_AIRPORTS_CSV_URL = "https://ourairports.com/data/airports.csv"
OPENAIP_AIRSPACES_URL = "https://api.core.openaip.net/api/airspaces"
OPENAIP_AIRPORTS_URL = "https://api.core.openaip.net/api/airports"


def _repo_root() -> Path:
    return Path(__file__).resolve().parents[1]


def _download_bytes(
    url: str, *, headers: Optional[Dict[str, str]] = None, timeout_s: float = 60
) -> bytes:
    resp = httpx.get(url, headers=headers, timeout=timeout_s)
    resp.raise_for_status()
    return resp.content


def download_ourairports_csv(*, out_csv: Path, url: str = OURAIRPORTS_AIRPORTS_CSV_URL) -> None:
    out_csv.parent.mkdir(parents=True, exist_ok=True)
    out_csv.write_bytes(_download_bytes(url, timeout_s=60))


def _download_openaip_paged(
    *,
    url: str,
    api_key: str,
    page_limit: int = 1000,
    max_pages: int = 500,
    delay_s: float = 0.2,
) -> List[Dict[str, Any]]:
    headers = {"x-openaip-api-key": api_key, "Accept": "application/json"}
    out: List[Dict[str, Any]] = []

    page = 1
    while page <= max_pages:
        params = {"page": page, "limit": page_limit}
        resp = httpx.get(url, headers=headers, params=params, timeout=120)
        resp.raise_for_status()

        payload = resp.json()
        items = payload.get("items") if isinstance(payload, dict) else None
        if not isinstance(items, list) or not items:
            break

        out.extend([i for i in items if isinstance(i, dict)])
        if len(items) < page_limit:
            break

        page += 1
        time.sleep(delay_s)

    return out


def download_openaip_airspaces(*, out_json: Path, api_key: str) -> None:
    out_json.parent.mkdir(parents=True, exist_ok=True)
    airspaces = _download_openaip_paged(url=OPENAIP_AIRSPACES_URL, api_key=api_key)
    out_json.write_text(json.dumps(airspaces, separators=(",", ":")), encoding="utf-8")


def download_openaip_airports(*, out_json: Path, api_key: str) -> None:
    out_json.parent.mkdir(parents=True, exist_ok=True)
    airports = _download_openaip_paged(url=OPENAIP_AIRPORTS_URL, api_key=api_key)
    out_json.write_text(json.dumps(airports, separators=(",", ":")), encoding="utf-8")


def rebuild_caches(
    *, airports_csv: Path, airspaces_json: Path, airspaces_ch_geojson: Path, out_dir: Path
) -> None:
    out_dir.mkdir(parents=True, exist_ok=True)
    build_airports_cache(airports_csv=airports_csv, out_json=out_dir / "airports_cache.json")
    build_airspaces_us(airspaces_json=airspaces_json, out_json=out_dir / "airspaces_us.json")
    build_airspace_geojson(
        airspaces_us_json=out_dir / "airspaces_us.json",
        ch_geojson=airspaces_ch_geojson,
        out_geojson=out_dir / "airspace_cache.json",
    )


def main() -> None:
    root = _repo_root()
    src_dir = root / "sources" / "xctry-planner" / "backend"
    out_dir = root / "backend" / "data"

    parser = argparse.ArgumentParser(
        description="Update source aviation datasets and rebuild local caches"
    )
    parser.add_argument("--openaip-api-key", default=os.environ.get("OPENAIP_API_KEY", ""))
    parser.add_argument("--skip-ourairports", action="store_true")
    parser.add_argument("--skip-openaip", action="store_true")
    parser.add_argument("--no-rebuild", action="store_true")

    parser.add_argument("--airports-csv", default=str(src_dir / "airports.csv"))
    parser.add_argument("--airspaces-json", default=str(src_dir / "airspaces_us.json"))
    parser.add_argument("--openaip-airports-json", default=str(src_dir / "airports_us.json"))
    parser.add_argument("--airspaces-ch-geojson", default=str(src_dir / "airspaces_ch.geojson"))
    parser.add_argument("--out-dir", default=str(out_dir))

    args = parser.parse_args()

    airports_csv = Path(args.airports_csv)
    airspaces_json = Path(args.airspaces_json)
    openaip_airports_json = Path(args.openaip_airports_json)
    airspaces_ch_geojson = Path(args.airspaces_ch_geojson)
    out_dir = Path(args.out_dir)

    if not args.skip_ourairports:
        print(f"Downloading OurAirports CSV -> {airports_csv}")
        download_ourairports_csv(out_csv=airports_csv)

    if not args.skip_openaip:
        if not args.openaip_api_key:
            raise SystemExit(
                "OPENAIP_API_KEY is required to download OpenAIP datasets (or pass --skip-openaip)."
            )

        print(f"Downloading OpenAIP airspaces -> {airspaces_json}")
        download_openaip_airspaces(out_json=airspaces_json, api_key=args.openaip_api_key)

        # Not currently used by cache builder, but kept for debugging/inspection.
        print(f"Downloading OpenAIP airports -> {openaip_airports_json}")
        download_openaip_airports(out_json=openaip_airports_json, api_key=args.openaip_api_key)

    if not args.no_rebuild:
        print(f"Rebuilding caches in {out_dir}")
        rebuild_caches(
            airports_csv=airports_csv,
            airspaces_json=airspaces_json,
            airspaces_ch_geojson=airspaces_ch_geojson,
            out_dir=out_dir,
        )


if __name__ == "__main__":
    main()
