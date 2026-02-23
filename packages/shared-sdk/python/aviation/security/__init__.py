"""Aviation SDK Security Module.

Provides security utilities for aviation applications:
- Rate limiting middleware for FastAPI
- Authentication decorators for admin functions
- HTTPS enforcement utilities
- Privacy-compliant data handling
"""

from .rate_limiter import (
    RateLimiter,
    RateLimitMiddleware,
    rate_limit,
    InMemoryRateLimitStore,
    RateLimitExceeded,
)
from .auth import (
    AdminAuth,
    require_admin,
    api_key_auth,
    APIKeyHeader,
)
from .https import (
    HTTPSRedirectMiddleware,
    require_https,
    is_production,
)
from .privacy import (
    PrivacyConfig,
    require_consent,
    anonymize_data,
    DataCollectionScope,
)

__all__ = [
    # Rate limiting
    "RateLimiter",
    "RateLimitMiddleware",
    "rate_limit",
    "InMemoryRateLimitStore",
    "RateLimitExceeded",
    # Authentication
    "AdminAuth",
    "require_admin",
    "api_key_auth",
    "APIKeyHeader",
    # HTTPS
    "HTTPSRedirectMiddleware",
    "require_https",
    "is_production",
    # Privacy
    "PrivacyConfig",
    "require_consent",
    "anonymize_data",
    "DataCollectionScope",
]
