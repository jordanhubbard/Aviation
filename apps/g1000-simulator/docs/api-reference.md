# G1000 Simulator — API Reference

This document covers the REST API and WebSocket protocol exposed by the G1000 backend services.

## Base URL

When running locally:

```
http://localhost:8000   (Flight Dynamics / Navigation Python service)
http://localhost:3000   (Real-time Streaming TypeScript service)
ws://localhost:3000/ws  (WebSocket endpoint)
```

In production deployments, all services are placed behind a reverse proxy at the same hostname. Consult the deployment configuration in `apps/g1000-simulator/config/` for the production base URL.

## Authentication

The simulator does not currently require authentication for local development. The production deployment may add API key authentication as a `X-API-Key` header. Check the deployment configuration for the current policy.

---

## REST API

All REST endpoints return JSON. Successful responses wrap the payload in the standard `ApiResponse` envelope:

```json
{
  "success": true,
  "data": { ... },
  "metadata": {
    "timestamp": "2026-03-10T14:30:00Z",
    "requestId": "abc123",
    "version": "1.0.0"
  }
}
```

Error responses use `success: false` and include an `error` object:

```json
{
  "success": false,
  "error": {
    "code": "FLIGHT_PLAN_NOT_FOUND",
    "message": "Flight plan with id xyz does not exist",
    "detail": "Check the id parameter and retry"
  }
}
```

### Health

#### `GET /health`

Returns the health status of the service.

**Response**

```json
{
  "status": "ok",
  "version": "1.0.0",
  "uptime_seconds": 3600
}
```

---

### Telemetry

#### `GET /api/flight/state`

Returns the current complete flight state snapshot.

**Response** — `FlightStateResponse`

```json
{
  "success": true,
  "data": {
    "position": {
      "latitude_deg": 37.4615,
      "longitude_deg": -122.1153,
      "altitude_ft": 3500.0
    },
    "attitude": {
      "heading_deg": 310.0,
      "pitch_deg": 2.5,
      "roll_deg": 0.0,
      "true_heading_deg": 311.8,
      "slip_skid_deg": 0.2,
      "magnetic_variation_deg": 13.5
    },
    "adc": {
      "ias_kt": 112.0,
      "cas_kt": 113.5,
      "tas_kt": 120.0,
      "pressure_altitude_ft": 3450.0,
      "density_altitude_ft": 4100.0,
      "vertical_speed_fpm": 0.0,
      "oat_c": 12.0
    },
    "gps": {
      "latitude_deg": 37.4615,
      "longitude_deg": -122.1153,
      "altitude_ft": 3500.0,
      "ground_speed_kt": 118.0,
      "track_deg": 309.5,
      "waas_available": true,
      "waas_enabled": true,
      "raim_available": true,
      "raim_ok": true,
      "fix_valid": true,
      "horizontal_accuracy_m": 3.0,
      "vertical_accuracy_m": 4.5
    },
    "autopilot": {
      "master_on": false,
      "lateral_mode": "ROL",
      "vertical_mode": "PIT",
      "lateral_armed": "",
      "vertical_armed": "",
      "target_vertical_speed_fpm": 0.0,
      "bank_limit_active": false,
      "pitch_limit_active": false,
      "disconnect_reason": ""
    },
    "transponder": {
      "mode": "C",
      "squawk_code": "1200",
      "ident_active": false,
      "ident_remaining_sec": 0.0
    },
    "velocity": {
      "airspeed_kt": 112.0,
      "vertical_speed_fpm": 0.0,
      "turn_rate_dps": 0.0
    },
    "targets": {
      "heading_deg": 310.0,
      "altitude_ft": 3500.0,
      "airspeed_kt": 112.0
    },
    "timestamp": 1710076200.0
  }
}
```

---

#### `POST /api/flight/initialize`

Initialize the flight with a specific aircraft type and starting conditions.

**Request body**

