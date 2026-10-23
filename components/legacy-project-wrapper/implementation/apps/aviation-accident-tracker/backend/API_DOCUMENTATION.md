# Aviation Accident Tracker - API Documentation

## Overview

The Aviation Accident Tracker API provides programmatic access to aviation accident and incident data from year 2000 onwards. Data is sourced from ASN (Aviation Safety Network) and AVHerald, normalized, deduplicated, and made available through REST endpoints.

## Interactive Documentation

Once the server is running, access the interactive Swagger UI documentation at:

**http://localhost:3000/docs**

The Swagger UI provides:
- Complete endpoint documentation
- Interactive API testing
- Request/response schemas
- Example requests and responses

## OpenAPI Specification

The OpenAPI 3.0 specification is available in multiple formats:

- **YAML**: http://localhost:3000/openapi.yaml
- **JSON**: http://localhost:3000/openapi.json
- **Source**: `src/openapi.yaml`

You can use these specs with any OpenAPI-compatible tool (Postman, Insomnia, etc.).

## Quick Start

### 1. Health Check

```bash
curl http://localhost:3000/health
```

Response:
```json
{
  "status": "healthy",
  "timestamp": "2024-01-14T10:30:00.000Z",
  "env": "development"
}
```

### 2. List Events

```bash
curl http://localhost:3000/api/events?limit=10
```

With filters:
```bash
curl "http://localhost:3000/api/events?category=general&country=USA&from=2024-01-01&limit=20"
```

### 3. Get Event Details

```bash
curl http://localhost:3000/api/events/42
```

### 4. Search Airports

```bash
curl "http://localhost:3000/api/airports?search=SFO"
```

### 5. Get Filter Options

```bash
curl http://localhost:3000/api/filters/options
```

## Authentication

Most endpoints are public and require no authentication. The ingestion endpoint requires Bearer token authentication:

```bash
curl -X POST http://localhost:3000/api/ingest/run \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"source": "asn", "windowDays": 40}'
```

Set the token via environment variable:
```bash
export INGESTION_TOKEN="your-secure-token"
```

## Endpoints

### Events

#### GET /api/events
List events with optional filtering and pagination.

**Query Parameters:**
- `from` (string): Start date (ISO 8601, e.g., `2024-01-01`)
- `to` (string): End date (ISO 8601)
- `category` (string): Filter by category (`all`, `general`, `commercial`)
- `airport` (string): Filter by airport ICAO/IATA code
- `country` (string): Filter by country
- `region` (string): Filter by region/state
- `search` (string): Text search across registration, operator, summary
- `limit` (integer): Results per page (default: 50, max: 100)
- `offset` (integer): Skip results for pagination (default: 0)

**Response:**
```json
{
  "events": [...],
  "total": 157,
  "limit": 50,
  "offset": 0
}
```

#### GET /api/events/:id
Get detailed information about a specific event including all sources.

**Response:**
```json
{
  "id": "42",
  "dateZ": "2024-01-15T10:30:00Z",
  "registration": "N12345",
  "aircraftType": "Cessna 172",
  "operator": "Private Owner",
  "category": "general",
  "airportIcao": "KSFO",
  "latitude": 37.6188,
  "longitude": -122.375,
  "country": "USA",
  "summary": "Engine failure on approach",
  "narrative": "Aircraft experienced sudden engine failure...",
  "sources": [
    {
      "sourceName": "asn",
      "url": "https://aviation-safety.net/database/record.php?id=20240115-0",
      "fetchedAt": "2024-01-15T12:00:00Z"
    }
  ]
}
```

### Ingestion

#### POST /api/ingest/run
Manually trigger data ingestion from sources. Requires authentication.

**Headers:**
- `Authorization: Bearer {token}`

**Request Body:**
```json
{
  "source": "asn",
  "windowDays": 40
}
```

**Response:**
```json
{
  "status": "completed",
  "results": [
    {
      "source": "asn",
      "eventsIngested": 12,
      "eventsUpdated": 3,
      "errors": 0
    }
  ]
}
```

### Filters

#### GET /api/airports
Search airports by ICAO/IATA code or name.

**Query Parameters:**
- `search` (string, required): Search query

**Response:**
```json
[
  {
    "icao": "KSFO",
    "iata": "SFO",
    "name": "San Francisco International Airport",
    "country": "USA",
    "region": "CA",
    "latitude": 37.6188,
    "longitude": -122.375
  }
]
```

