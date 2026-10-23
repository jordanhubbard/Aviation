# Date/Time Utilities

> **Aviation-focused date/time handling for UTC/Zulu conversions, timezone management, and flight time formatting.**

---

## Table of Contents

- [Overview](#overview)
- [Installation](#installation)
- [TypeScript API](#typescript-api)
- [Python API](#python-api)
- [Common Use Cases](#common-use-cases)
- [Aviation Standards](#aviation-standards)
- [Migration Guide](#migration-guide)

---

## Overview

The `datetime` module provides comprehensive date/time utilities designed for aviation applications, with a focus on:

- **UTC/Zulu Time**: Standard aviation time conversions
- **Timezone Management**: Automatic timezone detection and conversions
- **Flight Time Formatting**: Parse and format flight durations
- **Sunrise/Sunset**: Astronomical calculations for any location
- **Aviation Standards**: Follows ICAO time standards

### Standard Rule

All applications should follow this convention:

```
Backend/Database: Always UTC
Frontend Display: Local time (user's timezone)
Frontend Input: Local time → converted to UTC for backend
```

---

## Installation

### TypeScript

```typescript
import {
  utcNow,
  toZulu,
  fromZulu,
  formatDateTime,
  formatFlightTime,
  parseFlightTime,
  calculateSunriseSunset,
  isNight,
  addFlightTime,
  getTimeDifference,
} from '@aviation/shared-sdk';
```

### Python

```python
from aviation.datetime import (
    utcnow,
    to_zulu,
    from_zulu,
    format_datetime,
    format_flight_time,
    parse_flight_time,
    calculate_sunrise_sunset,
    is_night,
    add_flight_time,
)
```

---

## TypeScript API

### Current Time

#### `utcNow(): Date`

Get the current UTC time.

```typescript
const now = utcNow();
console.log(now.toISOString()); // '2026-01-15T18:30:00.000Z'
```

### UTC Conversions

#### `toUtc(date: Date | string | number): Date`

Convert any date to UTC Date object.

```typescript
const utc = toUtc('2026-01-15T10:30:00-08:00');
console.log(utc.toISOString()); // '2026-01-15T18:30:00.000Z'
```

### Zulu Time

#### `toZulu(date: Date | string | number): string`

Convert date to Zulu time string (ISO 8601 with Z suffix).

```typescript
const zulu = toZulu(new Date());
console.log(zulu); // '2026-01-15T18:30:00.000Z'
```

#### `fromZulu(zuluString: string): Date`

Parse Zulu time string to Date object.

```typescript
const date = fromZulu('2026-01-15T18:30:00Z');
console.log(date.toISOString());
```

### Formatting

#### `formatDateTime(date, timezone, options): string`

Format a date to a specific timezone.

```typescript
const formatted = formatDateTime(
  new Date(),
  'America/Los_Angeles',
  { dateStyle: 'long', timeStyle: 'short' }
);
console.log(formatted); // 'January 15, 2026 at 10:30 AM'
```

#### `formatFlightTime(minutes: number): string`

Format flight time in minutes to human-readable format.

```typescript
console.log(formatFlightTime(150)); // '2h 30m'
console.log(formatFlightTime(45));  // '45m'
console.log(formatFlightTime(120)); // '2h'
```

#### `parseFlightTime(timeString: string): number`

Parse flight time string to minutes.

```typescript
console.log(parseFlightTime('2h 30m')); // 150
console.log(parseFlightTime('2.5'));    // 150
console.log(parseFlightTime('45m'));    // 45
```

### Sunrise/Sunset

#### `calculateSunriseSunset(latitude, longitude, date?): { sunrise, sunset }`

Calculate sunrise and sunset times for a location.

```typescript
// San Francisco coordinates
const { sunrise, sunset } = calculateSunriseSunset(37.7749, -122.4194);
console.log(`Sunrise: ${sunrise.toISOString()}`);
console.log(`Sunset: ${sunset.toISOString()}`);
```

#### `isNight(latitude, longitude, date?): boolean`

Determine if it's currently night time.

```typescript
const nightTime = isNight(37.7749, -122.4194);
console.log(nightTime ? 'Night flight rules apply' : 'Day flight');
```

### Flight Time Calculations

#### `addFlightTime(baseTime: Date, flightMinutes: number): Date`

Add flight time to a base datetime.

```typescript
const departure = new Date('2026-01-15T10:00:00Z');
const arrival = addFlightTime(departure, 150); // 2h 30m flight
console.log(arrival.toISOString()); // '2026-01-15T12:30:00.000Z'
```

#### `getTimeDifference(start: Date, end: Date): number`

Get time difference in minutes.

```typescript
const start = new Date('2026-01-15T10:00:00Z');
const end = new Date('2026-01-15T12:30:00Z');
console.log(getTimeDifference(start, end)); // 150
```

---

## Python API

### Current Time

#### `utcnow() -> datetime`

Get the current UTC time with timezone info.

```python
now = utcnow()
print(now.isoformat())  # '2026-01-15T18:30:00+00:00'
```

### Timezone Management

#### `get_timezone(tz_name: Optional[str] = None) -> pytz.timezone`

Get a timezone object by name.

```python
tz = get_timezone('America/Los_Angeles')
print(tz)  # America/Los_Angeles
```

### UTC Conversions

#### `to_utc(dt, assume_tz=None) -> datetime`

Convert datetime to UTC.

```python
local_dt = datetime(2026, 1, 15, 10, 30)  # Naive
utc_dt = to_utc(local_dt, 'America/Los_Angeles')
print(utc_dt)  # 2026-01-15 18:30:00+00:00
```

#### `from_utc(dt, to_tz=None, as_naive=False) -> datetime`

Convert UTC datetime to specific timezone.

```python
utc_dt = datetime(2026, 1, 15, 18, 30, tzinfo=timezone.utc)
local_dt = from_utc(utc_dt, 'America/Los_Angeles')
print(local_dt)  # 2026-01-15 10:30:00-08:00
```

### Zulu Time

#### `to_zulu(dt) -> str`

Convert datetime to Zulu time string.

```python
zulu = to_zulu(datetime(2026, 1, 15, 18, 30, tzinfo=timezone.utc))
print(zulu)  # '2026-01-15T18:30:00Z'
```

#### `from_zulu(zulu_str) -> datetime`

Parse Zulu time string.

```python
dt = from_zulu('2026-01-15T18:30:00Z')
print(dt)  # 2026-01-15 18:30:00+00:00
```

### Formatting

#### `format_datetime(dt, format_str='%Y-%m-%d %H:%M:%S', to_tz=None) -> str`

Format datetime to string in specific timezone.

```python
utc_dt = datetime(2026, 1, 15, 18, 30, tzinfo=timezone.utc)
formatted = format_datetime(utc_dt, '%B %d, %Y at %I:%M %p', 'America/Los_Angeles')
print(formatted)  # 'January 15, 2026 at 10:30 AM'
```

#### `format_flight_time(minutes: float) -> str`

Format flight time to human-readable string.

```python
print(format_flight_time(150))  # '2h 30m'
print(format_flight_time(45))   # '45m'
print(format_flight_time(120))  # '2h'
```

#### `parse_flight_time(time_str: str) -> float`

Parse flight time string to minutes.

```python
print(parse_flight_time('2h 30m'))  # 150.0
print(parse_flight_time('2.5'))     # 150.0
print(parse_flight_time('45m'))     # 45.0
```

### Sunrise/Sunset

#### `calculate_sunrise_sunset(latitude, longitude, date=None) -> Tuple[datetime, datetime]`

Calculate sunrise and sunset times.

```python
# San Francisco coordinates
sunrise, sunset = calculate_sunrise_sunset(37.7749, -122.4194)
print(f'Sunrise: {sunrise.strftime("%H:%M")} UTC')
print(f'Sunset: {sunset.strftime("%H:%M")} UTC')
```

#### `is_night(latitude, longitude, dt=None) -> bool`

Check if it's night time.

```python
night_time = is_night(37.7749, -122.4194)
print('Night flight rules apply' if night_time else 'Day flight')
```

### Flight Time Calculations

#### `add_flight_time(base_time: datetime, flight_minutes: float) -> datetime`

Add flight time to a base datetime.

```python
departure = datetime(2026, 1, 15, 10, 0, tzinfo=timezone.utc)
arrival = add_flight_time(departure, 150)  # 2h 30m
print(arrival)  # 2026-01-15 12:30:00+00:00
```

---

## Common Use Cases

### Flight Planning

```typescript
// TypeScript
const departure = new Date('2026-01-15T14:00:00Z');
const flightDuration = parseFlightTime('2h 45m');
const arrival = addFlightTime(departure, flightDuration);

console.log(`Departure: ${toZulu(departure)}`);
console.log(`Arrival: ${toZulu(arrival)}`);
console.log(`Duration: ${formatFlightTime(flightDuration)}`);
```

```python
# Python
departure = datetime(2026, 1, 15, 14, 0, tzinfo=timezone.utc)
flight_duration = parse_flight_time('2h 45m')
arrival = add_flight_time(departure, flight_duration)

print(f'Departure: {to_zulu(departure)}')
print(f'Arrival: {to_zulu(arrival)}')
print(f'Duration: {format_flight_time(flight_duration)}')
```

### Night Flight Detection

```typescript
// TypeScript
const departureTime = new Date('2026-01-15T02:00:00Z');
const arrivalTime = addFlightTime(departureTime, 180);

const depAirport = { lat: 37.7749, lon: -122.4194 }; // SFO
const arrAirport = { lat: 40.6413, lon: -73.7781 };  // JFK

const nightDeparture = isNight(depAirport.lat, depAirport.lon, departureTime);
const nightArrival = isNight(arrAirport.lat, arrAirport.lon, arrivalTime);

if (nightDeparture || nightArrival) {
  console.log('Night flight - additional currency required');
}
```

```python
# Python
departure_time = datetime(2026, 1, 15, 2, 0, tzinfo=timezone.utc)
arrival_time = add_flight_time(departure_time, 180)

dep_airport = {'lat': 37.7749, 'lon': -122.4194}  # SFO
arr_airport = {'lat': 40.6413, 'lon': -73.7781}   # JFK

night_departure = is_night(dep_airport['lat'], dep_airport['lon'], departure_time)
night_arrival = is_night(arr_airport['lat'], arr_airport['lon'], arrival_time)

if night_departure or night_arrival:
    print('Night flight - additional currency required')
```

### Logbook Entry Formatting

```typescript
// TypeScript
const entry = {
  date: new Date('2026-01-15T18:30:00Z'),
  duration: 150,
  departure: 'KSFO',
  arrival: 'KLAX'
};

console.log(`Date: ${formatDateTime(entry.date, 'America/Los_Angeles')}`);
console.log(`Duration: ${formatFlightTime(entry.duration)}`);
console.log(`Route: ${entry.departure} → ${entry.arrival}`);
```

```python
# Python
entry = {
    'date': datetime(2026, 1, 15, 18, 30, tzinfo=timezone.utc),
    'duration': 150,
    'departure': 'KSFO',
    'arrival': 'KLAX'
}

print(f"Date: {format_datetime(entry['date'], '%B %d, %Y', 'America/Los_Angeles')}")
print(f"Duration: {format_flight_time(entry['duration'])}")
print(f"Route: {entry['departure']} → {entry['arrival']}")
```

---

## Aviation Standards

### Zulu Time (UTC)

All times in aviation are communicated in Zulu time (UTC) to avoid timezone confusion:

```typescript
// Always store times in UTC
const departureUtc = toZulu(new Date());

// Display in local time for user
const departureLocal = formatDateTime(
  fromZulu(departureUtc),
  Intl.DateTimeFormat().resolvedOptions().timeZone
);
```

### Night Flight Definition

FAA regulations define night as:
- **Beginning:** End of evening civil twilight (sunset + 30 minutes)
- **Ending:** Beginning of morning civil twilight (sunrise - 30 minutes)

For simplicity, this module uses sunset to sunrise as the night period.

### Flight Time Format

Aviation commonly uses:
- **Hobbs Time:** Engine running time (decimal hours)
- **Logbook Time:** Flight time in hours and minutes

This module supports both formats:

```typescript
// Hobbs (decimal)
const hobbsTime = 2.5;
const minutes = hobbsTime * 60; // 150 minutes

// Logbook (h m)
const logbookTime = formatFlightTime(minutes); // '2h 30m'
```

---

## Migration Guide

### From FlightSchool

If you're migrating from FlightSchool's `datetime_utils.py`:

**Before:**
```python
from app.utils.datetime_utils import utcnow, to_utc, from_utc
```

**After:**
```python
from aviation.datetime import utcnow, to_utc, from_utc
```

**Changes:**
- ✅ API remains the same
- ✅ All function signatures unchanged
- ✅ Additional functions added (Zulu time, flight time, sunrise/sunset)
- ✅ No breaking changes

### From Custom Implementation

If you have custom date/time handling:

**Before:**
```typescript
const now = new Date();
const zuluString = now.toISOString();
```

**After:**
```typescript
import { utcNow, toZulu } from '@aviation/shared-sdk';

const now = utcNow();
const zuluString = toZulu(now);
```

---

## Performance

### Caching Recommendations

Sunrise/sunset calculations are computationally intensive. Consider caching:

```typescript
// Cache sunrise/sunset for the day
const cache = new Map<string, { sunrise: Date; sunset: Date }>();

function getCachedSunriseSunset(lat: number, lon: number, date: Date) {
  const key = `${lat},${lon},${date.toDateString()}`;
  
  if (!cache.has(key)) {
    cache.set(key, calculateSunriseSunset(lat, lon, date));
  }
  
  return cache.get(key)!;
}
```

### Timezone Data

Python uses `pytz` for timezone data, which requires the IANA timezone database. Ensure it's installed:

```bash
pip install pytz
```

TypeScript uses `Intl.DateTimeFormat`, which is built into modern JavaScript runtimes.

---

## Testing

Both TypeScript and Python implementations have comprehensive test coverage:

**TypeScript:**
```bash
cd packages/shared-sdk
npm test -- datetime
```

**Python:**
```bash
cd packages/shared-sdk
PYTHONPATH=python:$PYTHONPATH python -m pytest python/tests/test_datetime.py -v
```

**Test Coverage:**
- ✅ 40 TypeScript tests (100% pass)
- ✅ 40 Python tests (100% pass)
- ✅ Feature parity between implementations
- ✅ Edge cases covered

---

## License

MIT License - Part of the Aviation Monorepo

---

## Support

For issues or questions:
1. Check existing tests for examples
2. Review this documentation
3. Open an issue on GitHub
4. Contact the Aviation team

**Quick Reference:**
- [TypeScript API](#typescript-api)
- [Python API](#python-api)
- [Common Use Cases](#common-use-cases)
- [Migration Guide](#migration-guide)