```json
{
  "aircraft_type": "c172",
  "airport_icao": "KPAO",
  "runway": "31",
  "fuel_lbs": 300.0
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `aircraft_type` | string | yes | One of `c172`, `c182`, `sr22` |
| `airport_icao` | string | yes | Departure airport ICAO code |
| `runway` | string | no | Runway identifier (defaults to longest) |
| `fuel_lbs` | number | no | Initial fuel in pounds (defaults to full tanks) |

**Response** — `FlightStateResponse`

Returns the initial flight state.

---

#### `POST /api/flight/reset`

Resets the simulation to the initial conditions.

**Request body** — empty or same fields as `/api/flight/initialize`.

**Response** — `FlightStateResponse`

---

### Flight Plan

#### `GET /api/flight-plan`

Returns a list of all stored flight plans.

**Response** — `FlightPlanListResponse`

```json
{
  "success": true,
  "data": [
    {
      "id": "fp-001",
      "name": "KPAO to KSNS",
      "origin": "KPAO",
      "destination": "KSNS",
      "segments": [ ... ],
      "created_at": "2026-03-10T12:00:00Z"
    }
  ]
}
```

---

#### `POST /api/flight-plan`

Create a new flight plan.

**Request body** — `FlightPlanCreateRequest`

```json
{
  "name": "KPAO to KSNS",
  "origin": "KPAO",
  "destination": "KSNS",
  "alternate": "KMRY",
  "segments": [
    {
      "type": "enroute",
      "legs": [
        {
          "sequence": 1,
          "waypoint": {
            "id": "KPAO",
            "type": "airport",
            "latitude_deg": 37.4615,
            "longitude_deg": -122.1153
          }
        },
        {
          "sequence": 2,
          "waypoint": {
            "id": "KSNS",
            "type": "airport",
            "latitude_deg": 36.6628,
            "longitude_deg": -121.6063
          }
        }
      ]
    }
  ]
}
```

**Request fields**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `origin` | string | yes | Origin airport ICAO |
| `destination` | string | yes | Destination airport ICAO |
| `name` | string | no | Display name |
| `alternate` | string | no | Alternate airport ICAO |
| `segments` | array | no | Array of `FlightPlanSegment` objects |

**Segment types:** `departure`, `enroute`, `arrival`, `approach`, `missed`

**Waypoint types:** `airport`, `navaid`, `intersection`, `user`, `airway`, `procedure`

**Response** — `FlightPlanResponse`

Returns the created flight plan including the assigned `id`.

---

#### `GET /api/flight-plan/{id}`

Retrieve a stored flight plan by its ID.

**Path parameters**

| Parameter | Description |
|-----------|-------------|
| `id` | Flight plan UUID |

**Response** — `FlightPlanResponse`

---

#### `PUT /api/flight-plan/{id}`

Update an existing flight plan.

**Request body** — `FlightPlanUpdateRequest`

Provide only the fields to update:

```json
{
  "name": "Updated plan name",
  "segments": [ ... ],
  "active_leg_index": 2
}
```

**Response** — `FlightPlanResponse`

---

#### `DELETE /api/flight-plan/{id}`

Delete a flight plan.

**Response**

```json
{ "success": true }
```

---

### Navigation Database

#### `GET /api/nav/search`

Search the navigation database for airports, navaids, or intersections.

**Query parameters**

| Parameter | Type | Description |
|-----------|------|-------------|
| `q` | string | Search query (ICAO code, name, or identifier prefix) |
| `type` | string | Filter by type: `airport`, `vor`, `ndb`, `intersection`, `waypoint` |
| `lat` | number | Reference latitude for proximity search |
| `lon` | number | Reference longitude for proximity search |
| `radius_nm` | number | Search radius in nautical miles (requires `lat` and `lon`) |
| `limit` | integer | Maximum results to return (default 20, max 100) |
| `offset` | integer | Pagination offset (default 0) |

**Example request**

```
GET /api/nav/search?q=SJC&type=airport&lat=37.46&lon=-122.11&radius_nm=50
```

**Response**

```json
{
  "success": true,
  "data": {
    "matches": [
      {
        "item": {
          "icao": "KSJC",
          "name": "Norman Y. Mineta San Jose International Airport",
          "type": "large_airport",
          "location": { "latitude": 37.3626, "longitude": -121.9290 },
          "elevation_ft": 62,
          "runways": [
            { "ident": "30L", "length_ft": 11000, "surface": "asphalt" },
            { "ident": "30R", "length_ft": 10000, "surface": "asphalt" }
          ]
        },
        "distanceNm": 6.8
      }
    ],
    "total": 1,
    "offset": 0,
    "limit": 20
  }
}
```

---

#### `GET /api/procedures/{airport}`

Returns all available instrument procedures for an airport.

**Path parameters**

| Parameter | Description |
|-----------|-------------|
| `airport` | ICAO airport code |

**Query parameters**

| Parameter | Type | Description |
|-----------|------|-------------|
| `type` | string | Filter by type: `sid`, `star`, `approach` |

**Response**

```json
{
  "success": true,
  "data": {
    "airport": "KSJC",
    "procedures": [
      {
        "type": "approach",
        "ident": "ILS30L",
        "name": "ILS OR LOC RWY 30L",
        "runway": "30L",
        "transitions": ["MOVDD", "MARNA"]
      }
    ]
  }
}
```

---

### Demo Scenarios

#### `GET /api/demo/scenarios`

Lists all available demo flight scenarios.

**Response**

```json
{
  "success": true,
  "data": [
    {
      "id": "vfr-pattern",
      "name": "VFR Pattern",
      "description": "Traffic pattern work at KPAO",
      "duration_minutes": 15,
      "aircraft_type": "c172"
    }
  ]
}
```

---

#### `POST /api/demo/load/{id}`

Loads a demo scenario and initializes the flight state.

**Response** — `FlightStateResponse`

---

## WebSocket Protocol

The WebSocket endpoint is at `ws://<host>:3000/ws`.

