# Aviation Accident Tracker - GraphQL API Guide

**Version:** 1.0.0  
**Last Updated:** January 15, 2026

This guide provides comprehensive documentation for using the GraphQL API of the Aviation Accident Tracker.

---

## Table of Contents

- [Getting Started](#getting-started)
- [Authentication](#authentication)
- [GraphQL Endpoint](#graphql-endpoint)
- [Schema Overview](#schema-overview)
- [Queries](#queries)
- [Mutations](#mutations)
- [Subscriptions](#subscriptions)
- [Error Handling](#error-handling)
- [Best Practices](#best-practices)
- [Code Examples](#code-examples)

---

## Getting Started

### GraphQL Endpoint

| Environment | HTTP Endpoint | WebSocket Endpoint |
|-------------|---------------|-------------------|
| Production | `https://accident-tracker.aviation.example.com/graphql` | `wss://accident-tracker.aviation.example.com/graphql` |
| Staging | `https://staging-accident-tracker.aviation.example.com/graphql` | `wss://staging-accident-tracker.aviation.example.com/graphql` |
| Development | `http://localhost:3002/graphql` | `ws://localhost:3002/graphql` |

### GraphQL Playground

In development, GraphQL Playground is available at the same endpoint as the API:

**Local:** http://localhost:3002/graphql

The playground provides:
- Interactive query editor with autocomplete
- Schema documentation browser
- Query history
- Variable editor
- Response viewer

---

## Authentication

### API Key Authentication

Include your API key in the `X-API-Key` header:

```graphql
# HTTP Headers
{
  "X-API-Key": "avt_your_api_key_here"
}
```

### Admin Authentication

For mutations and admin operations, use Bearer token:

```graphql
# HTTP Headers
{
  "Authorization": "Bearer your-admin-token"
}
```

---

## Schema Overview

The GraphQL schema provides:

### Types
- **Event** - Aviation accident or incident
- **EventSource** - Reference to source data
- **EventConnection** - Cursor-based pagination
- **EventStatistics** - Aggregated statistics
- **TimelineDataPoint** - Timeline visualization data
- **HealthStatus** - System health information

### Enums
- **EventCategory** - ACCIDENT, INCIDENT, ALL
- **FlightPhase** - TAXI, TAKEOFF, CLIMB, CRUISE, DESCENT, APPROACH, LANDING, GROUND
- **EventSortField** - DATE, FATALITIES, INJURIES, CREATED_AT
- **SortDirection** - ASC, DESC
- **TimelineInterval** - DAY, WEEK, MONTH, QUARTER, YEAR

### Input Types
- **EventFilter** - Filter criteria for events
- **EventSort** - Sort options
- **EventUpdateInput** - Fields for updating events

---

## Queries

### 1. Health Check

Check system health and status:

```graphql
query Health {
  health {
    status
    timestamp
    version
    uptime
    database {
      connected
      totalEvents
      lastIngestion
    }
  }
}
```

**Response:**
```json
{
  "data": {
    "health": {
      "status": "healthy",
      "timestamp": "2026-01-15T10:00:00Z",
      "version": "1.0.0",
      "uptime": 86400,
      "database": {
        "connected": true,
        "totalEvents": 12543,
        "lastIngestion": "2026-01-15T06:00:00Z"
      }
    }
  }
}
```

### 2. List Events (Paginated)

Fetch events with cursor-based pagination:

```graphql
query ListEvents($first: Int, $after: String, $filter: EventFilter) {
  events(first: $first, after: $after, filter: $filter) {
    edges {
      node {
        id
        date
        category
        summary
        location
        country
        aircraftType
        operator
        fatalities
        injuries
      }
      cursor
    }
    pageInfo {
      hasNextPage
      hasPreviousPage
      endCursor
    }
    totalCount
  }
}
```

**Variables:**
```json
{
  "first": 20,
  "filter": {
    "category": "ACCIDENT",
    "from": "2024-01-01",
    "to": "2024-12-31",
    "country": "US"
  }
}
```

**Response:**
```json
{
  "data": {
    "events": {
      "edges": [
        {
          "node": {
            "id": "1234",
            "date": "2024-06-15T00:00:00Z",
            "category": "ACCIDENT",
            "summary": "Aircraft struck terrain during approach",
            "location": "KJFK, New York, USA",
            "country": "US",
            "aircraftType": "Boeing 737",
            "operator": "Example Airlines",
            "fatalities": 0,
            "injuries": 2
          },
          "cursor": "ZXZlbnQ6MTIzNA=="
        }
      ],
      "pageInfo": {
        "hasNextPage": true,
        "hasPreviousPage": false,
        "endCursor": "ZXZlbnQ6MTIzNA=="
      },
      "totalCount": 1543
    }
  }
}
```

### 3. Get Single Event

Retrieve full details for a specific event:

```graphql
query GetEvent($id: ID!) {
  event(id: $id) {
    id
    date
    category
    summary
    description
    location
    country
    region
    airportIcao
    airportIata
    aircraftType
    registration
    operator
    phaseOfFlight
    fatalities
    injuries
    totalOnBoard
    weather
    cause
    sources {
      type
      url
      title
      fetchedAt
    }
    createdAt
    updatedAt
  }
}
```

**Variables:**
```json
{
  "id": "1234"
}
```

### 4. Get Statistics

Fetch aggregated statistics:

```graphql
query GetStatistics($filter: EventFilter) {
  statistics(filter: $filter) {
    total
    byCategory {
      category
      count
      fatalities
      injuries
    }
    byCountry {
      country
      count
      fatalities
      injuries
    }
    byAircraftType {
      aircraftType
      count
      fatalities
      injuries
    }
    period {
      from
      to
    }
  }
}
```

**Variables:**
```json
{
  "filter": {
    "from": "2024-01-01",
    "to": "2024-12-31"
  }
}
```

### 5. Get Timeline Data

Fetch timeline data for visualization:

```graphql
query GetTimeline($from: DateTime!, $to: DateTime!, $interval: TimelineInterval) {
  timeline(from: $from, to: $to, interval: $interval) {
    date
    count
    accidents
    incidents
    fatalities
  }
}
```

**Variables:**
```json
{
  "from": "2024-01-01",
  "to": "2024-12-31",
  "interval": "MONTH"
}
```

### 6. Search Events

Full-text search across events:

```graphql
query SearchEvents($query: String!, $limit: Int) {
  searchEvents(query: $query, limit: $limit) {
    id
    date
    category
    summary
    location
    aircraftType
    operator
    fatalities
  }
}
```

**Variables:**
```json
{
  "query": "Boeing 737 runway",
  "limit": 10
}
```

---

## Mutations

### 1. Trigger Ingestion (Admin Only)

Manually trigger data ingestion:

```graphql
mutation TriggerIngestion($source: IngestionSource!) {
  triggerIngestion(source: $source) {
    success
    eventsIngested
    startedAt
    completedAt
    errors
  }
}
```

**Variables:**
```json
{
  "source": "ASN"
}
```

**Headers:**
```json
{
  "Authorization": "Bearer your-admin-token"
}
```

### 2. Update Event (Admin Only)

Update event metadata:

```graphql
mutation UpdateEvent($id: ID!, $input: EventUpdateInput!) {
  updateEvent(id: $id, input: $input) {
    id
    summary
    description
    category
    fatalities
    injuries
    cause
    updatedAt
  }
}
```

**Variables:**
```json
{
  "id": "1234",
  "input": {
    "summary": "Updated summary",
    "cause": "Pilot error",
    "fatalities": 0
  }
}
```

### 3. Delete Event (Admin Only)

Delete an event:

```graphql
mutation DeleteEvent($id: ID!) {
  deleteEvent(id: $id) {
    success
    deletedId
  }
}
```

**Variables:**
```json
{
  "id": "1234"
}
```

---

## Subscriptions

### 1. Subscribe to New Events

Real-time updates when new events are added:

```graphql
subscription OnEventAdded($filter: EventFilter) {
  eventAdded(filter: $filter) {
    id
    date
    category
    summary
    location
    aircraftType
    fatalities
  }
}
```

**Variables:**
```json
{
  "filter": {
    "category": "ACCIDENT",
    "country": "US"
  }
}
```

### 2. Subscribe to Ingestion Status

Monitor ingestion progress:

```graphql
subscription OnIngestionStatus {
  ingestionStatus {
    state
    eventsProcessed
    source
    progress
    estimatedTimeRemaining
  }
}
```

---

## Error Handling

### Error Response Format

GraphQL errors follow this format:

```json
{
  "errors": [
    {
      "message": "Event not found",
      "extensions": {
        "code": "NOT_FOUND",
        "id": "9999"
      },
      "path": ["event"],
      "locations": [{"line": 2, "column": 3}]
    }
  ],
  "data": null
}
```

### Common Error Codes

| Code | Description | HTTP Status |
|------|-------------|-------------|
| `NOT_FOUND` | Resource not found | 404 |
| `FORBIDDEN` | Admin access required | 403 |
| `UNAUTHENTICATED` | Authentication required | 401 |
| `BAD_USER_INPUT` | Invalid input data | 400 |
| `INTERNAL_SERVER_ERROR` | Server error | 500 |

---

## Best Practices

### 1. Use Fragments for Reusable Fields

```graphql
fragment EventBasics on Event {
  id
  date
  category
  summary
  location
  fatalities
  injuries
}

query GetRecentEvents {
  events(first: 10, sort: { field: DATE, direction: DESC }) {
    edges {
      node {
        ...EventBasics
        aircraftType
        operator
      }
    }
  }
}
```

### 2. Request Only Needed Fields

❌ **Bad:**
```graphql
query {
  events(first: 100) {
    edges {
      node {
        id
        date
        category
        summary
        description
        location
        country
        region
        # ... requesting all fields
      }
    }
  }
}
```

✅ **Good:**
```graphql
query {
  events(first: 100) {
    edges {
      node {
        id
        date
        summary
        location
      }
    }
  }
}
```

### 3. Use Variables for Dynamic Queries

❌ **Bad:**
```graphql
query {
  event(id: "1234") {
    summary
  }
}
```

✅ **Good:**
```graphql
query GetEvent($id: ID!) {
  event(id: $id) {
    summary
  }
}
```

### 4. Implement Pagination

```graphql
query PaginatedEvents($after: String, $first: Int = 20) {
  events(after: $after, first: $first) {
    edges {
      node {
        id
        summary
      }
      cursor
    }
    pageInfo {
      hasNextPage
      endCursor
    }
  }
}
```

### 5. Handle Query Complexity

Queries have a complexity limit of 1000. Each field has a cost:
- Scalar fields: 1 point
- Object fields: 2 points
- Lists: 10x multiplier

Monitor query cost and optimize accordingly.

---

## Code Examples

### TypeScript (Apollo Client)

```typescript
import { ApolloClient, InMemoryCache, gql, createHttpLink } from '@apollo/client';
import { setContext } from '@apollo/client/link/context';

// Create HTTP link
const httpLink = createHttpLink({
  uri: 'https://accident-tracker.aviation.example.com/graphql',
});

// Add authentication
const authLink = setContext((_, { headers }) => {
  return {
    headers: {
      ...headers,
      'X-API-Key': 'avt_your_api_key_here',
    },
  };
});

// Create client
const client = new ApolloClient({
  link: authLink.concat(httpLink),
  cache: new InMemoryCache(),
});

// Query events
const GET_EVENTS = gql`
  query GetEvents($first: Int) {
    events(first: $first) {
      edges {
        node {
          id
          date
          summary
          location
        }
      }
      totalCount
    }
  }
`;

const { data } = await client.query({
  query: GET_EVENTS,
  variables: { first: 10 },
});

console.log(`Found ${data.events.totalCount} events`);
```

### Python (gql)

```python
from gql import gql, Client
from gql.transport.requests import RequestsHTTPTransport

# Create transport with authentication
transport = RequestsHTTPTransport(
    url='https://accident-tracker.aviation.example.com/graphql',
    headers={'X-API-Key': 'avt_your_api_key_here'}
)

# Create client
client = Client(transport=transport, fetch_schema_from_transport=True)

# Query events
query = gql('''
    query GetEvents($first: Int) {
        events(first: $first) {
            edges {
                node {
                    id
                    date
                    summary
                    location
                }
            }
            totalCount
        }
    }
''')

result = client.execute(query, variable_values={'first': 10})
print(f"Found {result['events']['totalCount']} events")
```

### curl

```bash
# Simple query
curl -X POST https://accident-tracker.aviation.example.com/graphql \
  -H "Content-Type: application/json" \
  -H "X-API-Key: avt_your_api_key_here" \
  -d '{
    "query": "{ health { status version } }"
  }'

# Query with variables
curl -X POST https://accident-tracker.aviation.example.com/graphql \
  -H "Content-Type: application/json" \
  -H "X-API-Key: avt_your_api_key_here" \
  -d '{
    "query": "query GetEvents($first: Int) { events(first: $first) { totalCount } }",
    "variables": {"first": 10}
  }'
```

---

## Advantages Over REST

### 1. Single Request for Multiple Resources

**REST:** Multiple requests needed
```
GET /api/v1/events/1234
GET /api/v1/events/1234/sources
GET /api/v1/statistics?category=accident
```

**GraphQL:** Single request
```graphql
query {
  event(id: "1234") {
    summary
    sources { url }
  }
  statistics(filter: { category: ACCIDENT }) {
    total
  }
}
```

### 2. Client-Specified Fields

**REST:** Over-fetching (returns all fields)
```json
{
  "id": 1234,
  "date": "2024-01-15",
  "summary": "...",
  "description": "...",
  "location": "...",
  // ... 20 more fields
}
```

**GraphQL:** Only requested fields
```graphql
query {
  event(id: "1234") {
    id
    summary
  }
}
```

### 3. Strong Typing

GraphQL schema provides:
- Compile-time type checking
- IDE autocomplete
- Automatic documentation
- Input validation

### 4. Real-Time Updates

GraphQL subscriptions provide WebSocket-based real-time data updates.

---

## Support

For GraphQL API support:

- **GraphQL Playground:** Test queries interactively
- **Schema Documentation:** Browse the complete schema in Playground
- **GitHub Issues:** https://github.com/aviation/monorepo/issues
- **Email:** api-support@aviation.example.com

---

**Last Updated:** January 15, 2026  
**Maintained by:** Aviation Monorepo Team
