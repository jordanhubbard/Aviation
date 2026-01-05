# API Documentation

Base URL: `http://localhost:8000/api`

## Authentication

No authentication is currently required.

## Rate limiting

The API is rate-limited (SlowAPI) to **1000 requests/minute per client IP**.

Rate limit violations return **HTTP 429**.

## Error format

Errors are returned as FastAPI/Starlette JSON:

```json
{ "detail": "..." }
```

## Endpoints

### Health

#### `GET /health`

```bash
curl -sS http://localhost:8000/api/health
```

Response:

```json
{ "status": "ok" }
```

---

### Planning

#### `POST /plan`

Unified entry point using a `mode` discriminator.

##### Route mode request

```json
{
  "mode": "route",
  "origin": "KSFO",
  "destination": "KLAX",
  "speed": 110,
  "speed_unit": "knots",
  "altitude": 5500,
  "avoid_airspaces": false,
  "avoid_terrain": false,
  "apply_wind": true,

  "plan_fuel_stops": false,
  "aircraft_range_nm": 200,
  "max_leg_distance": 150,
  "fuel_burn_gph": 10,
  "reserve_minutes": 45,
  "fuel_strategy": "time"
}
```

Notes:

- `avoid_terrain=true` requires `OPENTOPOGRAPHY_API_KEY`.
- `apply_wind=true` uses Open-Meteo current winds to adjust groundspeed/time.
- Multi-leg planning is enabled by `plan_fuel_stops=true` or `aircraft_range_nm`.

Response (subset; many fields are optional):

```json
{
  "route": ["KSFO", "KLAX"],
  "distance_nm": 0,
  "time_hr": 0,
  "origin_coords": [0, 0],
  "destination_coords": [0, 0],
  "segments": [],

  "fuel_stops": null,
  "fuel_required_with_reserve_gal": null,

  "wind_speed_kt": null,
  "headwind_kt": null,
  "crosswind_kt": null,
  "groundspeed_kt": null
}
```

Common errors:

- `400`: invalid airport codes, terrain clearance failure, or A* route failure
- `503`: terrain/airspace/weather service errors

##### Local mode request

```json
{
  "mode": "local",
  "airport": "KSFO",
  "radius_nm": 25
}
```

Response:

```json
{
  "airport": "KSFO",
  "radius_nm": 25,
  "center": {
    "icao": "KSFO",
    "iata": "SFO",
    "name": "San Francisco Intl",
    "latitude": 37.62,
    "longitude": -122.38
  },
  "nearby_airports": [
    {
      "icao": "KSQL",
      "name": "San Carlos",
      "distance_nm": 13.2
    }
  ]
}
```

---

### Route planning (direct endpoint)

#### `POST /route`

Same request/response shapes as `POST /plan` with `mode="route"`.

---

### Local planning (direct endpoint)

#### `POST /local`

Same request/response shapes as `POST /plan` with `mode="local"`.

---

### Airports

#### `GET /airports/search`

Query params:

- `q`: search term (code/name); required unless `lat` and `lon` are provided
- `limit`: `1..50` (default: `20`)
- `lat`, `lon`: optional proximity search center
- `radius_nm`: optional proximity radius

```bash
curl -sS 'http://localhost:8000/api/airports/search?q=SFO&limit=10'
```

Response: list of airports (shape varies by source, includes `icao`, `iata`, `name`, `latitude`, `longitude`, etc.).

#### `GET /airports/{code}`

Returns airport details for an ICAO/IATA code.

#### `GET /airport/{code}`

Legacy alias for `GET /airports/{code}`.

---

### Weather

#### `GET /weather/{code}`

Returns current conditions from OpenWeatherMap, enriched with METAR parsing when available.

Requires: `OPENWEATHERMAP_API_KEY`.

```bash
curl -sS http://localhost:8000/api/weather/KSFO
```

Response:

```json
{
  "airport": "KSFO",
  "conditions": "clear sky",
  "temperature": 55,
  "wind_speed": 12,
  "wind_direction": 280,
  "visibility": 10,
  "ceiling": 10000,
  "metar": "..."
}
```

#### `GET /weather/{code}/forecast`

Query params:

- `days`: `1..16` (default: `7`)

```bash
curl -sS 'http://localhost:8000/api/weather/KSFO/forecast?days=3'
```

#### `POST /weather/route`

Samples current Open-Meteo weather along a polyline.

Request:

```json
{
  "points": [[37.62, -122.38], [34.05, -118.24]],
  "max_points": 10
}
```

Response:

```json
{
  "points": [
    {
      "latitude": 37.62,
      "longitude": -122.38,
      "temperature_f": 70,
      "wind_speed_kt": 10,
      "wind_direction": 180,
      "time": "2025-01-01T00:00"
    }
  ]
}
```

---

### Terrain

#### `GET /terrain`

Simple status endpoint.

#### `GET /terrain/point`

Query params:

- `lat`, `lon`
- `demtype` (default: `SRTMGL1`)

Requires: `OPENTOPOGRAPHY_API_KEY`.

#### `POST /terrain/profile`

Request:

```json
{
  "demtype": "SRTMGL1",
  "points": [[37.62, -122.38], [34.05, -118.24]]
}
```

---

### Airspace

#### `GET /airspace`

Currently returns **501 Not Implemented**.