### Protocol Version

All messages include a `version` field. The current protocol version is **1.0.0**, defined in `WEBSOCKET_PROTOCOL_VERSION`.

### Message Envelope

Every message uses the `WebSocketEnvelope` structure:

```json
{
  "version": "1.0.0",
  "messageId": "msg-abc123",
  "timestamp": "2026-03-10T14:30:00.000Z",
  "type": "telemetry",
  "topic": "telemetry.flight_state",
  "payload": { ... }
}
```

| Field | Type | Description |
|-------|------|-------------|
| `version` | string | Protocol version |
| `messageId` | string | Unique message identifier (UUID) |
| `timestamp` | string | ISO 8601 timestamp |
| `type` | string | Message type (see below) |
| `topic` | string | Topic path (see below) |
| `payload` | object | Message-specific payload |
| `correlationId` | string | Optional correlation to a prior command message |
| `source` | string | Optional source identifier |

### Message Types

| Type | Direction | Description |
|------|-----------|-------------|
| `telemetry` | Server → Client | Flight data updates |
| `command` | Client → Server | Control inputs and configuration changes |
| `system` | Both | Status and health |
| `ack` | Server → Client | Command acknowledgment |
| `error` | Server → Client | Error notification |
| `ping` | Client → Server | Keep-alive ping |
| `pong` | Server → Client | Keep-alive response to ping |

### Topics

#### Telemetry Topics (Server → Client)

| Topic | Cadence | Description |
|-------|---------|-------------|
| `telemetry.flight_state` | 20 Hz | Complete `TelemetrySnapshot` |
| `telemetry.display.pfd` | 20 Hz | PFD-specific subset of telemetry |
| `telemetry.display.mfd` | 5 Hz | MFD-specific subset including map and engine |
| `telemetry.navigation` | 2 Hz | Navigation state (flight plan, active leg) |
| `telemetry.engine` | 5 Hz | Engine parameters only |

#### Command Topics (Client → Server)

| Topic | Description |
|-------|-------------|
| `command.targets` | Set heading, altitude, or airspeed bugs |
| `command.autopilot` | Engage, disengage, or change autopilot modes |
| `command.radio` | Tune NAV/COM radios |
| `command.audio` | Configure audio panel |
| `command.transponder` | Set transponder mode and squawk |
| `command.flight_plan` | Load or activate a flight plan |
| `command.simulator` | Simulator control (reset, load scenario) |

