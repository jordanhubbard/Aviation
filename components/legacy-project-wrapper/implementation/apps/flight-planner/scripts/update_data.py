from __future__ import annotations

import argparse
import hashlib
import json
import os
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional

import httpx

try:
    from .build_data_caches import (
        build_airports_cache,
        build_airspace_geojson,
        build_airspaces_us,
    )
except ImportError:  # Direct script execution.
    from build_data_caches import (
        build_airports_cache,
        build_airspace_geojson,
        build_airspaces_us,
    )


OURAIRPORTS_AIRPORTS_CSV_URL = "https://ourairports.com/data/airports.csv"
OURAIRPORTS_TERMS_URL = "https://ourairports.com/data/"
OPENAIP_AIRSPACES_URL = "https://api.core.openaip.net/api/airspaces"
OPENAIP_AIRPORTS_URL = "https://api.core.openaip.net/api/airports"
OPENAIP_SCHEMA_URL = "https://api.core.openaip.net/api/system/specs/v1/schema.json"


def _repo_root() -> Path:
    return Path(__file__).resolve().parents[1]


def _download_bytes(
    url: str, *, headers: Optional[Dict[str, str]] = None, timeout_s: float = 60
) -> bytes:
    resp = httpx.get(url, headers=headers, timeout=timeout_s)
    resp.raise_for_status()
    return resp.content


def download_ourairports_csv(
    *, out_csv: Path, url: str = OURAIRPORTS_AIRPORTS_CSV_URL
) -> None:
    out_csv.parent.mkdir(parents=True, exist_ok=True)
    out_csv.write_bytes(_download_bytes(url, timeout_s=60))


def download_ourairports_terms(*, out_html: Path) -> None:
    out_html.parent.mkdir(parents=True, exist_ok=True)
    content = _download_bytes(OURAIRPORTS_TERMS_URL, timeout_s=60)
    if b"public domain" not in content.lower():
        raise ValueError("OurAirports terms no longer declare the data public domain")
    out_html.write_bytes(content)


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


def download_openaip_schema(*, out_json: Path) -> None:
    out_json.parent.mkdir(parents=True, exist_ok=True)
    out_json.write_bytes(_download_bytes(OPENAIP_SCHEMA_URL, timeout_s=60))


def _sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def _json_record_count(path: Path) -> int:
    value = json.loads(path.read_text(encoding="utf-8"))
    if isinstance(value, list):
        return len(value)
    if isinstance(value, dict) and isinstance(value.get("features"), list):
        return len(value["features"])
    raise ValueError(f"Cannot count records in {path}")


