"""Aviation SDK Security Module.

Provides security utilities for aviation applications:
- Rate limiting middleware
- API key authentication
- Admin function protection
- HTTPS enforcement
"""

from .rate_limiter import (
    RateLimiter,
    RateLimitExceeded,
    rate_limit,
    create_rate_limiter,
)
from .auth import (
    APIKeyAuth,
    AdminAuth,
    require_api_key,
    require_admin,
    verify_api_key,
)
from .middleware import (
    SecurityMiddleware,
    HTTPSRedirectMiddleware,
    setup_security,
)

__all__ = [
    # Rate limiting
    "RateLimiter",
    "RateLimitExceeded",
    "rate_limit",
    "create_rate_limiter",
    # Authentication
    "APIKeyAuth",
    "AdminAuth",
    "require_api_key",
    "require_admin",
    "verify_api_key",
    # Middleware
    "SecurityMiddleware",
    "HTTPSRedirectMiddleware",
    "setup_security",
]
