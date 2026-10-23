# Aviation Weather Services - Python SDK

Comprehensive weather data services for flight planning and aviation applications.

## Features

- **METAR**: Fetch and parse METAR data from aviationweather.gov
- **OpenWeatherMap**: Current weather data (requires API key)
- **Open-Meteo**: Free weather forecasts (no API key required)
- **Flight Categories**: VFR/MVFR/IFR/LIFR determination
- **Recommendations**: Weather-based flight recommendations and warnings
- **Departure Windows**: Score and find best departure times from forecast data

## Installation

```bash
cd packages/shared-sdk/python
pip install -e .
```

Required dependencies:
- `httpx` - For HTTP requests
- `python-dateutil` - For date/time handling

## Quick Start

### METAR

```python
from aviation.weather import fetch_metar_raw, parse_metar, flight_category

# Fetch METAR
metar = fetch_metar_raw("KSFO")
print(metar)
# Output: "KSFO 141356Z 28015KT 10SM FEW020 SCT250 15/09 A3012 RMK AO2"

# Parse METAR
parsed = parse_metar(metar)
print(parsed['visibility_sm'])  # 10.0
print(parsed['ceiling_ft'])     # 2000 (from FEW020)
print(parsed['temperature_c'])  # 15
print(parsed['wind_speed_kt'])  # 15

# Determine flight category
cat = flight_category(
    visibility_sm=parsed.get('visibility_sm'),
    ceiling_ft=parsed.get('ceiling_ft')
)
print(f"Flight category: {cat}")  # "VFR"
```

### Multiple METARs

```python
from aviation.weather import fetch_metar_raws

# Fetch multiple METARs at once (more efficient)
metars = fetch_metar_raws(['KSFO', 'KJFK', 'KORD'])
for station, metar in metars.items():
    print(f"{station}: {metar}")
```

### OpenWeatherMap

```python
from aviation.weather import get_openweathermap_current, to_weather_data

# Set API key (or use OPENWEATHERMAP_API_KEY environment variable)
weather = get_openweathermap_current(
    lat=37.7749,
    lon=-122.4194,
    api_key="your-api-key"
)

# Convert to standardized format
data = to_weather_data('KSFO', weather)
print(data)
# {
#     'airport': 'KSFO',
#     'conditions': 'clear sky',
#     'temperature': 65,
#     'wind_speed': 13,
#     'wind_direction': 280,
#     'visibility': 6.2,
#     'ceiling': 10000,
#     'metar': ''
# }
```

### Open-Meteo (Free)

```python
from aviation.weather import (
    get_open_meteo_current,
    get_daily_forecast,
    get_hourly_forecast
)

# Current weather (no API key required!)
weather = get_open_meteo_current(lat=37.7749, lon=-122.4194)
print(f"Temperature: {weather['temperature']}°F")
print(f"Wind: {weather['windspeed']} kt from {weather['winddirection']}°")

# 7-day daily forecast
daily = get_daily_forecast(lat=37.7749, lon=-122.4194, days=7)
for day in daily:
    print(f"{day['date']}: {day['temp_min_f']}-{day['temp_max_f']}°F, "
          f"Precip: {day['precipitation_mm']}mm")

# 24-hour hourly forecast
hourly = get_hourly_forecast(lat=37.7749, lon=-122.4194, hours=24)
for hour in hourly[:3]:
    print(f"{hour['time']}: Vis {hour['visibility_m']}m, "
          f"Clouds {hour['cloudcover_pct']}%, "
          f"Wind {hour['wind_speed_kt']} kt")
```

### Flight Category & Recommendations

```python
from aviation.weather import (
    flight_category,
    recommendation_for_category,
    warnings_for_conditions
)

# Determine flight category
cat = flight_category(
    visibility_sm=10.0,
    ceiling_ft=5000
)
print(cat)  # "VFR"

# Get recommendation
rec = recommendation_for_category(cat)
print(rec)  # "VFR conditions. Routine VFR flight should be feasible."

# Get warnings for marginal conditions
warnings = warnings_for_conditions(
    visibility_sm=3.0,
    ceiling_ft=2000,
    wind_speed_kt=25
)
print(warnings)
# ['Reduced visibility (3.0 SM).', 'Low ceiling (2000 ft).', 'High winds (25 kt).']
```

### Departure Window Scoring

Find the best departure windows from hourly forecast data:

```python
from aviation.weather import (
    get_hourly_forecast,
    best_departure_windows
)

# Get hourly forecast
hourly = get_hourly_forecast(lat=37.7749, lon=-122.4194, hours=48)

# Find best 3-hour departure windows
windows = best_departure_windows(
    hourly,
    window_hours=3,
    max_windows=3
)

for window in windows:
    print(f"{window['start_time']} - {window['end_time']}")
    print(f"  Score: {window['score']}")
    print(f"  Category: {window['flight_category']}")
```

## API Reference

### METAR Functions

#### `fetch_metar_raw(station: str) -> Optional[str]`

Fetch raw METAR for a single station.

**Args:**
- `station`: ICAO station identifier (e.g., "KSFO")

**Returns:** Raw METAR string or None if unavailable

#### `fetch_metar_raws(stations: Sequence[str]) -> Dict[str, Optional[str]]`

