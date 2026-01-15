# Aviation Accident Tracker

> Part of the Aviation monorepo. Tracks and visualizes aviation accidents/incidents (>= year 2000) with provenance and GA/Commercial classification.

## Overview

The Aviation Accident Tracker ingests, deduplicates, and serves aviation accident/incident data from trusted public sources. It provides a web interface with an interactive map, powerful filters, and detailed event information with full provenance tracking.

### Key Features

- **Multi-Source Ingestion**: ASN (Aviation Safety Network), AVHerald
- **Deduplication**: Smart merging based on (date_z, registration) with fuzzy fallback
- **Classification**: Automated GA (General Aviation) vs Commercial categorization
- **Provenance**: Full source tracking with URLs, fetch times, and checksums
- **UTC Normalization**: All timestamps normalized to Zulu time
- **Historical Window**: Events from year 2000 onward
- **Interactive Map**: Mercator projection with clustered pins
- **Advanced Filters**: Date range, category, airport, country/region, text search
- **Sortable Table**: Paginated results with key details
- **Detail View**: Complete narratives with source attribution
- **Dual API**: REST + GraphQL APIs for maximum flexibility
- **Real-Time Subscriptions**: WebSocket support for live event updates

## Structure

```
apps/aviation-accident-tracker/
├── PLAN.md                     # Epic/work breakdown
├── README.md                   # This file
├── beads.yaml                  # Work organization
├── backend/                    # Node/TypeScript service
│   ├── src/
│   │   ├── api/                # REST API routes
│   │   ├── db/                 # Database schema & repository
│   │   │   ├── schema.sql      # SQLite schema with constraints
│   │   │   └── repository.ts   # Data access layer
│   │   ├── ingest/             # Source adapters & ingestion
│   │   ├── geo/                # Geocoding & airport lookup
│   │   ├── app.ts              # Express app setup
│   │   ├── index.ts            # Entry point
│   │   └── types.ts            # Shared TypeScript types
│   ├── package.json
│   └── tsconfig.json
├── frontend/                   # Vite/React UI
│   ├── src/
│   │   ├── components/         # React components
│   │   ├── pages/              # Page views
│   │   └── main.tsx            # App entry
│   ├── package.json
│   └── tsconfig.json
└── Makefile                    # Build/run commands
```

## Quick Start

### Prerequisites

- Node.js 20+
- npm 9+
- SQLite 3

### Setup & Build

```bash
# From monorepo root
cd apps/aviation-accident-tracker

# Install dependencies (backend + frontend)
make install

# Build both backend and frontend
make build
```

### Run Locally

```bash
# Start backend (port 8080)
make start-backend

# In another terminal, start frontend dev server (port 5173)
make start-frontend

# Or run both concurrently
make dev
```

Visit `http://localhost:5173` to access the UI.

### Run Tests

```bash
# Run all tests (backend + frontend)
make test

# Run backend tests only
cd backend && npm test

# Run frontend tests only
cd frontend && npm test
```

## Data Model

### Events Table

Core accident/incident records with >= 2000 constraint:

| Column | Type | Description |
|--------|------|-------------|
| `id` | INTEGER | Primary key |
| `date_z` | TEXT | UTC date (YYYY-MM-DD), >= 2000-01-01 |
| `registration` | TEXT | Aircraft registration (N-number, etc) |
| `aircraft_type` | TEXT | Aircraft model/type |
| `operator` | TEXT | Airline/operator name |
| `category` | TEXT | 'general', 'commercial', 'unknown' |
| `airport_icao` | TEXT | ICAO airport code |
| `airport_iata` | TEXT | IATA airport code |
| `latitude` | REAL | Decimal degrees |
| `longitude` | REAL | Decimal degrees |
| `country` | TEXT | Country name |
| `region` | TEXT | Region/state |
| `fatalities` | INTEGER | Number of fatalities |
| `injuries` | INTEGER | Number of injuries |
| `summary` | TEXT | Brief summary |
| `narrative` | TEXT | Detailed description |
| `status` | TEXT | 'preliminary', 'final', 'ongoing' |
| `created_at` | TEXT | UTC timestamp |
| `updated_at` | TEXT | UTC timestamp |

**Uniqueness**: `(date_z, registration)` — prevents duplicates for same accident

### Sources Table

Provenance tracking for each event:

| Column | Type | Description |
|--------|------|-------------|
| `id` | INTEGER | Primary key |
| `event_id` | INTEGER | Foreign key to events |
| `source_name` | TEXT | e.g. 'asn', 'avherald' |
| `url` | TEXT | Source URL |
| `fetched_at` | TEXT | UTC timestamp |
| `checksum` | TEXT | Content hash for change detection |
| `raw_fragment` | TEXT | Optional: raw HTML/JSON snippet |
| `created_at` | TEXT | UTC timestamp |

**Note**: An event can have multiple sources, enabling provenance aggregation.

## API Endpoints

### `GET /api/events`

List events with filters and pagination.

