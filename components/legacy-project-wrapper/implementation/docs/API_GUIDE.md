# Aviation Monorepo API Usage Guide

**Version:** 1.0.0  
**Last Updated:** January 15, 2026

This guide provides comprehensive documentation for using the Aviation Monorepo APIs, including authentication, best practices, and code examples.

---

## Table of Contents

- [Getting Started](#getting-started)
- [Authentication](#authentication)
- [Accident Tracker API](#accident-tracker-api)
- [Flight Planner API](#flight-planner-api)
- [ForeFlight Dashboard API](#foreflight-dashboard-api)
- [Flight School API](#flight-school-api)
- [Rate Limiting](#rate-limiting)
- [Error Handling](#error-handling)
- [Best Practices](#best-practices)
- [Code Examples](#code-examples)

---

## Getting Started

### Base URLs

| Application | Environment | Base URL |
|-------------|-------------|----------|
| Accident Tracker | Production | `https://accident-tracker.aviation.example.com` |
| Accident Tracker | Staging | `https://staging-accident-tracker.aviation.example.com` |
| Flight Planner | Production | `https://flight-planner.aviation.example.com` |
| Flight School | Production | `https://flightschool.aviation.example.com` |
| ForeFlight Dashboard | Production | `https://foreflight.aviation.example.com` |

### Health Checks

All APIs provide a `/health` endpoint for monitoring:

```bash
curl https://accident-tracker.aviation.example.com/health
```

**Response:**
```json
{
  "status": "healthy",
  "timestamp": "2026-01-15T10:30:00Z",
  "version": "1.2.3",
  "uptime": 86400
}
```

---

## Authentication

### API Keys (Accident Tracker)

The Accident Tracker API requires an API key for authenticated requests.

#### Obtaining an API Key

Contact your administrator or use the admin dashboard to generate an API key.

#### Using API Keys

Include your API key in the `X-API-Key` header:

```bash
curl -H "X-API-Key: avt_your_api_key_here" \
  https://accident-tracker.aviation.example.com/api/v1/events
```

**TypeScript:**
```typescript
const response = await fetch('https://accident-tracker.aviation.example.com/api/v1/events', {
  headers: {
    'X-API-Key': 'avt_your_api_key_here'
  }
});
```

**Python:**
```python
import requests

headers = {
    'X-API-Key': 'avt_your_api_key_here'
}

response = requests.get(
    'https://accident-tracker.aviation.example.com/api/v1/events',
    headers=headers
)
```

### Session-Based Auth (Flight School)

Flight School uses session-based authentication with cookies:

```bash
# Login
curl -X POST https://flightschool.aviation.example.com/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email": "pilot@example.com", "password": "secret"}' \
  -c cookies.txt

# Use session
curl https://flightschool.aviation.example.com/api/bookings \
  -b cookies.txt
```

---

## Accident Tracker API

### List Events

Retrieve a paginated list of aviation accidents and incidents.

**Endpoint:** `GET /api/v1/events`

**Query Parameters:**
- `page` (integer, default: 1) - Page number
- `limit` (integer, default: 20, max: 100) - Items per page
- `from` (string, ISO date) - Start date filter
- `to` (string, ISO date) - End date filter
- `category` (string) - Filter by category (`accident`, `incident`, `all`)
- `airport` (string) - Filter by airport ICAO/IATA code
- `country` (string) - Filter by country code
- `region` (string) - Filter by region
- `search` (string) - Search in summary, operator, registration

**Example Request:**
```bash
curl "https://accident-tracker.aviation.example.com/api/v1/events?category=accident&country=US&limit=50"
```

**Example Response:**
```json
{
  "events": [
    {
      "id": 1,
      "date": "2024-01-15",
      "category": "accident",
      "summary": "Aircraft struck terrain during approach",
      "location": "KJFK, New York, USA",
      "aircraft_type": "Boeing 737",
      "registration": "N12345",
      "operator": "Example Airlines",
      "fatalities": 0,
      "injuries": 2
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 50,
    "total": 1234,
    "pages": 25
  }
}
```

### Get Event Details

Retrieve full details for a specific event.

**Endpoint:** `GET /api/v1/events/:id`

**Example Request:**
```bash
curl "https://accident-tracker.aviation.example.com/api/v1/events/1"
```

**Example Response:**
```json
{
  "event": {
    "id": 1,
    "date": "2024-01-15",
    "category": "accident",
    "summary": "Aircraft struck terrain during approach",
    "location": "KJFK, New York, USA",
    "aircraft_type": "Boeing 737",
    "registration": "N12345",
    "operator": "Example Airlines",
    "fatalities": 0,
    "injuries": 2,
    "sources": [
      {
        "type": "NTSB",
        "url": "https://data.ntsb.gov/...",
        "title": "NTSB Report"
      }
    ]
  }
}
```

### Statistics

Get aggregated statistics.

**Endpoint:** `GET /api/v1/statistics`

**Query Parameters:**
- `groupBy` (string) - Group by field (`date`, `category`, `country`, `aircraft_type`)
- `from` (string, ISO date) - Start date
- `to` (string, ISO date) - End date

**Example Request:**
```bash
curl "https://accident-tracker.aviation.example.com/api/v1/statistics?groupBy=category&from=2024-01-01&to=2024-12-31"
```

**Example Response:**
```json
{
  "statistics": {
    "accident": 145,
    "incident": 892,
    "total": 1037
  },
  "period": {
    "from": "2024-01-01",
    "to": "2024-12-31"
  }
}
```

---

## Flight Planner API

### Calculate Route

Calculate a flight route between two airports.

**Endpoint:** `POST /api/v1/route`

**Request Body:**
```json
{
  "origin": "KSFO",
  "destination": "KJFK",
  "aircraft": {
    "type": "C172",
    "cruiseSpeed": 110,
    "fuelBurn": 9
  },
  "altitude": 8500,
  "includeAlternates": true
}
```

**Response:**
```json
{
  "route": {
    "origin": {"icao": "KSFO", "name": "San Francisco International"},
    "destination": {"icao": "KJFK", "name": "John F Kennedy International"},
    "distance": 2586,
    "estimatedTime": 1410,
    "fuelRequired": 212,
    "segments": [...]
  }
}
```

### Get Weather Briefing

Get comprehensive weather briefing for a route.

**Endpoint:** `POST /api/v1/weather/route`

**Request Body:**
```json
{
  "waypoints": ["KSFO", "KOAK", "KJFK"],
  "departureTime": "2026-01-15T10:00:00Z"
}
```

---

## Rate Limiting

### Rate Limit Headers

All API responses include rate limiting headers:

```
X-RateLimit-Limit: 1000
X-RateLimit-Remaining: 998
X-RateLimit-Reset: 1705315200
```

### Rate Limits by Tier

| Tier | Requests per Hour | Endpoints |
|------|-------------------|-----------|
| Public (unauthenticated) | 100 | Read-only endpoints |
| Authenticated | 1,000 | All endpoints |
| Admin | 10,000 | All endpoints + ingestion |

### Handling Rate Limits

When you exceed the rate limit, you'll receive a `429 Too Many Requests` response:

```json
{
  "error": "Rate limit exceeded",
  "message": "Too many requests. Please try again later.",
  "retryAfter": "3600",
  "limit": 1000,
  "window": "1 hour"
}
```

**Best Practice:**
```typescript
async function apiRequestWithRetry(url: string, options: RequestInit, maxRetries = 3) {
  for (let i = 0; i < maxRetries; i++) {
    const response = await fetch(url, options);
    
    if (response.status === 429) {
      const retryAfter = parseInt(response.headers.get('Retry-After') || '60');
      console.log(`Rate limited. Waiting ${retryAfter}s...`);
      await new Promise(resolve => setTimeout(resolve, retryAfter * 1000));
      continue;
    }
    
    return response;
  }
  
  throw new Error('Max retries exceeded');
}
```

---

## Error Handling

### Error Response Format

All APIs return errors in a consistent format:

```json
{
  "error": "Error Type",
  "message": "Human-readable error message",
  "code": "ERROR_CODE",
  "details": {
    "field": "Additional context"
  }
}
```

### Common HTTP Status Codes

| Code | Meaning | Action |
|------|---------|--------|
| 200 | Success | Process response |
| 201 | Created | Resource created successfully |
| 400 | Bad Request | Check request parameters |
| 401 | Unauthorized | Provide valid API key |
| 403 | Forbidden | Insufficient permissions |
| 404 | Not Found | Resource doesn't exist |
| 429 | Too Many Requests | Implement rate limiting logic |
| 500 | Internal Server Error | Retry with exponential backoff |
| 503 | Service Unavailable | Service temporarily down, retry later |

### Error Handling Best Practices

**TypeScript:**
```typescript
try {
  const response = await fetch(url, options);
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(`API Error: ${error.message}`);
  }
  
  return await response.json();
} catch (error) {
  if (error instanceof TypeError) {
    console.error('Network error:', error);
    // Implement retry logic
  } else {
    console.error('API error:', error);
    // Handle specific errors
  }
}
```

**Python:**
```python
import requests
from requests.exceptions import RequestException

try:
    response = requests.get(url, headers=headers, timeout=10)
    response.raise_for_status()
    return response.json()
except requests.exceptions.HTTPError as e:
    if e.response.status_code == 429:
        # Handle rate limiting
        retry_after = int(e.response.headers.get('Retry-After', 60))
        time.sleep(retry_after)
        # Retry request
    elif e.response.status_code >= 500:
        # Handle server errors with exponential backoff
        pass
    else:
        # Handle client errors
        print(f"HTTP error: {e.response.json()}")
except RequestException as e:
    print(f"Request failed: {e}")
```

---

## Best Practices

### 1. Use Caching

Cache responses that don't change frequently:

```typescript
import { getCache, CacheTTL } from '@aviation/shared-sdk';

const cache = getCache();

async function fetchAirportData(icao: string) {
  return await cache.getOrSet(
    `airport:${icao}`,
    async () => {
      const response = await fetch(`/api/airports/${icao}`);
      return response.json();
    },
    { ttl: CacheTTL.AIRPORT_DATA } // 24 hours
  );
}
```

### 2. Implement Pagination

Always use pagination for large datasets:

```typescript
async function fetchAllEvents() {
  const events = [];
  let page = 1;
  let hasMore = true;
  
  while (hasMore) {
    const response = await fetch(`/api/v1/events?page=${page}&limit=100`);
    const data = await response.json();
    
    events.push(...data.events);
    hasMore = page < data.pagination.pages;
    page++;
    
    // Be nice to the API
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  
  return events;
}
```

### 3. Handle Timeouts

Set reasonable timeouts for API requests:

```typescript
const controller = new AbortController();
const timeout = setTimeout(() => controller.abort(), 10000); // 10 second timeout

try {
  const response = await fetch(url, { signal: controller.signal });
  clearTimeout(timeout);
  return await response.json();
} catch (error) {
  if (error.name === 'AbortError') {
    console.error('Request timed out');
  }
  throw error;
}
```

### 4. Use Compression

Request compressed responses:

```bash
curl -H "Accept-Encoding: gzip, deflate" \
  https://accident-tracker.aviation.example.com/api/v1/events
```

### 5. Monitor API Usage

Track your API usage to avoid rate limits:

```typescript
class APIClient {
  private requestCount = 0;
  private windowStart = Date.now();
  
  async request(url: string, options?: RequestInit) {
    // Reset counter every hour
    if (Date.now() - this.windowStart > 3600000) {
      this.requestCount = 0;
      this.windowStart = Date.now();
    }
    
    this.requestCount++;
    console.log(`API requests this hour: ${this.requestCount}/1000`);
    
    return fetch(url, options);
  }
}
```

---

## Code Examples

See the [`docs/examples/`](./examples/) directory for complete, runnable code examples:

- [`examples/typescript/`](./examples/typescript/) - TypeScript/JavaScript examples
- [`examples/python/`](./examples/python/) - Python examples
- [`examples/curl/`](./examples/curl/) - curl command examples

### Quick Examples

#### Fetch Recent Accidents (TypeScript)

```typescript
import { createClient } from './api-client';

const client = createClient({
  apiKey: 'avt_your_api_key_here',
  baseUrl: 'https://accident-tracker.aviation.example.com'
});

async function getRecentAccidents() {
  const response = await client.get('/api/v1/events', {
    params: {
      category: 'accident',
      limit: 10,
      from: '2024-01-01'
    }
  });
  
  return response.data.events;
}
```

#### Calculate Flight Route (Python)

```python
import requests

def calculate_route(origin: str, destination: str):
    response = requests.post(
        'https://flight-planner.aviation.example.com/api/v1/route',
        json={
            'origin': origin,
            'destination': destination,
            'aircraft': {
                'type': 'C172',
                'cruiseSpeed': 110,
                'fuelBurn': 9
            },
            'altitude': 8500
        }
    )
    
    response.raise_for_status()
    return response.json()['route']

route = calculate_route('KSFO', 'KJFK')
print(f"Distance: {route['distance']} NM")
print(f"Estimated Time: {route['estimatedTime']} minutes")
```

---

## Support

For API support and questions:

- **GitHub Issues:** https://github.com/aviation/monorepo/issues
- **Documentation:** https://docs.aviation.example.com
- **Email:** api-support@aviation.example.com

---

## Changelog

### v1.0.0 (2026-01-15)
- Initial API documentation
- Added comprehensive examples
- Added best practices section
- Added rate limiting guide

---

**Last Updated:** January 15, 2026  
**Maintained by:** Aviation Monorepo Team
