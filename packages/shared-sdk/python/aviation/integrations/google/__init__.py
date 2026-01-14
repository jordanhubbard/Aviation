"""
Google Calendar Integration for Python
Python wrapper for Google Calendar API matching TypeScript implementation
"""

from .auth import GoogleCalendarAuth
from .calendar import GoogleCalendarClient
from .types import (
    GoogleCredentials,
    GoogleOAuthConfig,
    CalendarEvent,
    CalendarDateTime,
    ListEventsOptions,
)

__all__ = [
    'GoogleCalendarAuth',
    'GoogleCalendarClient',
    'GoogleCredentials',
    'GoogleOAuthConfig',
    'CalendarEvent',
    'CalendarDateTime',
    'ListEventsOptions',
]
