# Aviation Accident Tracker API Documentation

## Overview

Complete OpenAPI 3.0 documentation for the Aviation Accident Tracker API. This API provides access to aviation accident and incident data from year 2000 onward, sourced from trusted providers with full provenance tracking.

**Base URL**: `http://localhost:8080` (development)  
**Production URL**: TBD  
**API Version**: 0.1.0

---

## Accessing the Documentation

### Interactive Documentation (Swagger UI)

Visit the Swagger UI for interactive API documentation:

```
http://localhost:8080/docs
```

Features:
- ✅ Interactive API exploration
- ✅ "Try it out" functionality
- ✅ Request/response examples
- ✅ Schema definitions
- ✅ Authentication testing

### OpenAPI Specification

Download the raw OpenAPI 3.0 spec:

```
http://localhost:8080/openapi.json
```

Use this with tools like:
- **Postman**: Import → Link → Paste URL
- **Insomnia**: Design → Import/Export → Import URL
- **OpenAPI Generator**: Generate client SDKs

---

## Quick Start

### 1. Health Check

```bash
curl http://localhost:8080/health
```

Response:
```json
{
  "status": "healthy",
  "timestamp": "2024-01-15T12:00:00Z",
  "env": "development",
  "ingest": {
    "lastRun": "2024-01-15T10:00:00Z",
    "eventsIngested": 150
  }
}
```

### 2. List Events

```bash
curl "http://localhost:8080/api/events?limit=10&category=GA"
```

Response:
```json
{
  "events": [
    {
      "id": "ASN_2024-01-15_N12345",
      "date_z": "2024-01-15T14:30:00Z",
      "registration": "N12345",
      "aircraft_type": "Cessna 172",
      "operator": "ABC Flight School",
      "airport_icao": "KSFO",
      "airport_name": "San Francisco International Airport",
      "location": "Near San Francisco, CA",
      "country": "US",
      "region": "North America",
      "latitude": 37.6213,
      "longitude": -122.3790,
      "category": "GA",
      "narrative": "Aircraft experienced engine failure...",
      "narrative_summary": "Engine failure during climb",
      "fatalities": 0,
      "injuries": 2,
      "damage": "Substantial"
    }
  ],
  "total": 150,
  "limit": 10,
  "offset": 0
}
```

### 3. Get Event Details

```bash
curl http://localhost:8080/api/events/ASN_2024-01-15_N12345
```

Response includes full event data plus provenance sources:
```json
{
  "id": "ASN_2024-01-15_N12345",
  "date_z": "2024-01-15T14:30:00Z",
  "...": "...",
  "sources": [
    {
      "source_name": "ASN",
      "source_url": "https://aviation-safety.net/database/record.php?id=20240115-0",
      "fetched_at_z": "2024-01-16T00:00:00Z",
      "checksum": "abc123def456"
    }
  ]
}
```

### 4. Search Airports

```bash
curl "http://localhost:8080/api/airports?search=SFO"
```

Response:
```json
[
  {
    "icao": "KSFO",
    "iata": "SFO",
    "name": "San Francisco International Airport",
    "city": "San Francisco",
    "country": "United States",
    "latitude": 37.6213,
    "longitude": -122.3790
  }
]
```

---

## API Endpoints

### Events

#### `GET /api/events`

List aviation events with filtering and pagination.

**Query Parameters:**

| Parameter | Type | Description | Example |
|-----------|------|-------------|---------|
| `from` | date | Filter events from this date (YYYY-MM-DD) | `2024-01-01` |
| `to` | date | Filter events to this date (YYYY-MM-DD) | `2024-12-31` |
| `category` | enum | Filter by flight category: `GA`, `Commercial`, `all` | `GA` |
| `airport` | string | Filter by airport ICAO code | `KSFO` |
| `country` | string | Filter by country code | `US` |
| `region` | string | Filter by region | `North America` |
| `search` | string | Full-text search in narrative | `engine failure` |
| `limit` | integer | Number of results per page (1-100, default: 50) | `10` |
| `offset` | integer | Pagination offset (default: 0) | `0` |

**Response:** `EventList` schema

**Example:**
```bash
curl "http://localhost:8080/api/events?country=US&category=GA&limit=20&offset=0"
```

#### `GET /api/events/{id}`

Get detailed information about a specific event.

**Path Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | string | Event ID (e.g., `ASN_2024-01-15_N12345`) |

**Response:** `EventWithSources` schema

**Example:**
```bash
curl http://localhost:8080/api/events/ASN_2024-01-15_N12345
```

### Airports

#### `GET /api/airports`

Search for airports by ICAO, IATA, or name.

**Query Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `search` | string | Yes | Search query (ICAO, IATA, or name) |

**Response:** Array of `Airport` schema (max 20 results)

**Example:**
```bash
curl "http://localhost:8080/api/airports?search=San%20Francisco"
```

### Filters

#### `GET /api/filters/options`

Get available filter options for countries and regions.

**Response:** `FilterOptions` schema

**Example:**
```bash
curl http://localhost:8080/api/filters/options
```