def write_provenance_manifest(
    *,
    airports_csv: Path,
    airspaces_json: Path,
    airspaces_ch_geojson: Path,
    ourairports_terms_html: Path,
    openaip_schema_json: Path,
    out_dir: Path,
    ourairports_acquired_at: Optional[str],
    openaip_acquired_at: Optional[str],
) -> None:
    """Bind refreshed outputs to their exact inputs without inventing skipped downloads."""
    schema = json.loads(openaip_schema_json.read_text(encoding="utf-8"))
    license_info = schema.get("info", {}).get("license", {})
    openaip_license = str(license_info.get("name") or "unverified")
    openaip_license_url = str(license_info.get("url") or "")
    expected_openaip_license = (
        "Attribution-NonCommercial 4.0 International (CC BY-NC 4.0)"
    )
    if openaip_license != expected_openaip_license:
        raise ValueError(f"OpenAIP license changed; review required: {openaip_license}")
    if openaip_license_url != "https://creativecommons.org/licenses/by-nc/4.0/":
        raise ValueError(
            f"OpenAIP license URL changed; review required: {openaip_license_url}"
        )
    if b"public domain" not in ourairports_terms_html.read_bytes().lower():
        raise ValueError("OurAirports terms no longer declare the data public domain")

    airport_output = out_dir / "airports_cache.json"
    airspaces_output = out_dir / "airspaces_us.json"
    airspace_cache = out_dir / "airspace_cache.json"
    legacy_input = (
        {
            "path": airspaces_ch_geojson.name,
            "sha256": _sha256(airspaces_ch_geojson),
        }
        if airspaces_ch_geojson.exists() and airspaces_ch_geojson.stat().st_size > 0
        else None
    )

    manifest = {
        "schema": "aviation-data-provenance@1",
        "authority": "intentionally-retained-third-party-data",
        "generated_by": "apps/flight-planner/scripts/update_data.py",
        "artifacts": [
            {
                "path": airport_output.name,
                "classification": "redistributable-derived-snapshot",
                "sha256": _sha256(airport_output),
                "record_count": _json_record_count(airport_output),
                "source": "OurAirports airports.csv",
                "source_url": OURAIRPORTS_AIRPORTS_CSV_URL,
                "terms_url": OURAIRPORTS_TERMS_URL,
                "license_terms_sha256": _sha256(ourairports_terms_html),
                "license": "Public Domain",
                "acquired_at": ourairports_acquired_at,
                "source_sha256": _sha256(airports_csv),
                "freshness": "recorded" if ourairports_acquired_at else "unknown",
            },
            {
                "path": airspaces_output.name,
                "classification": "intentionally-retained-third-party-snapshot",
                "sha256": _sha256(airspaces_output),
                "record_count": _json_record_count(airspaces_output),
                "source": "openAIP Core API airspaces",
                "source_url": OPENAIP_AIRSPACES_URL,
                "terms_url": OPENAIP_SCHEMA_URL,
                "current_license": openaip_license,
                "license_url": openaip_license_url,
                "license_schema_sha256": _sha256(openaip_schema_json),
                "historical_acquisition_terms": (
                    "recorded-at-acquisition" if openaip_acquired_at else "not-recorded"
                ),
                "acquired_at": openaip_acquired_at,
                "source_sha256": _sha256(airspaces_json),
                "freshness": "recorded" if openaip_acquired_at else "unknown",
                "commercial_use": "not-authorized-by-recorded-evidence",
            },
            {
                "path": airspace_cache.name,
                "classification": "intentionally-retained-mixed-provenance-snapshot",
                "sha256": _sha256(airspace_cache),
                "record_count": _json_record_count(airspace_cache),
                "source": "derived openAIP airspaces plus optional legacy features",
                "terms_url": OPENAIP_SCHEMA_URL,
                "current_license": openaip_license,
                "license_url": openaip_license_url,
                "license_schema_sha256": _sha256(openaip_schema_json),
                "historical_acquisition_terms": (
                    "recorded-at-acquisition" if openaip_acquired_at else "not-recorded"
                ),
                "acquired_at": openaip_acquired_at,
                "source_sha256": None,
                "source_inputs": [
                    {"path": airspaces_json.name, "sha256": _sha256(airspaces_json)},
                    *([legacy_input] if legacy_input else []),
                ],
                "freshness": "recorded" if openaip_acquired_at else "unknown",
                "commercial_use": "not-authorized-by-recorded-evidence",
            },
        ],
        "constraints": [
            "The repository MIT license does not relicense these third-party data artifacts.",
            "Display of openAIP-derived data requires attribution and an indication that the data was adapted.",
            "None of these community datasets is suitable for primary navigation.",
        ],
    }
    (out_dir / "provenance.json").write_text(
        json.dumps(manifest, indent=2, sort_keys=True) + "\n", encoding="utf-8"
    )


