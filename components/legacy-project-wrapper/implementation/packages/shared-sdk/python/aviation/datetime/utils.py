"""
Date and time utilities for aviation applications.

Provides comprehensive date/time handling including:
- UTC/Zulu time conversions
- Timezone management
- Aviation-specific formatting
- Sunrise/sunset calculations
- Flight time formatting

Standard Rule:
- Backend/database: Always UTC
- Frontend display: Local time
- Frontend input: Local time → converted to UTC for backend
"""

from datetime import datetime, timezone, timedelta
from typing import Optional, Tuple
import pytz
import math

# Default timezone for fallback
DEFAULT_TIMEZONE = 'UTC'


def utcnow() -> datetime:
    """
    Get current UTC datetime with timezone information.
    
    Returns:
        datetime: Current time in UTC with timezone info
        
    Example:
        >>> now = utcnow()
        >>> print(now.tzinfo)
        UTC
    """
    return datetime.now(timezone.utc)


def get_timezone(tz_name: Optional[str] = None) -> pytz.timezone:
    """
    Get a timezone object by name.
    
    Args:
        tz_name: Timezone name (e.g., 'America/Los_Angeles', 'Pacific/Auckland')
                If None, tries to detect local timezone
    
    Returns:
        pytz.timezone: Timezone object
        
    Example:
        >>> tz = get_timezone('America/Los_Angeles')
        >>> print(tz)
        America/Los_Angeles
    """
    import os
    
    # If specific timezone requested, use it
    if tz_name:
        try:
            return pytz.timezone(tz_name)
        except pytz.exceptions.UnknownTimeZoneError:
            pass
    
    # Check environment variable
    env_tz = os.environ.get('AVIATION_TIMEZONE')
    if env_tz:
        try:
            return pytz.timezone(env_tz)
        except pytz.exceptions.UnknownTimeZoneError:
            pass
    
    # Try to detect system timezone
    try:
        import tzlocal
        return pytz.timezone(tzlocal.get_localzone().key)
    except (ImportError, pytz.exceptions.UnknownTimeZoneError):
        return pytz.timezone(DEFAULT_TIMEZONE)


def to_utc(dt: Optional[datetime], assume_tz: Optional[str] = None) -> Optional[datetime]:
    """
    Convert a datetime to UTC.
    
    Args:
        dt: Datetime to convert (can be naive or aware)
        assume_tz: Timezone to assume if dt is naive (default: local timezone)
    
    Returns:
        datetime: UTC datetime with timezone info, or None if dt is None
        
    Example:
        >>> local_dt = datetime(2026, 1, 15, 10, 30)  # Naive
        >>> utc_dt = to_utc(local_dt, 'America/Los_Angeles')
        >>> print(utc_dt)
        2026-01-15 18:30:00+00:00
    """
    if dt is None:
        return None
    
    # If datetime is naive (no timezone), localize it
    if dt.tzinfo is None:
        tz = get_timezone(assume_tz)
        dt = tz.localize(dt)
    
    # Convert to UTC
    return dt.astimezone(timezone.utc)


def from_utc(dt: Optional[datetime], to_tz: Optional[str] = None, as_naive: bool = False) -> Optional[datetime]:
    """
    Convert a UTC datetime to a specific timezone.
    
    Args:
        dt: UTC datetime to convert
        to_tz: Target timezone (default: local timezone)
        as_naive: If True, return naive datetime (no timezone info)
    
    Returns:
        datetime: Converted datetime, or None if dt is None
        
    Example:
        >>> utc_dt = datetime(2026, 1, 15, 18, 30, tzinfo=timezone.utc)
        >>> local_dt = from_utc(utc_dt, 'America/Los_Angeles')
        >>> print(local_dt)
        2026-01-15 10:30:00-08:00
    """
    if dt is None:
        return None
    
    # If datetime is naive, assume it's UTC
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    
    # Get target timezone
    target_tz = get_timezone(to_tz)
    
    # Convert to target timezone
    local_dt = dt.astimezone(target_tz)
    
    # Strip timezone info if requested
    if as_naive:
        return local_dt.replace(tzinfo=None)
    
    return local_dt


def to_zulu(dt: Optional[datetime]) -> Optional[str]:
    """
    Convert datetime to Zulu time string (ISO 8601 format with Z suffix).
    
    Args:
        dt: Datetime to convert
    
    Returns:
        str: ISO 8601 string with Z suffix (e.g., '2026-01-15T18:30:00Z'), or None
        
    Example:
        >>> dt = datetime(2026, 1, 15, 18, 30, tzinfo=timezone.utc)
        >>> zulu = to_zulu(dt)
        >>> print(zulu)
        2026-01-15T18:30:00Z
    """
    if dt is None:
        return None
    
    utc_dt = to_utc(dt)
    return utc_dt.strftime('%Y-%m-%dT%H:%M:%SZ')


