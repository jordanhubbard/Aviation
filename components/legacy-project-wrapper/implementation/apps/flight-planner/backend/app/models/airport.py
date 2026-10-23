from __future__ import annotations

from app.utils.paths import add_package_path

add_package_path("shared-sdk/python")

from aviation import haversine_distance, load_airport_cache as _load_airport_cache
from aviation.airports import AirportDatabase


def load_airport_cache():
    return _load_airport_cache()


def _database_from_cache() -> AirportDatabase:
    database = AirportDatabase()
    database.airports = load_airport_cache()
    database.loaded = True
    return database


def search_airports_advanced(
    *,
    query: str | None = None,
    lat: float | None = None,
    lon: float | None = None,
    radius_nm: float | None = None,
    limit: int = 20,
):
    return _database_from_cache().search_airports(
        query=query,
        limit=limit,
        latitude=lat,
        longitude=lon,
        radius_nm=radius_nm,
    )


def get_airport_by_code(code: str):
    return _database_from_cache().get_airport_coordinates(code)


def get_airport(code: str):
    if not code or not str(code).strip():
        return None
    return get_airport_by_code(code)


def get_airport_coordinates(code: str):
    return get_airport_by_code(code)