#### System Topics

| Topic | Direction | Description |
|-------|-----------|-------------|
| `system.status` | Both | Connection and system health |
| `system.alert` | Server → Client | Alert and annunciation events |

---

### Connecting

Connect to the WebSocket endpoint. The server immediately sends a `system.status` message:

```json
{
  "version": "1.0.0",
  "messageId": "init-001",
  "timestamp": "2026-03-10T14:30:00.000Z",
  "type": "system",
  "topic": "system.status",
  "payload": {
    "status": "connected",
    "detail": "G1000 WebSocket ready"
  }
}
```

After the connection is established, the server begins streaming telemetry messages at the configured cadence.

---

### Telemetry Message Schema

A `telemetry.flight_state` message payload is a `TelemetrySnapshot`:

```json
{
  "position": {
    "latitude_deg": 37.4615,
    "longitude_deg": -122.1153,
    "altitude_ft": 3500.0
  },
  "attitude": {
    "heading_deg": 310.0,
    "pitch_deg": 2.5,
    "roll_deg": 0.0,
    "true_heading_deg": 311.8,
    "yaw_deg": 0.0,
    "slip_skid_deg": 0.2,
    "magnetic_variation_deg": 13.5
  },
  "adc": {
    "ias_kt": 112.0,
    "cas_kt": 113.5,
    "tas_kt": 120.0,
    "pressure_altitude_ft": 3450.0,
    "density_altitude_ft": 4100.0,
    "vertical_speed_fpm": 0.0,
    "oat_c": 12.0
  },
  "gps": {
    "latitude_deg": 37.4615,
    "longitude_deg": -122.1153,
    "altitude_ft": 3500.0,
    "ground_speed_kt": 118.0,
    "track_deg": 309.5,
    "waas_available": true,
    "waas_enabled": true,
    "raim_available": true,
    "raim_ok": true,
    "fix_valid": true,
    "horizontal_accuracy_m": 3.0,
    "vertical_accuracy_m": 4.5
  },
  "adf": {
    "tuned_frequency_khz": 335.0,
    "station_ident": "SAU",
    "station_name": "Sausalito NDB",
    "bearing_deg": 335.0,
    "relative_bearing_deg": 25.0,
    "distance_nm": 15.0,
    "signal_strength": 0.8,
    "receiving": true
  },
  "dme": {
    "tuned_frequency_mhz": 109.75,
    "station_ident": "SJC",
    "station_name": "San Jose ILS",
    "slant_range_nm": 8.5,
    "ground_speed_kt": 118.0,
    "signal_strength": 0.95,
    "receiving": true
  },
  "autopilot": {
    "master_on": true,
    "lateral_mode": "HDG",
    "vertical_mode": "ALT",
    "lateral_armed": "",
    "vertical_armed": "GS",
    "target_vertical_speed_fpm": 0.0,
    "bank_limit_active": false,
    "pitch_limit_active": false,
    "disconnect_reason": ""
  },
  "audio_panel": {
    "com1_enabled": true,
    "com2_enabled": false,
    "nav1_enabled": true,
    "nav2_enabled": false,
    "adf_enabled": false,
    "marker_enabled": true,
    "speaker_enabled": true,
    "headphone_enabled": false,
    "com1_volume": 0.8,
    "com2_volume": 0.5,
    "nav1_volume": 0.3,
    "nav2_volume": 0.5,
    "adf_volume": 0.5,
    "marker_volume": 0.7,
    "adf_audio_level": 0.0,
    "marker_audio_level": 0.0,
    "marker_outer_active": false,
    "marker_middle_active": false,
    "marker_inner_active": false
  },
  "transponder": {
    "mode": "C",
    "squawk_code": "1200",
    "ident_active": false,
    "ident_remaining_sec": 0.0
  },
  "velocity": {
    "airspeed_kt": 112.0,
    "vertical_speed_fpm": 0.0,
    "turn_rate_dps": 0.0
  },
  "targets": {
    "heading_deg": 310.0,
    "altitude_ft": 3500.0,
    "airspeed_kt": 112.0
  },
  "timestamp": 1710076200.0
}
```