def from_zulu(zulu_str: Optional[str]) -> Optional[datetime]:
    """
    Parse a Zulu time string to UTC datetime.
    
    Args:
        zulu_str: ISO 8601 string with Z suffix
    
    Returns:
        datetime: UTC datetime with timezone info, or None
        
    Example:
        >>> dt = from_zulu('2026-01-15T18:30:00Z')
        >>> print(dt)
        2026-01-15 18:30:00+00:00
    """
    if not zulu_str:
        return None
    
    # Remove Z suffix and parse
    if zulu_str.endswith('Z'):
        zulu_str = zulu_str[:-1]
    
    try:
        dt = datetime.fromisoformat(zulu_str)
        return dt.replace(tzinfo=timezone.utc)
    except ValueError:
        return None


def format_datetime(dt: Optional[datetime], format_str: str = '%Y-%m-%d %H:%M:%S', 
                    to_tz: Optional[str] = None) -> str:
    """
    Format a datetime object as a string in a specific timezone.
    
    Args:
        dt: Datetime to format
        format_str: Python strftime format string
        to_tz: Target timezone (default: local timezone)
    
    Returns:
        str: Formatted datetime string, or empty string if dt is None
        
    Example:
        >>> utc_dt = datetime(2026, 1, 15, 18, 30, tzinfo=timezone.utc)
        >>> formatted = format_datetime(utc_dt, '%B %d, %Y at %I:%M %p', 'America/Los_Angeles')
        >>> print(formatted)
        January 15, 2026 at 10:30 AM
    """
    if dt is None:
        return ''
    
    # Convert to target timezone
    local_dt = from_utc(dt, to_tz)
    
    return local_dt.strftime(format_str)