**Query Parameters:**
- `from` — Start date (YYYY-MM-DD)
- `to` — End date (YYYY-MM-DD)
- `category` — 'general', 'commercial', 'all' (default: all)
- `airport` — ICAO or IATA code
- `country` — Country name
- `region` — Region/state
- `search` — Text search (summary/operator/registration)
- `limit` — Results per page (default: 50)
- `offset` — Pagination offset (default: 0)

**Response:**
```json
{
  "events": [
    {
      "id": "42",
      "dateZ": "2024-03-15T10:30:00Z",
      "registration": "N12345",
      "aircraftType": "Cessna 172",
      "operator": "Private",
      "category": "general",
      "airportIcao": "KSFO",
      "country": "USA",
      "lat": 37.6213,
      "lon": -122.3790,
      "fatalities": 0,
      "injuries": 2,
      "summary": "Landing gear collapsed on touchdown",
      "status": "preliminary",
      "sources": [],
      "createdAt": "2024-03-15T12:00:00Z",
      "updatedAt": "2024-03-15T12:00:00Z"
    }
  ],
  "total": 1234,
  "limit": 50,
  "offset": 0
}
```

### `GET /api/events/:id`

Get detailed event with sources.

**Response:**
```json
{
  "id": "42",
  "dateZ": "2024-03-15T10:30:00Z",
  "registration": "N12345",
  "narrative": "Detailed description...",
  "sources": [
    {
      "sourceName": "asn",
      "url": "https://aviation-safety.net/...",
      "fetchedAt": "2024-03-15T12:00:00Z",
      "checksum": "abc123"
    }
  ],
  ...
}
```

### `POST /api/ingest/run`

Trigger manual ingestion (guarded endpoint, requires auth).

**Request:**
```json
{
  "source": "asn",  // optional: specific source
  "windowDays": 40  // optional: recent window (default: 40)
}
```

---

## GraphQL API

The application also provides a **GraphQL API** at `/graphql` with full query, mutation, and subscription support.

### Quick Start

**GraphQL Playground:** Available in development at `http://localhost:3002/graphql`

**Example Query:**
```graphql
query RecentAccidents {
  events(first: 10, filter: { category: ACCIDENT }, sort: { field: DATE, direction: DESC }) {
    edges {
      node {
        id
        date
        summary
        location
        aircraftType
        fatalities
        injuries
      }
    }
    totalCount
  }
}
```

**Example Subscription:**
```graphql
subscription OnNewEvent {
  eventAdded(filter: { category: ACCIDENT }) {
    id
    date
    summary
    location
  }
}
```

### Features

- **Cursor-based Pagination** - Efficient pagination for large datasets
- **Field Selection** - Request only the fields you need
- **Filtering & Sorting** - Powerful query capabilities
- **Real-Time Subscriptions** - WebSocket support for live updates
- **Query Complexity Limiting** - Automatic protection against expensive queries
- **Strong Typing** - Full TypeScript/introspection support
- **DataLoader** - Optimized batch loading to prevent N+1 queries

### Documentation

See **[GRAPHQL_API.md](./GRAPHQL_API.md)** for:
- Complete schema documentation
- Query examples
- Mutation guide
- Subscription setup
- Best practices
- Code examples (TypeScript, Python, curl)

### Advantages

**GraphQL Benefits:**
- Single request for multiple resources
- No over-fetching or under-fetching
- Real-time data with subscriptions
- Self-documenting via introspection
- Strong typing and validation

**When to Use:**
- Complex queries requiring multiple resources
- Mobile/bandwidth-constrained clients
- Real-time data requirements
- Dynamic UI requirements

**When to Use REST:**
- Simple CRUD operations
- Caching requirements
- Existing integrations
- File uploads/downloads

---

## API Documentation

- **REST API:** See API Endpoints section above
- **GraphQL API:** See [GRAPHQL_API.md](./GRAPHQL_API.md)
```

## Automated Ingestion

The application includes built-in scheduled data ingestion that runs automatically in the background.

### Configuration

- **Schedule**: Every 6 hours by default (`0 */6 * * *`)
- **Customization**: Set `INGEST_CRON` environment variable (cron format)
- **Enable/Disable**: Set `ENABLE_CRON=false` to disable automatic ingestion
- **Window**: Ingests events from the last 40 days (configurable)

### Monitoring

The `/health` endpoint includes information about the last ingestion run:

```json
{
  "status": "healthy",
  "timestamp": "2024-03-15T12:00:00Z",
  "ingest": {
    "started": "2024-03-15T11:00:00Z",
    "finished": "2024-03-15T11:05:30Z",
    "error": null  // or error message if failed
  }
}
```

### Manual Trigger

Use the `/api/ingest/run` endpoint to manually trigger ingestion outside the scheduled runs.

### How It Works

1. **Cron Job**: Runs on schedule (default: every 6 hours)
2. **Recent Window**: Fetches events from last 40 days from all sources
3. **Deduplication**: Automatically merges data from multiple sources
4. **Error Handling**: Failures are logged and reported in health endpoint
5. **Graceful**: Does not interrupt running server, runs in background

### Example Configuration

```bash
# Custom schedule (every 3 hours)
INGEST_CRON="0 */3 * * *"

