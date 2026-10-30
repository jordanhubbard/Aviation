"""Compatibility surface backed by the common Aviation weather SDK."""

from app.utils.paths import add_package_path

add_package_path("shared-sdk/python")

from aviation.weather.metar import fetch_metar_raw, fetch_metar_raws, httpx, parse_metar

__all__ = ["fetch_metar_raw", "fetch_metar_raws", "httpx", "parse_metar"]
