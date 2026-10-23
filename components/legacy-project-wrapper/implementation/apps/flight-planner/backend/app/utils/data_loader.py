from __future__ import annotations

import json
import logging
import os
from functools import lru_cache
from pathlib import Path
from typing import Any, Dict, Iterable, List, Mapping, Optional


logger = logging.getLogger(__name__)


def _repo_root() -> Path:
    return Path(__file__).resolve().parents[3]


def _backend_data_dir() -> Path:
    return _repo_root() / "backend" / "data"


def _default_airports_path() -> Path:
    return _backend_data_dir() / "airports_cache.json"


def _default_airspace_path() -> Path:
    return _backend_data_dir() / "airspace_cache.json"


def read_json(path: Path) -> Any:
    return json.loads(path.read_text(encoding="utf-8"))


@lru_cache(maxsize=32)
def read_json_cached(path_str: str, mtime_ns: int) -> Any:
    path = Path(path_str)
    return read_json(path)


def load_json_cached(path: Path) -> Any:
    if not path.exists():
        raise FileNotFoundError(path)
    stat = path.stat()
    return read_json_cached(str(path), stat.st_mtime_ns)


def load_airports(path: Optional[Path] = None) -> List[Dict[str, Any]]:
    airports_path = path or Path(
        os.environ.get("AIRPORT_CACHE_FILE", str(_default_airports_path()))
    )
    if not airports_path.exists():
        logger.warning("Airport cache file not found at %s", airports_path)
        return []

    try:
        data = load_json_cached(airports_path)
        if isinstance(data, list):
            return [v for v in data if isinstance(v, dict)]
        logger.error("Airport cache at %s did not contain a JSON list", airports_path)
        return []
    except Exception as e:
        logger.error("Failed to load airport cache from %s: %s", airports_path, e)
        return []


def build_airport_index(airports: Iterable[Mapping[str, Any]]) -> Dict[str, Dict[str, Any]]:
    index: Dict[str, Dict[str, Any]] = {}
    for airport in airports:
        icao = str(airport.get("icao") or airport.get("icaoCode") or "").strip().upper()
        iata = str(airport.get("iata") or airport.get("iataCode") or "").strip().upper()

        normalized: Dict[str, Any] = dict(airport)

        if icao:
            index[icao] = normalized
        if iata and iata not in index:
            index[iata] = normalized

    return index


def load_airspace(path: Optional[Path] = None) -> Dict[str, Any]:
    airspace_path = path or Path(
        os.environ.get("AIRSPACE_CACHE_FILE", str(_default_airspace_path()))
    )
    if not airspace_path.exists():
        logger.warning("Airspace cache file not found at %s", airspace_path)
        return {}

    try:
        data = load_json_cached(airspace_path)
        if isinstance(data, dict):
            return data
        logger.error("Airspace cache at %s did not contain a JSON object", airspace_path)
        return {}
    except Exception as e:
        logger.error("Failed to load airspace cache from %s: %s", airspace_path, e)
        return {}


def build_airspace_index(geojson: Mapping[str, Any]) -> Dict[str, Any]:
    features = geojson.get("features")
    if not isinstance(features, list):
        return {}

    index: Dict[str, Any] = {}
    for feature in features:
        if not isinstance(feature, dict):
            continue
        props = feature.get("properties")
        if not isinstance(props, dict):
            continue

        feature_id = props.get("id") or props.get("name")
        if not feature_id:
            continue
        index[str(feature_id)] = feature

    return index
