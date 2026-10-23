"""
Test the date/time handling in the FlightSchool application.
Ensures that local times are properly converted to UTC for storage
and UTC times are properly converted back to local time for display.
"""

import pytest
from datetime import datetime, timedelta, timezone
import pytz
from app.utils.datetime_utils import utcnow, to_utc, from_utc, format_datetime

def test_utc_to_local_conversion():
    """
    Test that UTC times are correctly converted to local time.
    """
    # Create a UTC datetime (2025-04-25 01:30:00 UTC)
    utc_time = datetime(2025, 4, 25, 1, 30, 0, tzinfo=timezone.utc)
    
    # Convert to Auckland time (UTC+12)
    local_time = from_utc(utc_time)
    
    # In Auckland (UTC+12), this should be 1:30 PM on April 25
    assert local_time.day == 25
    assert local_time.month == 4
    assert local_time.year == 2025
    assert local_time.hour == 13  # 1:30 UTC + 12 hours = 13:30 Auckland time
    assert local_time.minute == 30
    
    # Test with naive datetime (assume it's UTC)
    naive_utc = datetime(2025, 4, 25, 1, 30, 0)
    local_from_naive = from_utc(naive_utc)
    
    # Should also be 1:30 PM in Auckland
    assert local_from_naive.hour == 13
    assert local_from_naive.minute == 30

def test_local_to_utc_conversion():
    """
    Test that local times are correctly converted to UTC.
    """
    # Create a local datetime in Auckland timezone (2025-04-25 13:30:00 UTC+12)
    local_tz = pytz.timezone('Pacific/Auckland')
    local_time = local_tz.localize(datetime(2025, 4, 25, 13, 30, 0))
    
    # Convert to UTC
    utc_time = to_utc(local_time)
    
    # In UTC, this should be 1:30 AM on April 25
    assert utc_time.day == 25
    assert utc_time.month == 4
    assert utc_time.year == 2025
    assert utc_time.hour == 1  # 13:30 Auckland time - 12 hours = 01:30 UTC
    assert utc_time.minute == 30
    assert utc_time.tzinfo == timezone.utc
    
    # Test with naive datetime (assume it's local time)
    naive_local = datetime(2025, 4, 25, 13, 30, 0)
    utc_from_naive = to_utc(naive_local)
    
    # Should also be 1:30 AM UTC
    assert utc_from_naive.hour == 1
    assert utc_from_naive.minute == 30
    assert utc_from_naive.tzinfo == timezone.utc

def test_date_formatting():
    """
    Test that dates are formatted correctly.
    """
    # Create a UTC datetime
    utc_time = datetime(2025, 4, 25, 1, 30, 0, tzinfo=timezone.utc)
    
    # Format with default format
    formatted = format_datetime(utc_time)
    
    # Should include the date and time in local format
    assert "2025" in formatted
    assert "13:30" in formatted or "1:30" in formatted
    
    # Format with custom format
    date_only = format_datetime(utc_time, '%Y-%m-%d')
    assert date_only == "2025-04-25"
    
    time_only = format_datetime(utc_time, '%H:%M')
    assert time_only == "13:30"  # Auckland time (UTC+12)

def test_utcnow_function():
    """
    Test that utcnow() returns a timezone-aware datetime in UTC.
    """
    now = utcnow()
    
    # Should be timezone-aware
    assert now.tzinfo is not None
    
    # Should be in UTC
    assert now.tzinfo == timezone.utc
    
    # Should be close to the current time
    now_via_stdlib = datetime.now(timezone.utc)
    time_difference = abs((now - now_via_stdlib).total_seconds())
    assert time_difference < 5  # Less than 5 seconds difference