---

### Command Message Examples

#### Set Heading Bug

```json
{
  "version": "1.0.0",
  "messageId": "cmd-001",
  "timestamp": "2026-03-10T14:30:01.000Z",
  "type": "command",
  "topic": "command.targets",
  "payload": {
    "command": "set_targets",
    "targets": {
      "heading_deg": 270.0
    }
  }
}
```

#### Engage Autopilot in HDG/VS Mode

```json
{
  "version": "1.0.0",
  "messageId": "cmd-002",
  "timestamp": "2026-03-10T14:30:02.000Z",
  "type": "command",
  "topic": "command.autopilot",
  "payload": {
    "command": "set_autopilot",
    "master_on": true,
    "lateral_mode": "HDG",
    "vertical_mode": "VS",
    "target_vertical_speed_fpm": 700
  }
}
```

#### Set Transponder Squawk

```json
{
  "version": "1.0.0",
  "messageId": "cmd-003",
  "timestamp": "2026-03-10T14:30:03.000Z",
  "type": "command",
  "topic": "command.transponder",
  "payload": {
    "command": "set_transponder",
    "mode": "C",
    "squawk_code": "4521"
  }
}
```

#### Load a Flight Plan

```json
{
  "version": "1.0.0",
  "messageId": "cmd-004",
  "timestamp": "2026-03-10T14:30:04.000Z",
  "type": "command",
  "topic": "command.flight_plan",
  "payload": {
    "flight_plan_id": "fp-001",
    "activate": true
  }
}
```

#### Reset Simulator

```json
{
  "version": "1.0.0",
  "messageId": "cmd-005",
  "timestamp": "2026-03-10T14:30:05.000Z",
  "type": "command",
  "topic": "command.simulator",
  "payload": {
    "command": "reset"
  }
}
```

---

### Acknowledgment Messages

The server sends an `ack` message in response to every command:

```json
{
  "version": "1.0.0",
  "messageId": "ack-cmd-001",
  "timestamp": "2026-03-10T14:30:01.010Z",
  "type": "ack",
  "correlationId": "cmd-001",
  "status": "ok"
}
```

If a command fails, the server sends an `error` message instead:

```json
{
  "version": "1.0.0",
  "messageId": "err-cmd-001",
  "timestamp": "2026-03-10T14:30:01.010Z",
  "type": "error",
  "correlationId": "cmd-001",
  "payload": {
    "code": "INVALID_AUTOPILOT_MODE",
    "message": "Lateral mode GS is not a valid lateral mode",
    "detail": "Valid lateral modes: ROL, HDG, NAV, APR, BC"
  }
}
```

---

### Keep-Alive

Send a `ping` message every 30 seconds to keep the connection alive if no other messages are being sent:

```json
{
  "version": "1.0.0",
  "messageId": "ping-001",
  "timestamp": "2026-03-10T14:30:30.000Z",
  "type": "ping"
}
```

The server responds with a `pong` message within 100 ms.

---

## Error Codes

| Code | HTTP Status | Description |
|------|-------------|-------------|
| `NOT_FOUND` | 404 | Resource does not exist |
| `INVALID_REQUEST` | 400 | Malformed request body or missing required field |
| `FLIGHT_PLAN_NOT_FOUND` | 404 | Flight plan ID does not exist |
| `INVALID_AIRCRAFT_TYPE` | 400 | Unknown aircraft type |
| `INVALID_AIRPORT` | 400 | Airport ICAO not found in navigation database |
| `INVALID_AUTOPILOT_MODE` | 400 | Unknown or inapplicable autopilot mode |
| `AP_NOT_ENGAGED` | 409 | Mode change requested but autopilot master is off |
| `APPROACH_NOT_ARMED` | 409 | GS or GP vertical mode requires approach armed first |
| `RAIM_UNAVAILABLE` | 503 | GPS RAIM integrity not available for precision approach |
| `INTERNAL_ERROR` | 500 | Unexpected server error |