Response:
```json
{
  "countries": ["US", "CA", "MX", ...],
  "regions": ["North America", "Europe", ...]
}
```

### Ingestion

#### `POST /api/ingest/run`

Manually trigger data ingestion from aviation accident sources.

**⚠️ Authentication Required**

**Headers:**
```
Authorization: Bearer <token>
```

**Request Body:**
```json
{
  "source": "ASN",          // Optional: "ASN" or "AVHerald" (omit for all)
  "windowDays": 40          // Optional: Days to look back (1-365, default: 40)
}
```

**Response:** `IngestionResult` schema

**Example:**
```bash
curl -X POST http://localhost:8080/api/ingest/run \
  -H "Authorization: Bearer dev-token" \
  -H "Content-Type: application/json" \
  -d '{"source": "ASN", "windowDays": 7}'
```

Response:
```json
{
  "status": "completed",
  "results": [
    {
      "source": "ASN",
      "fetched": 150,
      "inserted": 15,
      "updated": 5,
      "skipped": 130,
      "errors": 0
    }
  ]
}
```

### Health

#### `GET /health`

Check service health and get last ingestion run info.

**Response:** `Health` schema

**Example:**
```bash
curl http://localhost:8080/health
```

#### `GET /version`

Get service version information.

**Response:**
```json
{
  "version": "0.1.0",
  "service": "accident-tracker"
}
```

---

## Authentication

### Ingestion Endpoint

The `/api/ingest/run` endpoint requires Bearer token authentication.

**Development Token:**
```
Bearer dev-token
```

**Production:**
Set `INGESTION_TOKEN` environment variable:
```bash
export INGESTION_TOKEN="your-secure-token-here"
```

**Usage:**
```bash
curl -X POST http://localhost:8080/api/ingest/run \
  -H "Authorization: Bearer your-token" \
  -d '{"windowDays": 7}'
```

**Error Responses:**

- **401 Unauthorized**: Missing or malformed Authorization header
- **403 Forbidden**: Invalid token

---

## Data Schemas

### Event

Core event data structure:

```typescript
{
  id: string;                    // Unique identifier (e.g., "ASN_2024-01-15_N12345")
  date_z: string;                // ISO 8601 timestamp (UTC)
  registration?: string;         // Aircraft registration (e.g., "N12345")
  aircraft_type?: string;        // Aircraft type (e.g., "Cessna 172")
  operator?: string;             // Operator name
  airport_icao?: string;         // Airport ICAO code (e.g., "KSFO")
  airport_name?: string;         // Airport full name
  location?: string;             // Location description
  country?: string;              // Country code (ISO 3166-1 alpha-2)
  region?: string;               // Geographic region
  latitude?: number;             // Latitude (-90 to 90)
  longitude?: number;            // Longitude (-180 to 180)
  category: 'GA' | 'Commercial' | 'Unknown';
  narrative?: string;            // Full narrative text
  narrative_summary?: string;    // Brief summary
  fatalities?: number;           // Number of fatalities (≥0)
  injuries?: number;             // Number of injuries (≥0)
  damage?: string;               // Damage assessment
}
```

### EventWithSources

Event with provenance information:

```typescript
{
  ...Event,
  sources: Array<{
    source_name: string;          // "ASN", "AVHerald", etc.
    source_url: string;           // URL to source
    fetched_at_z: string;         // ISO 8601 timestamp
    checksum?: string;            // Content checksum
  }>
}
```

### Airport

Airport information:

```typescript
{
  icao: string;                   // ICAO code (e.g., "KSFO")
  iata?: string;                  // IATA code (e.g., "SFO")
  name: string;                   // Airport name
  city?: string;                  // City
  country?: string;               // Country
  latitude?: number;              // Latitude
  longitude?: number;             // Longitude
}
```

---

## Error Handling

All errors follow a consistent format:

```json
{
  "error": "Error type",
  "message": "Detailed error message"
}
```

### Common HTTP Status Codes

| Code | Description | Example |
|------|-------------|---------|
| `200` | Success | Successful request |
| `401` | Unauthorized | Missing authentication token |
| `403` | Forbidden | Invalid authentication token |
| `404` | Not Found | Event or resource not found |
| `500` | Server Error | Internal server error |

### Example Error Responses

**404 Not Found:**
```json
{
  "error": "Not found",
  "message": "Event ASN_2024-01-01_N12345 not found"
}
```

**401 Unauthorized:**
```json
{
  "error": "Unauthorized",
  "message": "Bearer token required"
}
```

**500 Server Error:**
```json
{
  "error": "Internal server error",
  "message": "Database connection failed"
}
```

---

## Filtering and Pagination

### Date Range Filtering

Use `from` and `to` parameters for date range queries:

```bash
# Events in 2024
curl "http://localhost:8080/api/events?from=2024-01-01&to=2024-12-31"

# Events in last 7 days
FROM=$(date -u -d '7 days ago' +%Y-%m-%d)
curl "http://localhost:8080/api/events?from=$FROM"
```

### Category Filtering

Filter by flight category:

