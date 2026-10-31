from __future__ import annotations

from dataclasses import dataclass, field
import re
from typing import Iterable, Mapping, Sequence
from urllib.parse import urlparse


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


class ConfigurationValidationError(ValueError):
    def __init__(self, code: str, message: str) -> None:
        super().__init__(message)
        self.code = code


_CATEGORIES = {"weather", "navigation", "auth", "monitoring", "streaming", "database"}
_SLUG = re.compile(r"^[a-z0-9]+(?:-[a-z0-9]+)*$")
_FIELD_KEY = re.compile(r"^[a-z][a-z0-9]*(?:_[a-z0-9]+)*$")
_ENV_VAR = re.compile(r"^[A-Z][A-Z0-9]*(?:_[A-Z0-9]+)*$")


def _required_text(value: object, code: str, label: str) -> str:
    result = str(value or "").strip()
    if not result:
        raise ConfigurationValidationError(code, f"{label} is required")
    return result


def normalize_service_definition(input_value: Mapping[str, object]) -> Service:
    """Validate and canonicalize one provider-neutral service definition."""
    identifier = str(input_value.get("id", "")).strip().lower()
    if not _SLUG.fullmatch(identifier):
        raise ConfigurationValidationError("configuration-service-id-invalid", "invalid service id")
    category = str(input_value.get("category", "")).strip().lower()
    if category not in _CATEGORIES:
        raise ConfigurationValidationError("configuration-category-invalid", "invalid category")
    docs_url = str(input_value.get("docsUrl", input_value.get("docs_url", "")) or "").strip()
    if docs_url:
        parsed = urlparse(docs_url)
        if parsed.scheme != "https" or not parsed.netloc:
            raise ConfigurationValidationError("configuration-docs-url-invalid", "docs URL must be HTTPS")

    raw_fields = input_value.get("fields")
    if not isinstance(raw_fields, Sequence) or isinstance(raw_fields, (str, bytes)) or not raw_fields:
        raise ConfigurationValidationError("configuration-fields-required", "at least one field is required")
    fields: list[ServiceField] = []
    field_keys: set[str] = set()
    env_vars: set[str] = set()
    for raw_field in raw_fields:
        if not isinstance(raw_field, Mapping):
            raise ConfigurationValidationError("configuration-field-key-invalid", "invalid field")
        key = str(raw_field.get("key", "")).strip().lower()
        if not _FIELD_KEY.fullmatch(key):
            raise ConfigurationValidationError("configuration-field-key-invalid", "invalid field key")
        if key in field_keys:
            raise ConfigurationValidationError("configuration-field-key-duplicate", "duplicate field key")
        field_keys.add(key)
        env_var = str(raw_field.get("envVar", raw_field.get("env_var", ""))).strip().upper()
        if not _ENV_VAR.fullmatch(env_var):
            raise ConfigurationValidationError("configuration-env-var-invalid", "invalid environment variable")
        if env_var in env_vars:
            raise ConfigurationValidationError("configuration-env-var-duplicate", "duplicate environment variable")
        env_vars.add(env_var)
        required = raw_field.get("required")
        secret = raw_field.get("secret")
        if not isinstance(required, bool) or not isinstance(secret, bool):
            raise ConfigurationValidationError("configuration-field-flags-invalid", "field flags must be boolean")
        fields.append(ServiceField(
            key=key,
            label=_required_text(raw_field.get("label"), "configuration-field-label-required", "field label"),
            description=_required_text(raw_field.get("description"), "configuration-field-description-required", "field description"),
            required=required,
            secret=secret,
            env_var=env_var,
        ))

    raw_scope = input_value.get("appScope", input_value.get("app_scope"))
    if not isinstance(raw_scope, Sequence) or isinstance(raw_scope, (str, bytes)) or not raw_scope:
        raise ConfigurationValidationError("configuration-app-scope-required", "application scope is required")
    app_scope: list[str] = []
    for raw_app in raw_scope:
        app = str(raw_app or "").strip().lower()
        if app != "all" and not _SLUG.fullmatch(app):
            raise ConfigurationValidationError("configuration-app-scope-invalid", "invalid application scope")
        if app not in app_scope:
            app_scope.append(app)
    return Service(
        id=identifier,
        name=_required_text(input_value.get("name"), "configuration-service-name-required", "service name"),
        description=_required_text(input_value.get("description"), "configuration-service-description-required", "service description"),
        category=category,
        docs_url=docs_url,
        fields=fields,
        app_scope=app_scope,
    )


def normalize_service_catalog(inputs: Sequence[Mapping[str, object]]) -> list[Service]:
    services = [normalize_service_definition(value) for value in inputs]
    identifiers: set[str] = set()
    env_owners: set[str] = set()
    for service in services:
        if service.id in identifiers:
            raise ConfigurationValidationError("configuration-service-id-duplicate", "duplicate service id")
        identifiers.add(service.id)
        for field_value in service.fields:
            if field_value.env_var in env_owners:
                raise ConfigurationValidationError("configuration-env-var-duplicate", "environment variable has multiple owners")
            env_owners.add(field_value.env_var)
    return services


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


def get_services_by_app(app_id: str, catalog: Sequence[Service] = SERVICE_REGISTRY) -> list[Service]:
    """Return all services relevant to the given app."""
    canonical_app_id = str(app_id or "").strip().lower()
    return [s for s in catalog if canonical_app_id in s.app_scope or "all" in s.app_scope]


def get_service_by_id(service_id: str, catalog: Sequence[Service] = SERVICE_REGISTRY) -> Service | None:
    """Return the Service with the given id, or None."""
    canonical_id = str(service_id or "").strip().lower()
    return next((s for s in catalog if s.id == canonical_id), None)


def build_service_status(service: Service, configured_keys: Iterable[str]) -> dict[str, object]:
    """Return value-free field status and required-field service status."""
    configured = {str(key).strip().lower() for key in configured_keys}
    fields = [
        {"key": field_value.key, "configured": field_value.key in configured}
        for field_value in service.fields
    ]
    return {
        "id": service.id,
        "configured": all(not field_value.required or field_value.key in configured for field_value in service.fields),
        "fields": fields,
    }