Fetch raw METARs for multiple stations (more efficient than individual calls).

**Args:**
- `stations`: List of ICAO station identifiers

**Returns:** Dict mapping station to raw METAR string

#### `parse_metar(raw: str) -> Dict[str, Any]`

Parse a METAR string into structured data.

**Args:**
- `raw`: Raw METAR string

**Returns:** Dict with parsed elements (see Quick Start for structure)

### Flight Category Functions

#### `flight_category(*, visibility_sm, ceiling_ft, thresholds=DEFAULT_THRESHOLDS) -> FlightCategory`

Determine flight category from ceiling and visibility.

**Args:**
- `visibility_sm`: Visibility in statute miles
- `ceiling_ft`: Ceiling in feet AGL
- `thresholds`: Optional custom thresholds

**Returns:** `"VFR"`, `"MVFR"`, `"IFR"`, `"LIFR"`, or `"UNKNOWN"`

**Default Thresholds (FAA):**
- VFR: Ceiling ≥ 3000ft, Visibility ≥ 5 SM
- MVFR: Ceiling ≥ 1000ft, Visibility ≥ 3 SM
- IFR: Ceiling ≥ 500ft, Visibility ≥ 1 SM
- LIFR: Below IFR minimums

#### `recommendation_for_category(category: FlightCategory) -> str`

Get flight recommendation based on category.

#### `warnings_for_conditions(*, visibility_sm, ceiling_ft, wind_speed_kt) -> List[str]`

Generate warnings for marginal weather conditions.

### Weather API Functions

#### OpenWeatherMap

**`get_openweathermap_current(*, lat, lon, api_key=None) -> Dict[str, Any]`**

Fetch current weather from OpenWeatherMap.

**Requires:** API key from https://openweathermap.org/api

**Environment Variable:** `OPENWEATHERMAP_API_KEY` or `OPENWEATHER_API_KEY`

#### Open-Meteo (Free)

**`get_open_meteo_current(*, lat, lon) -> Dict[str, Any]`**

Fetch current weather from Open-Meteo (free, no API key required).

**`get_daily_forecast(*, lat, lon, days=7) -> List[Dict[str, Any]]`**

Fetch daily forecast (1-16 days).

**`get_hourly_forecast(*, lat, lon, hours=24) -> List[Dict[str, Any]]`**

Fetch hourly forecast (1-168 hours, i.e., up to 7 days).

### Utility Functions

#### `meters_to_sm(meters: Optional[float]) -> Optional[float]`

Convert meters to statute miles.

#### `estimate_ceiling_from_cloudcover(cloud_pct: Optional[float]) -> Optional[float]`

Estimate ceiling from cloud cover percentage (fallback when actual ceiling unavailable).

#### `score_hour(*, category, precipitation_mm, wind_speed_kt) -> float`

Score an hour for flight suitability (higher is better).

#### `best_departure_windows(hourly, *, window_hours=3, max_windows=3) -> List[Dict[str, Any]]`

Find the best departure windows from hourly forecast data.

## Environment Variables

### Optional

- `OPENWEATHERMAP_API_KEY` or `OPENWEATHER_API_KEY`: OpenWeatherMap API key
- `DISABLE_METAR_FETCH`: Set to `"1"` to disable METAR fetching (useful for testing)

## Error Handling

```python
from aviation.weather import (
    OpenWeatherMapError,
    OpenMeteoError,
    fetch_metar_raw
)

try:
    weather = get_openweathermap_current(lat=37.7749, lon=-122.4194)
except OpenWeatherMapError as e:
    print(f"Weather API error: {e}")

try:
    forecast = get_hourly_forecast(lat=37.7749, lon=-122.4194, hours=24)
except OpenMeteoError as e:
    print(f"Forecast error: {e}")

# METAR fetching returns None on error (best-effort)
metar = fetch_metar_raw("INVALID")
if metar is None:
    print("METAR unavailable")
```

## Testing

```python
import os

# Disable external API calls for testing
os.environ['DISABLE_METAR_FETCH'] = '1'

from aviation.weather import fetch_metar_raw

# Returns None without making HTTP request
metar = fetch_metar_raw("KSFO")
assert metar is None
```

## Comparison with TypeScript SDK

This Python SDK provides equivalent functionality to the TypeScript SDK:

| Feature | Python | TypeScript |
|---------|--------|------------|
| METAR fetching | ✅ | ✅ |
| METAR parsing | ✅ | ✅ |
| Flight categories | ✅ | ✅ |
| OpenWeatherMap | ✅ | ✅ |
| Open-Meteo | ✅ | ✅ |
| Departure windows | ✅ | ✅ |
| Caching | ❌ (use app-level cache) | ✅ (built-in) |

For Python applications, use this SDK directly. For TypeScript/JavaScript applications, use the TypeScript SDK.

## Migration from flight-planner

If you were using the weather services from `apps/flight-planner/backend/app/services/`, this SDK provides the same functionality:

```python
# Old (flight-planner-specific)
from app.services.metar import fetch_metar_raw
from app.services.flight_recommendations import flight_category

# New (shared SDK)
from aviation.weather import fetch_metar_raw, flight_category
```

The API is identical, so migration is a simple import change.

## License

MIT
