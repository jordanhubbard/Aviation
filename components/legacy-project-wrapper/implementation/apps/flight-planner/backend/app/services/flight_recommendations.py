"""Compatibility surface backed by the common Aviation weather SDK."""

from app.utils.paths import add_package_path

add_package_path("shared-sdk/python")

from aviation.weather.flight_category import (
    DEFAULT_THRESHOLDS,
    FlightCategory,
    FlightCategoryThresholds,
    best_departure_windows,
    estimate_ceiling_from_cloudcover,
    flight_category,
    recommendation_for_category,
    score_hour,
    warnings_for_conditions,
)

estimate_ceiling_ft_from_cloudcover = estimate_ceiling_from_cloudcover

__all__ = [
    "DEFAULT_THRESHOLDS",
    "FlightCategory",
    "FlightCategoryThresholds",
    "best_departure_windows",
    "estimate_ceiling_ft_from_cloudcover",
    "flight_category",
    "recommendation_for_category",
    "score_hour",
    "warnings_for_conditions",
]
