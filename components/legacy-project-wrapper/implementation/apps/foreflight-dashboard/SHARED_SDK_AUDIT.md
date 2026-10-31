# ForeFlight Dashboard - Shared SDK Migration Audit

**Issue:** Aviation-kmc  
**Date:** 2026-01-14  
**Status:** ICAO designator migration complete; logbook-policy audit remains

## Executive Summary

The dashboard has little overlap with airport, weather, or navigation calculations.
Its aircraft type-designator catalog, however, is common aviation domain data and has
been promoted into the independently tested `aviation.aircraft` Component. ForeFlight
now delegates membership, metadata, suggestions, manufacturer lookup, summaries, and
official verification guidance to that SDK surface.

## Analysis Results

### Current External Service Usage

1. **Airport Identifiers** - Uses simple string identifiers only
   - No need for full airport database (names, coordinates, etc.)
   - Just stores ICAO/IATA codes from ForeFlight CSV
   - Example: `Airport(identifier="KSFO")`

2. **ICAO Aircraft Type Codes** - Comprehensive validation system
   - Located in: `src/core/icao_validator.py`
   - 200+ aircraft types with manufacturer/model info
   - Logbook-specific validation logic
   - Could be shared but very domain-specific

3. **Distance Values** - Parsed from CSV, not calculated
   - No haversine or great circle calculations
   - Just extracts "Distance: 123nm" from remarks

### No Usage Of

- ❌ Weather services (OpenWeatherMap, Open-Meteo, METAR)
- ❌ Navigation calculations (bearing, fuel, time-speed-distance)
- ❌ Airport database (full details, search, proximity)
- ❌ Map integration patterns (used internally in frontend)

## Recommendation

### Completed: Extract ICAO designator support

- The 157 detailed records and 13 additional supported codes are Component-owned
  acceptance data.
- Generated TypeScript and Python catalogs prevent language drift.
- Both SDK bindings run the same lookup, suggestion, manufacturer, and summary vectors.
- `src/core/icao_validator.py` is now a compatibility adapter; CSV parsing and
  logbook-specific validation remain in the application.
- The bounded snapshot is explicitly not represented as a complete/current substitute
  for ICAO Doc 8643.

## Dependencies Analysis

Current Python dependencies are appropriate:
```
fastapi==0.110.0          # Web framework
pandas==2.2.1             # CSV processing
pydantic==2.12.5          # Data validation
sqlalchemy==2.0.45        # Database ORM
PyJWT==2.10.1             # Authentication
passlib[bcrypt]==1.7.4    # Password hashing
```

No aviation-specific external APIs or services used.

## Conclusion

**Status:** Aircraft designator migration complete.

Airport identifier storage, provider CSV parsing, accounts, and dashboard presentation
remain correctly private. A separate follow-up should classify the app's logbook time
accounting and validation rules rather than assuming they are application-only.

---

## For Reference: Other Apps Already Using Shared SDK

✅ **aviation-accident-tracker** - Uses shared airport services  
✅ **flight-planner** - Migrated to shared airport services  
✅ **weather-briefing** - Uses shared weather services  

These apps have genuine need for shared aviation data services. Foreflight-dashboard does not.