#### GET /api/filters/options
Get available filter options (countries and regions).

**Response:**
```json
{
  "countries": ["USA", "Canada", "Mexico"],
  "regions": ["CA", "NY", "TX", "FL"]
}
```

### Health

#### GET /health
Health check endpoint.

#### GET /version
Get API version information.

## Rate Limiting

Currently no rate limiting is enforced, but it may be added in future versions.

## Error Responses

All errors follow a consistent format:

```json
{
  "error": "Error type",
  "message": "Detailed error message",
  "path": "/api/events/999"
}
```

**Common HTTP Status Codes:**
- `200` - Success
- `400` - Bad Request (invalid parameters)
- `401` - Unauthorized (missing/invalid authentication)
- `403` - Forbidden (insufficient permissions)
- `404` - Not Found
- `500` - Internal Server Error

## Data Model

### Event

Aviation accident or incident event with full metadata and provenance.

**Key Fields:**
- `dateZ` (string): Event date in UTC/Zulu time
- `registration` (string): Aircraft registration (e.g., N-number)
- `aircraftType` (string): Aircraft type/model
- `operator` (string): Operating entity
- `category` (enum): `general`, `commercial`, or `unknown`
- `airportIcao` (string): Airport ICAO code
- `latitude`, `longitude` (number): Event location
- `country`, `region` (string): Location details
- `fatalities`, `injuries` (integer): Casualty counts
- `summary` (string): Brief description
- `narrative` (string): Detailed description
- `status` (enum): `preliminary`, `final`, or `ongoing`

### Source

Provenance information for event data.

**Key Fields:**
- `sourceName` (enum): `asn` or `avherald`
- `url` (string): Source URL
- `fetchedAt` (datetime): When data was fetched
- `checksum` (string): Hash for change detection

## Examples

### Pagination

Get the first page:
```bash
curl "http://localhost:3000/api/events?limit=20&offset=0"
```

Get the second page:
```bash
curl "http://localhost:3000/api/events?limit=20&offset=20"
```

### Complex Filtering

Get general aviation events in California from 2024:
```bash
curl "http://localhost:3000/api/events?category=general&region=CA&from=2024-01-01&to=2024-12-31"
```

Search for specific registration:
```bash
curl "http://localhost:3000/api/events?search=N12345"
```

### Integration with curl

```bash
# Save to file
curl http://localhost:3000/api/events > events.json

# Pretty print with jq
curl http://localhost:3000/api/events | jq '.'

# Extract specific fields
curl http://localhost:3000/api/events | jq '.events[] | {date: .dateZ, registration: .registration, type: .aircraftType}'
```

### Integration with Python

```python
import requests

# Get events
response = requests.get('http://localhost:3000/api/events', params={
    'category': 'general',
    'limit': 100
})
events = response.json()

# Get specific event
event_id = events['events'][0]['id']
event = requests.get(f'http://localhost:3000/api/events/{event_id}').json()
print(f"Event: {event['registration']} - {event['summary']}")

# Trigger ingestion (requires auth)
response = requests.post(
    'http://localhost:3000/api/ingest/run',
    headers={'Authorization': 'Bearer YOUR_TOKEN'},
    json={'source': 'asn', 'windowDays': 40}
)
result = response.json()
print(f"Ingested {result['results'][0]['eventsIngested']} events")
```

### Integration with JavaScript/TypeScript

```typescript
// Fetch events
const response = await fetch('http://localhost:3000/api/events?limit=10');
const { events, total } = await response.json();

// Get event details
const event = await fetch(`http://localhost:3000/api/events/${events[0].id}`).then(r => r.json());

// Search airports
const airports = await fetch('http://localhost:3000/api/airports?search=SFO').then(r => r.json());
```

## Client Libraries

You can generate client libraries in any language using the OpenAPI spec:

```bash
# Generate TypeScript client
npx @openapitools/openapi-generator-cli generate \
  -i http://localhost:3000/openapi.yaml \
  -g typescript-axios \
  -o ./generated-client

# Generate Python client
docker run --rm -v "${PWD}:/local" openapitools/openapi-generator-cli generate \
  -i http://localhost:3000/openapi.yaml \
  -g python \
  -o /local/python-client
```

## Support

For issues or questions:
- Check the interactive docs at `/docs`
- Review the OpenAPI spec
- Open an issue on GitHub
- Consult the main README.md

## License

MIT License - See LICENSE file for details
