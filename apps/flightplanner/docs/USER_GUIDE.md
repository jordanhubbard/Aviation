# User Guide

This guide walks through the main flows in the VFR Flight Planner UI:

1. Local flight planning (single-airport)
2. Cross-country route planning (two-airport)
3. Weather lookups and recommendations
4. Weather map overlays

For install/setup and environment variables, see `README.md`.

## 1) Local Flight Planning (practice / nearby airports)

1. Open the app and select the **Flight Planner** tab.
2. In **Planning mode**, select **Local Flight**.
3. Fill in:
   - **Airport**: ICAO or IATA code (e.g. `KSFO`, `KPAO`, `SFO`)
   - **Radius (NM)**: how far to search for nearby airports
   - **Forecast days**: how many forecast days to fetch for subsequent weather analysis
4. Click **Plan Local Flight**.

### Reading the results

The results panel shows:

- **Center** airport and the selected radius
- A list of **nearby airports** with their approximate distance in nautical miles

## 2) Cross-Country Route Planning

1. Open the **Flight Planner** tab.
2. In **Planning mode**, select **Cross-Country Route**.
3. Fill in:
   - **Origin** / **Destination**: ICAO or IATA codes
   - **Cruise speed** (knots)
   - **Cruise altitude** (feet)
   - Optional constraints:
     - **Avoid airspaces** (tries to route around restricted airspace)
     - **Avoid terrain** (checks minimum clearance)
     - **Apply wind** (adjusts groundspeed/time using wind estimates)
4. Click **Plan Route**.

### Reading the results

Depending on enabled features and available data, the results section may include:

- **Route summary**: ordered waypoint list
- **Legs table**: per-leg distance/altitude/type
- **Map**: route polyline and waypoint markers
- **Elevation profile** (if terrain service is enabled)
- **Weather panels**: current conditions + short forecast per waypoint
- **Alternate airports**: suggested alternates near the destination

## 3) Weather Lookups: Current Conditions + Recommendations

1. Open the **Weather** tab.
2. Enter an **Airport Code**.
3. Click **Get Weather**.

The page displays:

- Current conditions (OpenWeatherMap + METAR-derived values when available)
- A short forecast (Open-Meteo)
- A simple **VFR/IFR category** and a recommendation
- Suggested **departure windows** when forecast conditions are most favorable

## 4) Weather Overlays (Map)

The **Weather overlays** controls (clouds/wind/precipitation/temperature) require a client-side
OpenWeatherMap key. Set `VITE_OPENWEATHERMAP_API_KEY` for the frontend (see `README.md`).

1. Enable an overlay (e.g. **Clouds**).
2. Adjust opacity as desired.
3. Overlays will appear as tiles on the map.
