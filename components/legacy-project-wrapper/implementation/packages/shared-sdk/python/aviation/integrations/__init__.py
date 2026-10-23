"""
Aviation Integrations
Shared integrations for third-party services
"""

try:
    from .google import *

    __all__ = ["google"]
except Exception:
    __all__ = []