def format_flight_time(minutes: float) -> str:
    """
    Format flight time in minutes to human-readable format.
    
    Args:
        minutes: Flight time in minutes
    
    Returns:
        str: Formatted string like "2h 30m" or "45m"
        
    Example:
        >>> print(format_flight_time(150))
        2h 30m
        >>> print(format_flight_time(45))
        45m
    """
    if minutes < 0:
        return '0m'
    
    hours = int(minutes // 60)
    mins = int(minutes % 60)
    
    if hours == 0:
        return f'{mins}m'
    elif mins == 0:
        return f'{hours}h'
    else:
        return f'{hours}h {mins}m'


def parse_flight_time(time_str: str) -> float:
    """
    Parse a flight time string to minutes.
    
    Args:
        time_str: Time string like "2h 30m", "2.5", "150"
    
    Returns:
        float: Time in minutes
        
    Example:
        >>> print(parse_flight_time('2h 30m'))
        150.0
        >>> print(parse_flight_time('2.5'))
        150.0
    """
    time_str = time_str.strip().lower()
    
    # Try decimal hours first (e.g., "2.5")
    try:
        hours = float(time_str)
        return hours * 60
    except ValueError:
        pass
    
    # Parse "2h 30m" format
    total_minutes = 0.0
    
    if 'h' in time_str:
        parts = time_str.split('h')
        try:
            hours = float(parts[0].strip())
            total_minutes += hours * 60
            time_str = parts[1].strip() if len(parts) > 1 else ''
        except ValueError:
            pass
    
    if 'm' in time_str:
        try:
            minutes = float(time_str.replace('m', '').strip())
            total_minutes += minutes
        except ValueError:
            pass
    
    return total_minutes


def calculate_sunrise_sunset(
    latitude: float,
    longitude: float,
    date: Optional[datetime] = None
) -> Tuple[datetime, datetime]:
    """
    Calculate sunrise and sunset times for a given location and date.
    
    Uses a simplified astronomical formula. Accurate to within a few minutes.
    
    Args:
        latitude: Latitude in degrees (-90 to 90)
        longitude: Longitude in degrees (-180 to 180)
        date: Date to calculate for (default: today in UTC)
    
    Returns:
        tuple: (sunrise_utc, sunset_utc) as UTC datetimes
        
    Example:
        >>> # San Francisco coordinates
        >>> sunrise, sunset = calculate_sunrise_sunset(37.7749, -122.4194)
        >>> print(f'Sunrise: {sunrise.strftime("%H:%M")} UTC')
        >>> print(f'Sunset: {sunset.strftime("%H:%M")} UTC')
    """
    if date is None:
        date = utcnow()
    
    # Convert to UTC if not already
    date_utc = to_utc(date)
    
    # Day of year
    n = date_utc.timetuple().tm_yday
    
    # Longitude hour value
    lng_hour = longitude / 15.0
    
    # Approximate time
    t_rise = n + ((6 - lng_hour) / 24.0)
    t_set = n + ((18 - lng_hour) / 24.0)
    
    # Sun's mean anomaly
    m_rise = (0.9856 * t_rise) - 3.289
    m_set = (0.9856 * t_set) - 3.289
    
    # Sun's true longitude
    def sun_longitude(m):
        l = m + (1.916 * math.sin(math.radians(m))) + (0.020 * math.sin(math.radians(2 * m))) + 282.634
        return l % 360
    
    l_rise = sun_longitude(m_rise)
    l_set = sun_longitude(m_set)
    
    # Sun's right ascension
    def right_ascension(l):
        ra = math.degrees(math.atan(0.91764 * math.tan(math.radians(l))))
        ra = ra % 360
        
        # Adjust into same quadrant as L
        l_quadrant = (math.floor(l / 90)) * 90
        ra_quadrant = (math.floor(ra / 90)) * 90
        ra = ra + (l_quadrant - ra_quadrant)
        
        return ra / 15.0  # Convert to hours
    
    ra_rise = right_ascension(l_rise)
    ra_set = right_ascension(l_set)
    
    # Sun's declination
    def declination(l):
        sin_dec = 0.39782 * math.sin(math.radians(l))
        return math.degrees(math.asin(sin_dec))
    
    sin_dec_rise = math.sin(math.radians(declination(l_rise)))
    cos_dec_rise = math.cos(math.radians(declination(l_rise)))
    sin_dec_set = math.sin(math.radians(declination(l_set)))
    cos_dec_set = math.cos(math.radians(declination(l_set)))
    
    # Sun's local hour angle
    cos_h = (math.cos(math.radians(90.833)) - (sin_dec_rise * math.sin(math.radians(latitude)))) / \
            (cos_dec_rise * math.cos(math.radians(latitude)))
    
    # Check if sun never rises or sets
    if cos_h > 1:
        # Sun never rises
        h_rise = 0
        h_set = 0
    elif cos_h < -1:
        # Sun never sets
        h_rise = 180
        h_set = 180
    else:
        h_rise = 360 - math.degrees(math.acos(cos_h))
        h_rise = h_rise / 15.0
        
        h_set = math.degrees(math.acos(cos_h))
        h_set = h_set / 15.0
    
    # Local mean time
    t_rise_local = h_rise + ra_rise - (0.06571 * t_rise) - 6.622
    t_set_local = h_set + ra_set - (0.06571 * t_set) - 6.622
    
    # Adjust to UTC
    ut_rise = (t_rise_local - lng_hour) % 24
    ut_set = (t_set_local - lng_hour) % 24
    
    # Create datetime objects
    sunrise = datetime(date_utc.year, date_utc.month, date_utc.day, tzinfo=timezone.utc)
    sunrise = sunrise + timedelta(hours=ut_rise)
    
    sunset = datetime(date_utc.year, date_utc.month, date_utc.day, tzinfo=timezone.utc)
    sunset = sunset + timedelta(hours=ut_set)
    
    return sunrise, sunset


def is_night(
    latitude: float,
    longitude: float,
    dt: Optional[datetime] = None
) -> bool:
    """
    Determine if a given time is during night hours (after sunset, before sunrise).
    
    Args:
        latitude: Latitude in degrees
        longitude: Longitude in degrees
        dt: Datetime to check (default: now in UTC)
    
    Returns:
        bool: True if night time, False if daytime
        
    Example:
        >>> # Check if it's night time in San Francisco
        >>> is_night_time = is_night(37.7749, -122.4194)
        >>> print('Night' if is_night_time else 'Day')
    """
    if dt is None:
        dt = utcnow()
    
    dt_utc = to_utc(dt)
    sunrise, sunset = calculate_sunrise_sunset(latitude, longitude, dt_utc)
    
    return dt_utc < sunrise or dt_utc > sunset


def add_flight_time(base_time: datetime, flight_minutes: float) -> datetime:
    """
    Add flight time to a base datetime.
    
    Args:
        base_time: Starting datetime
        flight_minutes: Flight time in minutes
    
    Returns:
        datetime: Resulting datetime
        
    Example:
        >>> departure = datetime(2026, 1, 15, 10, 0, tzinfo=timezone.utc)
        >>> arrival = add_flight_time(departure, 150)  # 2h 30m flight
        >>> print(arrival)
        2026-01-15 12:30:00+00:00
    """
    return base_time + timedelta(minutes=flight_minutes)
