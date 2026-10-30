"""Compatibility surface backed by the common Aviation weather SDK."""

from app.utils.paths import add_package_path

add_package_path("shared-sdk/python")

from aviation.weather.openweathermap import (
    OpenWeatherMapError,
    get_current_weather,
    httpx,
    to_weather_data,
)

__all__ = ["OpenWeatherMapError", "get_current_weather", "httpx", "to_weather_data"]