# Disable automatic ingestion
ENABLE_CRON=false

# Or set in .env file
echo 'INGEST_CRON="0 */3 * * *"' >> .env
```

### Caching

The API caches `/api/events` and `/api/filters/options` responses. It uses a
short TTL in memory by default and switches to Redis if `REDIS_URL` is set.

- `REDIS_URL` (optional): Redis connection string (e.g., `redis://localhost:6379`)
json
{
  "status": "healthy",
  "timestamp": "2024-03-15T12:00:00Z"
}
```

## Ingestion

### Sources

1. **ASN (Aviation Safety Network)** — `source_name: 'asn'`
   - Recent occurrences page
   - HTML scraping with fallback to JSON if available
   - Updates: daily

2. **AVHerald** — `source_name: 'avherald'`
   - Recent incidents feed
   - RSS/Atom or HTML parsing
   - Updates: daily

### Deduplication Strategy

**Primary Key**: `(date_z, registration)`

- Exact match: upserts existing event
- Fuzzy fallback: `(date_z ± 1 day, country, aircraft_type)`
- Merge policy: preserve all fields, append sources

### Classification Heuristic

**GA (General Aviation)**:
- Operator matches: "Private", "N-number owner"
- Aircraft type: Cessna 172, Piper PA-28, small single-engine

**Commercial**:
- Operator matches: airline names, cargo carriers
- Aircraft type: jets, turboprops > 19 seats

**Unknown**: Default when heuristic inconclusive

### Scheduling

- **Recent window**: Crawl last 40 days daily at 02:00 UTC
- **Manual trigger**: `POST /api/ingest/run` (auth required)
- **Backfill**: Controlled batches for historical data (post-MVP)

### Error Handling

- Retries: 3 attempts with exponential backoff
- Partial failures: log and continue
- Rate limits: respect source rate limits (e.g. 1 req/sec)
- Observability: structured logs with ingestion metrics

## Development

### Backend Development

```bash
cd backend

# Install dependencies
npm install

# Run in watch mode
npm run dev

# Run tests
npm test

# Lint & format
npm run lint
npm run format
```

### Frontend Development

```bash
cd frontend

# Install dependencies
npm install

# Start dev server with HMR
npm run dev

# Run tests
npm test

# Build for production
npm run build
```

### Database Migrations

Currently using SQLite with `schema.sql`. For future migrations:

1. Create migration file: `migrations/00X_description.sql`
2. Apply with migration tool (to be added)

### Adding a New Source

1. Create adapter: `backend/src/ingest/adapters/my-source.ts`
2. Implement `SourceAdapter` interface:
   ```typescript
   interface SourceAdapter {
     fetchRecent(windowDays: number): Promise<EventRecord[]>;
     parseEvent(raw: any): EventRecord;
   }
   ```
3. Register in ingestion orchestrator
4. Add tests: `backend/tests/ingest/adapters/my-source.test.ts`

## Deployment

### Docker

```bash
# Build images
docker-compose build

# Run services
docker-compose up -d

# View logs
docker-compose logs -f

# Stop
docker-compose down
```

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `PORT` | Backend server port | 8080 |
| `DATABASE_PATH` | SQLite file path | `./data/events.db` |
| `NODE_ENV` | Environment | `development` |
| `LOG_LEVEL` | Logging level | `info` |

### Security

- Use Aviation monorepo `@aviation/keystore` for API keys
- Never commit `.env` files or secrets
- Rate limit ingestion endpoints
- Validate all input (sanitize search queries)

## Testing

### Backend Tests

- **Unit**: Repository, adapters, parsers (`npm test`)
- **Integration**: API endpoints with test DB
- **Contract**: Fixture-based source adapter tests
- Coverage target: 80%+

### Frontend Tests

- **Component**: React Testing Library
- **E2E**: Playwright (smoke tests)
- **Accessibility**: WCAG AA compliance checks

## Performance

### Targets

- Event list API: < 200ms (p95)
- Event detail API: < 100ms (p95)
- Map load: < 500ms (p95)
- Table pagination: < 300ms (p95)
- Ingestion throughput: 100 events/min

### Optimization

- Database indexes on common filters
- Pagination for large result sets
- Map clustering for dense areas
- CDN for static assets
- Server-side caching for expensive queries

## Contributing

See [Aviation monorepo CONTRIBUTING.md](../../CONTRIBUTING.md) for general guidelines.

### Workflow

1. Check `bd ready` for available work
2. Claim issue: `bd update <id> --status in_progress`
3. Branch: `git checkout -b feature/<bead-id>`
4. Implement + test
5. Quality checks: `make test lint`
6. Commit: `git commit -m "feat(accident-tracker): description"`
7. Push: `git push && bd sync`
8. Close issue: `bd close <id> --reason "..."`

## License

MIT License — see [LICENSE](../../LICENSE)

## Support

For questions or issues:
- Check [PLAN.md](./PLAN.md) for architecture details
- Review beads: `bd list --json`
- Open GitHub issue in [jordanhubbard/Aviation](https://github.com/jordanhubbard/Aviation)
