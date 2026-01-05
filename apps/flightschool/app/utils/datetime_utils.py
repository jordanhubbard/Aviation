"""
Utility functions for handling date and time conversions.

Rule:
- Backend/database: UTC
- Frontend display: Local time
- Frontend input: Local time → converted to UTC for backend
"""

from datetime import datetime, timezone
import pytz

# For testing purposes, use Auckland timezone (UTC+12)
# In production, this would be determined from the user's browser or system
DEFAULT_LOCAL_TIMEZONE = 'Pacific/Auckland'

def utcnow():
    """Get current UTC datetime with timezone information."""
    return datetime.now(timezone.utc)

def get_local_timezone():
    """
    Get the local timezone.
    First tries to use tzlocal to get the system timezone,
    falls back to DEFAULT_LOCAL_TIMEZONE if that fails.
    """
    try:
        import tzlocal
        return pytz.timezone(tzlocal.get_localzone().key)
    except (ImportError, pytz.exceptions.UnknownTimeZoneError):
        return pytz.timezone(DEFAULT_LOCAL_TIMEZONE)

def to_utc(dt):
    """
    Convert a datetime to UTC.
    If the datetime is naive (no timezone), assume it's in local time and convert to UTC.
    If the datetime already has timezone info, convert to UTC.
    """
    if dt is None:
        return None
        
    # If datetime is naive (no timezone), assume it's local time
    if dt.tzinfo is None:
        local_tz = get_local_timezone()
        dt = local_tz.localize(dt)
    
    # Convert to UTC
    return dt.astimezone(timezone.utc)

def from_utc(dt, as_naive=False):
    """
    Convert a UTC datetime to local time.
    If as_naive is True, return a naive datetime (no timezone info).
    """
    if dt is None:
        return None
        
    # If datetime is naive (no timezone), assume it's UTC
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    
    # Convert to local timezone
    local_tz = get_local_timezone()
    local_dt = dt.astimezone(local_tz)
    
    # Strip timezone info if requested
    if as_naive:
        return local_dt.replace(tzinfo=None)
    
    return local_dt

def format_datetime(dt, format_str='%Y-%m-%d %H:%M:%S'):
    """Format a datetime object as a string in local time."""
    if dt is None:
        return ''
    
    # Ensure dt has timezone info
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
        
    local_dt = from_utc(dt)
    return local_dt.strftime(format_str)