def rebuild_caches(
    *,
    airports_csv: Path,
    airspaces_json: Path,
    airspaces_ch_geojson: Path,
    out_dir: Path,
) -> None:
    out_dir.mkdir(parents=True, exist_ok=True)
    build_airports_cache(
        airports_csv=airports_csv, out_json=out_dir / "airports_cache.json"
    )
    build_airspaces_us(
        airspaces_json=airspaces_json, out_json=out_dir / "airspaces_us.json"
    )
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
    parser.add_argument(
        "--openaip-api-key", default=os.environ.get("OPENAIP_API_KEY", "")
    )
    parser.add_argument("--skip-ourairports", action="store_true")
    parser.add_argument("--skip-openaip", action="store_true")
    parser.add_argument("--no-rebuild", action="store_true")

    parser.add_argument("--airports-csv", default=str(src_dir / "airports.csv"))
    parser.add_argument(
        "--ourairports-terms-html", default=str(src_dir / "ourairports_terms.html")
    )
    parser.add_argument("--airspaces-json", default=str(src_dir / "airspaces_us.json"))
    parser.add_argument(
        "--openaip-airports-json", default=str(src_dir / "airports_us.json")
    )
    parser.add_argument(
        "--openaip-schema-json", default=str(src_dir / "openaip_schema.json")
    )
    parser.add_argument(
        "--airspaces-ch-geojson", default=str(src_dir / "airspaces_ch.geojson")
    )
    parser.add_argument("--out-dir", default=str(out_dir))

    args = parser.parse_args()

    airports_csv = Path(args.airports_csv)
    ourairports_terms_html = Path(args.ourairports_terms_html)
    airspaces_json = Path(args.airspaces_json)
    openaip_airports_json = Path(args.openaip_airports_json)
    openaip_schema_json = Path(args.openaip_schema_json)
    airspaces_ch_geojson = Path(args.airspaces_ch_geojson)
    out_dir = Path(args.out_dir)
    ourairports_acquired_at: Optional[str] = None
    openaip_acquired_at: Optional[str] = None

    if not args.skip_ourairports:
        print(f"Downloading OurAirports CSV -> {airports_csv}")
        download_ourairports_csv(out_csv=airports_csv)
        print(f"Downloading OurAirports terms -> {ourairports_terms_html}")
        download_ourairports_terms(out_html=ourairports_terms_html)
        ourairports_acquired_at = datetime.now(timezone.utc).isoformat()

    if not args.skip_openaip:
        if not args.openaip_api_key:
            raise SystemExit(
                "OPENAIP_API_KEY is required to download OpenAIP datasets (or pass --skip-openaip)."
            )

        print(f"Downloading OpenAIP airspaces -> {airspaces_json}")
        download_openaip_airspaces(
            out_json=airspaces_json, api_key=args.openaip_api_key
        )

        # Not currently used by cache builder, but kept for debugging/inspection.
        print(f"Downloading OpenAIP airports -> {openaip_airports_json}")
        download_openaip_airports(
            out_json=openaip_airports_json, api_key=args.openaip_api_key
        )

        print(f"Downloading OpenAIP license schema -> {openaip_schema_json}")
        download_openaip_schema(out_json=openaip_schema_json)
        openaip_acquired_at = datetime.now(timezone.utc).isoformat()

    if not args.no_rebuild:
        print(f"Rebuilding caches in {out_dir}")
        rebuild_caches(
            airports_csv=airports_csv,
            airspaces_json=airspaces_json,
            airspaces_ch_geojson=airspaces_ch_geojson,
            out_dir=out_dir,
        )
        if not openaip_schema_json.exists() or not ourairports_terms_html.exists():
            raise SystemExit(
                "OurAirports terms and OpenAIP schema evidence are required to write "
                "provenance; download them or pass their evidence paths."
            )
        write_provenance_manifest(
            airports_csv=airports_csv,
            airspaces_json=airspaces_json,
            airspaces_ch_geojson=airspaces_ch_geojson,
            ourairports_terms_html=ourairports_terms_html,
            openaip_schema_json=openaip_schema_json,
            out_dir=out_dir,
            ourairports_acquired_at=ourairports_acquired_at,
            openaip_acquired_at=openaip_acquired_at,
        )


if __name__ == "__main__":
    main()
