from __future__ import annotations


OPENAPI_TAGS = [
    {
        "name": "health",
        "description": "Service health and status endpoints.",
    },
    {
        "name": "plan",
        "description": "Unified planning endpoint (local vs route) using a mode discriminator.",
    },
    {
        "name": "airports",
        "description": "Airport search and lookup endpoints.",
    },
    {
        "name": "weather",
        "description": "Current weather, forecasts, and route weather sampling.",
    },
    {
        "name": "route",
        "description": "Route planning endpoint (direct).",
    },
    {
        "name": "local",
        "description": "Local planning endpoint (direct).",
    },
    {
        "name": "terrain",
        "description": "Terrain point and profile endpoints backed by OpenTopography.",
    },
    {
        "name": "airspace",
        "description": "Airspace endpoints (currently not implemented).",
    },
]


APP_DESCRIPTION = """
flightplanner is a unified VFR flight planning API.

Use `POST /api/plan` for a single entrypoint that supports both route planning and local planning.
""".strip()