```bash
# General Aviation only
curl "http://localhost:8080/api/events?category=GA"

# Commercial only
curl "http://localhost:8080/api/events?category=Commercial"

# All categories
curl "http://localhost:8080/api/events?category=all"
```

### Geographic Filtering

Filter by country or region:

```bash
# US events only
curl "http://localhost:8080/api/events?country=US"

# North America events
curl "http://localhost:8080/api/events?region=North%20America"

# Specific airport
curl "http://localhost:8080/api/events?airport=KSFO"
```

### Full-Text Search

Search in event narratives:

```bash
curl "http://localhost:8080/api/events?search=engine%20failure"
```

### Pagination

Use `limit` and `offset` for pagination:

```bash
# First page (10 results)
curl "http://localhost:8080/api/events?limit=10&offset=0"

# Second page (10 results)
curl "http://localhost:8080/api/events?limit=10&offset=10"

# Third page (10 results)
curl "http://localhost:8080/api/events?limit=10&offset=20"
```

### Combining Filters

All filters can be combined:

```bash
curl "http://localhost:8080/api/events?\
from=2024-01-01&\
to=2024-12-31&\
category=GA&\
country=US&\
search=engine%20failure&\
limit=20&\
offset=0"
```

---

## Code Examples

### JavaScript/TypeScript

```typescript
// Fetch events
const response = await fetch('http://localhost:8080/api/events?category=GA&limit=10');
const data = await response.json();
console.log(`Found ${data.total} events`);
data.events.forEach(event => {
  console.log(`${event.id}: ${event.narrative_summary}`);
});

// Get event details
const eventResponse = await fetch(`http://localhost:8080/api/events/${eventId}`);
const event = await eventResponse.json();
console.log(`Event from sources: ${event.sources.map(s => s.source_name).join(', ')}`);

// Trigger ingestion (with auth)
const ingestResponse = await fetch('http://localhost:8080/api/ingest/run', {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer dev-token',
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({ windowDays: 7 }),
});
const result = await ingestResponse.json();
console.log(`Ingestion status: ${result.status}`);
```

### Python

```python
import requests

# Fetch events
response = requests.get(
    'http://localhost:8080/api/events',
    params={'category': 'GA', 'limit': 10}
)
data = response.json()
print(f"Found {data['total']} events")

# Get event details
event_id = 'ASN_2024-01-15_N12345'
event = requests.get(f'http://localhost:8080/api/events/{event_id}').json()
print(f"Sources: {[s['source_name'] for s in event['sources']]}")

# Trigger ingestion (with auth)
result = requests.post(
    'http://localhost:8080/api/ingest/run',
    headers={'Authorization': 'Bearer dev-token'},
    json={'windowDays': 7}
)
print(f"Status: {result.json()['status']}")
```

### cURL

```bash
# Get events with filters
curl -G "http://localhost:8080/api/events" \
  -d "category=GA" \
  -d "country=US" \
  -d "from=2024-01-01" \
  -d "limit=20"

# Get event details
curl "http://localhost:8080/api/events/ASN_2024-01-15_N12345"

# Trigger ingestion
curl -X POST "http://localhost:8080/api/ingest/run" \
  -H "Authorization: Bearer dev-token" \
  -H "Content-Type: application/json" \
  -d '{"source": "ASN", "windowDays": 7}'
```

---

## Rate Limiting

**Current Status**: No rate limiting implemented

**Future**: Rate limiting will be added to prevent abuse:
- Public endpoints: 100 requests/minute
- Authenticated endpoints: 1000 requests/minute
- Ingestion endpoint: 10 requests/hour

---

## CORS

CORS is enabled for all origins in development. In production, configure allowed origins via environment variables.

---

## OpenAPI Specification Details

### Specification Version

OpenAPI 3.0.0

### Tags

API endpoints are organized by tags:

- **Events**: Aviation accident and incident events
- **Airports**: Airport search
- **Filters**: Filter options
- **Ingestion**: Data ingestion management
- **Health**: Service health

### Security

- **BearerAuth**: HTTP Bearer token for ingestion endpoint

### Servers

- Development: `http://localhost:8080`
- Production: TBD

---

## Changelog

### v0.1.0 (2024-01-14)

- ✅ Initial API implementation
- ✅ Complete OpenAPI 3.0 specification
- ✅ Swagger UI at `/docs`
- ✅ All endpoints documented
- ✅ Request/response schemas defined
- ✅ Authentication implemented
- ✅ Error handling standardized

---

## Support

### Documentation Issues

If you find issues with the API documentation:

1. Check `/docs` for the latest interactive documentation
2. Download `/openapi.json` for the raw specification
3. Report issues in the Aviation monorepo

### API Issues

For API bugs or feature requests, open an issue in the Aviation monorepo.

---

## Related Documentation

- [README.md](README.md) - Project overview
- [PLAN.md](PLAN.md) - Development plan
- [Operations Guide](OPERATIONS.md) - Deployment and operations

---

**API Documentation Complete** ✅

All endpoints documented with OpenAPI 3.0 specification, interactive Swagger UI, and comprehensive examples.
