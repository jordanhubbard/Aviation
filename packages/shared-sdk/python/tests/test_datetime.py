"""
Tests for datetime utilities
"""

import pytest
from datetime import datetime, timezone, timedelta
from aviation.datetime import (
    utcnow,
    get_timezone,
    to_utc,
    from_utc,
    to_zulu,
    from_zulu,
    format_datetime,
    format_flight_time,
    parse_flight_time,
    calculate_sunrise_sunset,
    is_night,
    add_flight_time,
)


class TestDatetimeUtilities:
    """Test datetime utility functions"""

    def test_utcnow(self):
        """Test utcnow returns current UTC time"""
        now = utcnow()
        assert isinstance(now, datetime)
        assert now.tzinfo == timezone.utc
        assert now > datetime(2026, 1, 1, tzinfo=timezone.utc)

    def test_get_timezone(self):
        """Test timezone retrieval"""
        import pytz
        
        tz = get_timezone('America/Los_Angeles')
        assert isinstance(tz, pytz.tzinfo.BaseTzInfo)
        assert str(tz) == 'America/Los_Angeles'

    def test_to_utc_aware(self):
        """Test to_utc with timezone-aware datetime"""
        dt = datetime(2026, 1, 15, 10, 30, tzinfo=timezone.utc)
        result = to_utc(dt)
        assert result is not None
        assert result.tzinfo == timezone.utc
        assert result.isoformat() == '2026-01-15T10:30:00+00:00'

    def test_to_utc_naive(self):
        """Test to_utc with naive datetime"""
        dt = datetime(2026, 1, 15, 10, 30)
        result = to_utc(dt, 'America/Los_Angeles')
        assert result is not None
        assert result.tzinfo == timezone.utc
        # Should be 8 hours ahead (PST is UTC-8)
        assert result.hour == 18

    def test_to_utc_none(self):
        """Test to_utc with None"""
        result = to_utc(None)
        assert result is None

    def test_from_utc_aware(self):
        """Test from_utc with timezone-aware datetime"""
        utc_dt = datetime(2026, 1, 15, 18, 30, tzinfo=timezone.utc)
        result = from_utc(utc_dt, 'America/Los_Angeles')
        assert result is not None
        # Should be 8 hours earlier (PST is UTC-8)
        assert result.hour == 10

    def test_from_utc_naive(self):
        """Test from_utc with naive datetime (assumes UTC)"""
        naive_dt = datetime(2026, 1, 15, 18, 30)
        result = from_utc(naive_dt, 'America/Los_Angeles')
        assert result is not None
        assert result.hour == 10

    def test_from_utc_as_naive(self):
        """Test from_utc with as_naive=True"""
        utc_dt = datetime(2026, 1, 15, 18, 30, tzinfo=timezone.utc)
        result = from_utc(utc_dt, 'America/Los_Angeles', as_naive=True)
        assert result is not None
        assert result.tzinfo is None
        assert result.hour == 10

    def test_from_utc_none(self):
        """Test from_utc with None"""
        result = from_utc(None)
        assert result is None

    def test_to_zulu(self):
        """Test to_zulu conversion"""
        dt = datetime(2026, 1, 15, 10, 30, tzinfo=timezone.utc)
        zulu = to_zulu(dt)
        assert zulu == '2026-01-15T10:30:00Z'

    def test_to_zulu_none(self):
        """Test to_zulu with None"""
        result = to_zulu(None)
        assert result is None

    def test_from_zulu(self):
        """Test from_zulu parsing"""
        dt = from_zulu('2026-01-15T10:30:00Z')
        assert dt is not None
        assert dt.tzinfo == timezone.utc
        assert dt.isoformat() == '2026-01-15T10:30:00+00:00'

    def test_from_zulu_none(self):
        """Test from_zulu with None"""
        result = from_zulu(None)
        assert result is None

    def test_zulu_round_trip(self):
        """Test zulu conversion round trip"""
        original = datetime(2026, 1, 15, 10, 30, tzinfo=timezone.utc)
        zulu = to_zulu(original)
        parsed = from_zulu(zulu)
        assert parsed.isoformat() == original.isoformat()

    def test_format_datetime_default(self):
        """Test format_datetime with default options"""
        dt = datetime(2026, 1, 15, 18, 30, tzinfo=timezone.utc)
        formatted = format_datetime(dt, '%Y-%m-%d %H:%M:%S', 'America/Los_Angeles')
        assert '2026' in formatted
        assert '15' in formatted or '01' in formatted

    def test_format_datetime_custom(self):
        """Test format_datetime with custom format"""
        dt = datetime(2026, 1, 15, 18, 30, tzinfo=timezone.utc)
        formatted = format_datetime(dt, '%Y-%m-%d', 'UTC')
        assert formatted == '2026-01-15'

    def test_format_datetime_none(self):
        """Test format_datetime with None"""
        result = format_datetime(None)
        assert result == ''

    def test_format_flight_time_hours_minutes(self):
        """Test format_flight_time with hours and minutes"""
        assert format_flight_time(150) == '2h 30m'

    def test_format_flight_time_hours_only(self):
        """Test format_flight_time with hours only"""
        assert format_flight_time(120) == '2h'

    def test_format_flight_time_minutes_only(self):
        """Test format_flight_time with minutes only"""
        assert format_flight_time(45) == '45m'

    def test_format_flight_time_zero(self):
        """Test format_flight_time with zero"""
        assert format_flight_time(0) == '0m'

    def test_format_flight_time_negative(self):
        """Test format_flight_time with negative value"""
        assert format_flight_time(-10) == '0m'

    def test_parse_flight_time_hours_minutes(self):
        """Test parse_flight_time with h m format"""
        assert parse_flight_time('2h 30m') == 150.0

    def test_parse_flight_time_hours_only(self):
        """Test parse_flight_time with hours only"""
        assert parse_flight_time('2h') == 120.0

    def test_parse_flight_time_minutes_only(self):
        """Test parse_flight_time with minutes only"""
        assert parse_flight_time('30m') == 30.0

    def test_parse_flight_time_decimal(self):
        """Test parse_flight_time with decimal hours"""
        assert parse_flight_time('2.5') == 150.0

    def test_parse_flight_time_whitespace(self):
        """Test parse_flight_time with extra whitespace"""
        assert parse_flight_time('  2h  30m  ') == 150.0

    def test_parse_flight_time_case_insensitive(self):
        """Test parse_flight_time is case insensitive"""
        assert parse_flight_time('2H 30M') == 150.0

    def test_flight_time_round_trip(self):
        """Test flight time format and parse round trip"""
        original = 150.0
        formatted = format_flight_time(original)
        parsed = parse_flight_time(formatted)
        assert parsed == original

    def test_calculate_sunrise_sunset_san_francisco(self):
        """Test sunrise/sunset for San Francisco"""
        date = datetime(2026, 1, 15, 12, 0, tzinfo=timezone.utc)
        sunrise, sunset = calculate_sunrise_sunset(37.7749, -122.4194, date)
        
        # Verify we get valid datetime objects
        assert isinstance(sunrise, datetime)
        assert isinstance(sunset, datetime)
        assert sunrise.tzinfo == timezone.utc
        assert sunset.tzinfo == timezone.utc
        
        # Basic sanity check - both should be within the target date +/- 1 day
        assert date.date() - timedelta(days=1) <= sunrise.date() <= date.date() + timedelta(days=1)
        assert date.date() - timedelta(days=1) <= sunset.date() <= date.date() + timedelta(days=1)

    def test_calculate_sunrise_sunset_different_locations(self):
        """Test sunrise/sunset for different locations"""
        date = datetime(2026, 1, 15, 12, 0, tzinfo=timezone.utc)
        sf_rise, sf_set = calculate_sunrise_sunset(37.7749, -122.4194, date)
        ny_rise, ny_set = calculate_sunrise_sunset(40.7128, -74.0060, date)
        
        # NY should have different times than SF
        assert sf_rise != ny_rise
        assert sf_set != ny_set

    def test_calculate_sunrise_sunset_current_date(self):
        """Test sunrise/sunset with current date"""
        sunrise, sunset = calculate_sunrise_sunset(37.7749, -122.4194)
        
        # Verify we get valid datetime objects
        assert isinstance(sunrise, datetime)
        assert isinstance(sunset, datetime)
        assert sunrise.tzinfo == timezone.utc
        assert sunset.tzinfo == timezone.utc
        
        # Basic sanity check - both should be recent
        now = utcnow()
        assert abs((sunrise - now).days) <= 2
        assert abs((sunset - now).days) <= 2

    def test_is_night(self):
        """Test is_night detection"""
        result = is_night(37.7749, -122.4194)
        assert isinstance(result, bool)

    def test_is_night_specific_date(self):
        """Test is_night at specific date"""
        midnight_utc = datetime(2026, 1, 15, 0, 0, tzinfo=timezone.utc)
        result = is_night(37.7749, -122.4194, midnight_utc)
        assert isinstance(result, bool)

    def test_add_flight_time(self):
        """Test add_flight_time"""
        base = datetime(2026, 1, 15, 10, 0, tzinfo=timezone.utc)
        result = add_flight_time(base, 150)
        
        expected = datetime(2026, 1, 15, 12, 30, tzinfo=timezone.utc)
        assert result == expected

    def test_add_flight_time_zero(self):
        """Test add_flight_time with zero"""
        base = datetime(2026, 1, 15, 10, 0, tzinfo=timezone.utc)
        result = add_flight_time(base, 0)
        
        assert result == base

    def test_add_flight_time_negative(self):
        """Test add_flight_time with negative (go back in time)"""
        base = datetime(2026, 1, 15, 10, 0, tzinfo=timezone.utc)
        result = add_flight_time(base, -30)
        
        expected = datetime(2026, 1, 15, 9, 30, tzinfo=timezone.utc)
        assert result == expected

    def test_add_flight_time_day_boundary(self):
        """Test add_flight_time crossing day boundary"""
        base = datetime(2026, 1, 15, 23, 0, tzinfo=timezone.utc)
        result = add_flight_time(base, 120)
        
        expected = datetime(2026, 1, 16, 1, 0, tzinfo=timezone.utc)
        assert result == expected

    def test_integration_flight_workflow(self):
        """Test complete flight planning workflow"""
        # Plan a flight
        departure = datetime(2026, 1, 15, 10, 0, tzinfo=timezone.utc)
        flight_duration = parse_flight_time('2h 30m')
        arrival = add_flight_time(departure, flight_duration)
        
        # Verify times
        diff = (arrival - departure).total_seconds() / 60
        assert diff == 150
        assert format_flight_time(flight_duration) == '2h 30m'
        
        # Check if departure is during night
        night_flight = is_night(37.7749, -122.4194, departure)
        assert isinstance(night_flight, bool)

    def test_integration_zulu_logging(self):
        """Test Zulu time formatting for logging"""
        departure = datetime(2026, 1, 15, 18, 30, tzinfo=timezone.utc)
        arrival = datetime(2026, 1, 15, 21, 0, tzinfo=timezone.utc)
        
        dep_zulu = to_zulu(departure)
        arr_zulu = to_zulu(arrival)
        duration = (arrival - departure).total_seconds() / 60
        
        assert dep_zulu == '2026-01-15T18:30:00Z'
        assert arr_zulu == '2026-01-15T21:00:00Z'
        assert format_flight_time(duration) == '2h 30m'
