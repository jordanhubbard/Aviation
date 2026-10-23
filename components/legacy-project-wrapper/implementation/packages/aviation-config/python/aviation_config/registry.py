from __future__ import annotations

from dataclasses import dataclass, field


@dataclass
class ServiceField:
    key: str
    label: str
    description: str
    required: bool
    secret: bool
    env_var: str


@dataclass
class Service:
    id: str
    name: str
    description: str
    category: str
    fields: list[ServiceField]
    app_scope: list[str]
    docs_url: str = ""


SERVICE_REGISTRY: list[Service] = [
    Service(
        id="openweather",
        name="OpenWeatherMap",
        description="Weather data for flight planning and briefings",
        category="weather",
        docs_url="https://openweathermap.org/api",
        fields=[
            ServiceField(
                key="api_key",
                label="API Key",
                description="Your OpenWeatherMap API key",
                required=True,
                secret=True,
                env_var="OPENWEATHERMAP_API_KEY",
            )
        ],
        app_scope=["flight-planner", "weather-briefing", "g1000-simulator"],
    ),
    Service(
        id="openaip",
        name="OpenAIP",
        description="Airspace, airports, and navigation data",
        category="navigation",
        docs_url="https://www.openaip.net/",
        fields=[
            ServiceField(
                key="api_key",
                label="API Key",
                description="Your OpenAIP API key",
                required=True,
                secret=True,
                env_var="OPENAIP_API_KEY",
            )
        ],
        app_scope=["flight-planner", "g1000-simulator"],
    ),
    Service(
        id="opentopography",
        name="OpenTopography",
        description="Terrain and elevation data for flight planning",
        category="navigation",
        docs_url="https://opentopography.org/",
        fields=[
            ServiceField(
                key="api_key",
                label="API Key",
                description="Your OpenTopography API key",
                required=False,
                secret=True,
                env_var="OPENTOPOGRAPHY_API_KEY",
            )
        ],
        app_scope=["flight-planner"],
    ),
    Service(
        id="foreflight",
        name="ForeFlight",
        description="ForeFlight logbook and flight data API",
        category="navigation",
        docs_url="https://developer.foreflight.com/",
        fields=[
            ServiceField(
                key="api_key",
                label="API Key",
                description="ForeFlight API key",
                required=True,
                secret=True,
                env_var="FOREFLIGHT_API_KEY",
            ),
            ServiceField(
                key="api_secret",
                label="API Secret",
                description="ForeFlight API secret",
                required=True,
                secret=True,
                env_var="FOREFLIGHT_API_SECRET",
            ),
        ],
        app_scope=["foreflight-dashboard"],
    ),
    Service(
        id="google-oauth",
        name="Google OAuth",
        description="Google authentication for flight school and calendar",
        category="auth",
        docs_url="https://console.cloud.google.com/",
        fields=[
            ServiceField(
                key="client_id",
                label="Client ID",
                description="Google OAuth client ID",
                required=True,
                secret=False,
                env_var="GOOGLE_CLIENT_ID",
            ),
            ServiceField(
                key="client_secret",
                label="Client Secret",
                description="Google OAuth client secret",
                required=True,
                secret=True,
                env_var="GOOGLE_CLIENT_SECRET",
            ),
            ServiceField(
                key="redirect_uri",
                label="Redirect URI",
                description="OAuth redirect URI",
                required=False,
                secret=False,
                env_var="GOOGLE_REDIRECT_URI",
            ),
        ],
        app_scope=["flightschool"],
    ),
    Service(
        id="smtp",
        name="Email (SMTP)",
        description="Email notifications for flight school",
        category="monitoring",
        fields=[
            ServiceField(
                key="server",
                label="SMTP Server",
                description="Mail server hostname",
                required=True,
                secret=False,
                env_var="MAIL_SERVER",
            ),
            ServiceField(
                key="port",
                label="Port",
                description="SMTP port (default: 587)",
                required=False,
                secret=False,
                env_var="MAIL_PORT",
            ),
            ServiceField(
                key="username",
                label="Username",
                description="SMTP username",
                required=False,
                secret=False,
                env_var="MAIL_USERNAME",
            ),
            ServiceField(
                key="password",
                label="Password",
                description="SMTP password",
                required=False,
                secret=True,
                env_var="MAIL_PASSWORD",
            ),
        ],
        app_scope=["flightschool"],
    ),
    Service(
        id="sentry",
        name="Sentry",
        description="Error tracking and monitoring",
        category="monitoring",
        docs_url="https://sentry.io/",
        fields=[
            ServiceField(
                key="dsn",
                label="DSN",
                description="Sentry DSN URL",
                required=False,
                secret=True,
                env_var="SENTRY_DSN",
            )
        ],
        app_scope=["all"],
    ),
    Service(
        id="g1000-stream",
        name="G1000 Stream API",
        description="API key for G1000 simulator real-time telemetry streaming",
        category="streaming",
        fields=[
            ServiceField(
                key="api_key",
                label="Stream API Key",
                description="G1000 simulator streaming API key",
                required=False,
                secret=True,
                env_var="G1000_STREAM_API_KEY",
            )
        ],
        app_scope=["g1000-simulator"],
    ),
    Service(
        id="database",
        name="Database",
        description="PostgreSQL or SQLite database connection",
        category="database",
        fields=[
            ServiceField(
                key="url",
                label="Database URL",
                description="Connection string (e.g. postgresql://user:pass@host/db)",
                required=False,
                secret=True,
                env_var="DATABASE_URL",
            )
        ],
        app_scope=["flightschool", "foreflight-dashboard", "flight-planner"],
    ),
    Service(
        id="redis",
        name="Redis",
        description="Redis cache for session and API response caching",
        category="database",
        fields=[
            ServiceField(
                key="url",
                label="Redis URL",
                description="Redis connection URL (e.g. redis://localhost:6379)",
                required=False,
                secret=False,
                env_var="REDIS_URL",
            )
        ],
        app_scope=["foreflight-dashboard", "flight-planner"],
    ),
]


def get_services_by_app(app_id: str) -> list[Service]:
    """Return all services relevant to the given app."""
    return [s for s in SERVICE_REGISTRY if app_id in s.app_scope or "all" in s.app_scope]


def get_service_by_id(service_id: str) -> Service | None:
    """Return the Service with the given id, or None."""
    return next((s for s in SERVICE_REGISTRY if s.id == service_id), None)
