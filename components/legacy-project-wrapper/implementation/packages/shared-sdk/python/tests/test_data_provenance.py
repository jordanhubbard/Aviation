from __future__ import annotations

import hashlib
import json
import sys
from pathlib import Path

IMPLEMENTATION_ROOT = Path(__file__).resolve().parents[4]
APP_ROOT = IMPLEMENTATION_ROOT / "apps" / "flight-planner"
DATA_DIR = APP_ROOT / "backend" / "data"
SHARED_DATA = IMPLEMENTATION_ROOT / "packages" / "shared-sdk" / "data"
PROVENANCE = json.loads((DATA_DIR / "provenance.json").read_text(encoding="utf-8"))

sys.path.insert(0, str(APP_ROOT))
from scripts.update_data import rebuild_caches, write_provenance_manifest  # noqa: E402


def _sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def test_manifest_binds_every_tracked_runtime_dataset() -> None:
    artifacts = {entry["path"]: entry for entry in PROVENANCE["artifacts"]}

    assert set(artifacts) == {
        "airports_cache.json",
        "airspaces_us.json",
        "airspace_cache.json",
    }
    for name, entry in artifacts.items():
        assert _sha256(DATA_DIR / name) == entry["sha256"]
        value = json.loads((DATA_DIR / name).read_text(encoding="utf-8"))
        count = len(value) if isinstance(value, list) else len(value["features"])
        assert count == entry["record_count"]


def test_airport_copy_matches_the_common_sdk_snapshot() -> None:
    shared_provenance = json.loads(
        (SHARED_DATA / "provenance.json").read_text(encoding="utf-8")
    )

    assert _sha256(DATA_DIR / "airports_cache.json") == _sha256(
        SHARED_DATA / "airports_cache.json"
    )
    assert shared_provenance["artifact"]["sha256"] == _sha256(
        DATA_DIR / "airports_cache.json"
    )


def test_unknown_history_is_not_misrepresented_as_current_or_commercial() -> None:
    artifacts = {entry["path"]: entry for entry in PROVENANCE["artifacts"]}

    assert artifacts["airports_cache.json"]["freshness"] == "unknown"
    for name in ("airspaces_us.json", "airspace_cache.json"):
        entry = artifacts[name]
        assert entry["historical_acquisition_terms"] == "not-recorded"
        assert entry["acquired_at"] is None
        assert entry["source_sha256"] is None
        assert entry["commercial_use"] == "not-authorized-by-recorded-evidence"


def test_openaip_attribution_is_visible_on_the_airspace_map() -> None:
    map_source = (
        APP_ROOT / "frontend" / "src" / "components" / "AirportAirspaceMap.tsx"
    ).read_text(encoding="utf-8")

    assert "https://www.openaip.net" in map_source
    assert "CC BY-NC 4.0" in map_source
    assert "adapted" in map_source


def test_refresh_pipeline_records_input_identities_and_acquisition_times(
    tmp_path: Path,
) -> None:
    airports_csv = tmp_path / "airports.csv"
    airports_csv.write_text(
        "gps_code,icao_code,ident,iata_code,name,municipality,iso_country,"
        "latitude_deg,longitude_deg,elevation_ft,type\n"
        "KAAA,KAAA,KAAA,AAA,Alpha,Example,US,1.5,2.5,300,small_airport\n",
        encoding="utf-8",
    )
    airspaces_json = tmp_path / "airspaces.json"
    airspaces_json.write_text(
        json.dumps(
            [
                {
                    "_id": "airspace-1",
                    "name": "Example",
                    "icaoClass": 3,
                    "type": 1,
                    "geometry": {
                        "type": "Polygon",
                        "coordinates": [[[0, 0], [1, 0], [0, 1], [0, 0]]],
                    },
                }
            ]
        ),
        encoding="utf-8",
    )
    legacy_geojson = tmp_path / "legacy.geojson"
    legacy_geojson.write_text(
        json.dumps(
            {
                "type": "FeatureCollection",
                "features": [
                    {
                        "type": "Feature",
                        "geometry": {"type": "Point", "coordinates": [2, 3]},
                        "properties": {"id": "legacy-1"},
                    }
                ],
            }
        ),
        encoding="utf-8",
    )
    schema_json = tmp_path / "openaip_schema.json"
    schema_json.write_text(
        json.dumps(
            {
                "info": {
                    "license": {
                        "name": "Attribution-NonCommercial 4.0 International (CC BY-NC 4.0)",
                        "url": "https://creativecommons.org/licenses/by-nc/4.0/",
                    }
                }
            }
        ),
        encoding="utf-8",
    )
    ourairports_terms = tmp_path / "ourairports_terms.html"
    ourairports_terms.write_text(
        "<html><body>All data is released to the Public Domain.</body></html>",
        encoding="utf-8",
    )
    out_dir = tmp_path / "out"

    rebuild_caches(
        airports_csv=airports_csv,
        airspaces_json=airspaces_json,
        airspaces_ch_geojson=legacy_geojson,
        out_dir=out_dir,
    )
    write_provenance_manifest(
        airports_csv=airports_csv,
        airspaces_json=airspaces_json,
        airspaces_ch_geojson=legacy_geojson,
        ourairports_terms_html=ourairports_terms,
        openaip_schema_json=schema_json,
        out_dir=out_dir,
        ourairports_acquired_at="2026-10-31T12:00:00+00:00",
        openaip_acquired_at="2026-10-31T12:01:00+00:00",
    )

    manifest = json.loads((out_dir / "provenance.json").read_text(encoding="utf-8"))
    artifacts = {entry["path"]: entry for entry in manifest["artifacts"]}
    assert artifacts["airports_cache.json"]["source_sha256"] == _sha256(airports_csv)
    assert artifacts["airports_cache.json"]["license_terms_sha256"] == _sha256(
        ourairports_terms
    )
    assert artifacts["airports_cache.json"]["freshness"] == "recorded"
    assert artifacts["airspaces_us.json"]["source_sha256"] == _sha256(airspaces_json)
    assert artifacts["airspaces_us.json"]["historical_acquisition_terms"] == (
        "recorded-at-acquisition"
    )
    assert artifacts["airspace_cache.json"]["record_count"] == 2
    assert artifacts["airspace_cache.json"]["source_inputs"] == [
        {"path": "airspaces.json", "sha256": _sha256(airspaces_json)},
        {"path": "legacy.geojson", "sha256": _sha256(legacy_geojson)},
    ]
