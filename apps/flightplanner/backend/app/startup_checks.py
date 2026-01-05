from __future__ import annotations

import os
from typing import Any, Dict, List


def collect_startup_config_issues() -> List[Dict[str, Any]]:
    """Return a list of configuration issues to surface at startup.

    These are primarily missing API keys that will cause specific endpoints/features
    to fail at runtime.
    """

    issues: List[Dict[str, Any]] = []

    openweather_key = os.environ.get("OPENWEATHERMAP_API_KEY") or os.environ.get(
        "OPENWEATHER_API_KEY"
    )
    if not openweather_key:
        issues.append(
            {
                "severity": "warning",
                "missing": ["OPENWEATHERMAP_API_KEY"],
                "feature": "Weather (OpenWeatherMap current conditions)",
                "impact": "Requests to /api/weather/* will fail.",
                "remediation": [
                    "Create an OpenWeatherMap account and generate an API key: https://openweathermap.org/api",
                    "Set OPENWEATHERMAP_API_KEY in your environment or .env file and restart the backend.",
                ],
            }
        )

    terrain_provider = (os.environ.get("TERRAIN_PROVIDER") or "open-meteo").strip().lower()
    if terrain_provider.replace("_", "-") == "opentopography":
        opentopo_key = os.environ.get("OPENTOPOGRAPHY_API_KEY")
        if not opentopo_key:
            issues.append(
                {
                    "severity": "warning",
                    "missing": ["OPENTOPOGRAPHY_API_KEY"],
                    "feature": "Terrain / elevation (OpenTopography SRTM API)",
                    "impact": "Terrain endpoints (/api/terrain/*) and terrain avoidance/elevation profile will fail.",
                    "remediation": [
                        "OpenTopography provides elevation data (SRTM) used for terrain analysis: https://opentopography.org/",
                        "Generate an API key from your OpenTopography account (My Account → API Keys).",
                        "Set OPENTOPOGRAPHY_API_KEY in your environment or .env file and restart the backend.",
                    ],
                }
            )

    return issues
