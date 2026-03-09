"""Aviation SDK Security Module.

Provides security utilities for aviation applications:
- Rate limiting middleware
- Authentication decorators
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
    require_auth,
    require_admin,
    AuthenticationError,
    AuthorizationError,
    verify_api_key,
    verify_token,
)
from .middleware import (
    SecurityMiddleware,
    HTTPSRedirectMiddleware,
    RateLimitMiddleware,
)

__all__ = [
    # Rate limiting
    "RateLimiter",
    "RateLimitExceeded",
    "rate_limit",
    "create_rate_limiter",
    # Authentication
    "require_auth",
    "require_admin",
    "AuthenticationError",
    "AuthorizationError",
    "verify_api_key",
    "verify_token",
    # Middleware
    "SecurityMiddleware",
    "HTTPSRedirectMiddleware",
    "RateLimitMiddleware",
]
