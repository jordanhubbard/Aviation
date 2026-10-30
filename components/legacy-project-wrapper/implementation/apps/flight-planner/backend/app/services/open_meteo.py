"""Compatibility surface backed by the common Aviation weather SDK."""

from app.utils.paths import add_package_path

add_package_path("shared-sdk/python")

from aviation.weather.open_meteo import (
    OpenMeteoError,
    get_current_weather,
    get_daily_forecast,
    get_hourly_forecast,
    httpx,
    sample_points_along_route,
)

__all__ = [
    "OpenMeteoError",
    "get_current_weather",
    "get_daily_forecast",
    "get_hourly_forecast",
    "httpx",
    "sample_points_along_route",
]
