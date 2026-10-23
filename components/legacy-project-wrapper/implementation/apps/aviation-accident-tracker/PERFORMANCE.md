# Aviation Accident Tracker - Performance Guide

> Comprehensive guide for performance testing, monitoring, and optimization

**Last Updated**: 2026-01-14  
**Version**: 1.0.0  
**Part of**: [Aviation Monorepo](../../README.md)

---

## Table of Contents

1. [Performance Targets](#performance-targets)
2. [Load Testing](#load-testing)
3. [Database Optimization](#database-optimization)
4. [API Optimization](#api-optimization)
5. [Frontend Optimization](#frontend-optimization)
6. [Caching Strategy](#caching-strategy)
7. [Monitoring](#monitoring)
8. [Troubleshooting](#troubleshooting)

---

## Performance Targets

### API Response Times

| Endpoint | Target (p95) | Acceptable (p99) | Notes |
|----------|--------------|-------------------|-------|
| **GET /api/events** (list) | <200ms | <300ms | Paginated (50 items) |
| **GET /api/events/:id** (detail) | <100ms | <200ms | Single event lookup |
| **GET /api/events?filter=...** | <300ms | <500ms | Filtered queries |
| **GET /api/events?search=...** | <500ms | <1000ms | Text search |
| **GET /api/health** | <50ms | <100ms | Health check |

### Frontend Performance

| Metric | Target | Notes |
|--------|--------|-------|
| **First Contentful Paint (FCP)** | <1.5s | Time to first content |
| **Largest Contentful Paint (LCP)** | <2.5s | Time to main content |
| **Time to Interactive (TTI)** | <3.5s | Time to fully interactive |
| **Cumulative Layout Shift (CLS)** | <0.1 | Visual stability |
| **Bundle Size (gzipped)** | <500KB | Total JavaScript |
| **Map Load Time** | <1s | With 1000 events |

### Database Performance

| Metric | Target | Notes |
|--------|--------|-------|
| **Query Execution Time** | <50ms | Most queries |
| **Index Lookups** | <10ms | Primary key lookups |
| **Database Size** | <5GB | With 200K events |

### Throughput

| Metric | Target | Notes |
|--------|--------|-------|
| **Requests/second** | >100 | Sustained load |
| **Concurrent Users** | >50 | Simultaneous users |
| **Error Rate** | <1% | Failed requests |

---

## Load Testing

### Prerequisites

Install k6 (load testing tool):

```bash
# macOS
brew install k6

# Linux
sudo gpg -k
sudo gpg --no-default-keyring --keyring /usr/share/keyrings/k6-archive-keyring.gpg --keyserver hkp://keyserver.ubuntu.com:80 --recv-keys C5AD17C747E3415A3642D57D77C6C491D6AC1D69
echo "deb [signed-by=/usr/share/keyrings/k6-archive-keyring.gpg] https://dl.k6.io/deb stable main" | sudo tee /etc/apt/sources.list.d/k6.list
sudo apt-get update
sudo apt-get install k6

# Windows
choco install k6

# Docker
docker pull grafana/k6
```

### Running Load Tests

#### Quick Test (10 VUs, 30 seconds)

```bash
cd apps/aviation-accident-tracker/backend

# Test local development server
k6 run --vus 10 --duration 30s load-tests/scenarios.js

# Test specific endpoint
export BASE_URL=http://localhost:8080
k6 run load-tests/scenarios.js
```

#### Constant Load Test

```bash
# 50 virtual users for 5 minutes
k6 run --vus 50 --duration 5m load-tests/scenarios.js
```

#### Ramp-Up Test

```bash
# Gradually increase load
k6 run --stage 30s:10 --stage 1m:50 --stage 1m:100 --stage 30s:0 load-tests/scenarios.js
```

#### Spike Test

```bash
# Sudden spike in traffic
k6 run --stage 10s:10 --stage 10s:200 --stage 10s:10 load-tests/scenarios.js
```

#### Stress Test

```bash
# Find breaking point
k6 run --stage 1m:50 --stage 2m:100 --stage 2m:150 --stage 2m:200 --stage 1m:0 load-tests/scenarios.js
```

### Analyzing Results

#### Console Output

```
✓ list: status is 200
✓ list: has events array  
✓ list: response time < 200ms

http_req_duration..............: avg=145ms min=45ms med=120ms max=450ms p(95)=280ms p(99)=380ms
http_req_failed................: 0.50%
http_reqs......................: 15000 (50/s)
vus............................: 10
vus_max........................: 50
```

#### JSON Report

```bash
# Generate JSON report
k6 run --out json=results.json load-tests/scenarios.js

# View results
jq '.metrics.http_req_duration.values' results.json
```

#### HTML Report

```bash
# Generate HTML report (using k6-reporter)
k6 run --out json=results.json load-tests/scenarios.js
k6-reporter results.json --output report.html
```

### Performance Baseline

**Baseline metrics** (on development machine, local SQLite):

| Metric | Value |
|--------|-------|
| **List endpoint (p95)** | 85ms |
| **Detail endpoint (p95)** | 35ms |
| **Filter endpoint (p95)** | 150ms |
| **Requests/sec** | 120 |
| **Error rate** | 0.2% |

**Production targets** (should be better with optimizations):

- List: <200ms p95
- Detail: <100ms p95
- Filter: <300ms p95
- Requests/sec: >100
- Error rate: <1%

---

## Database Optimization

### Running Optimization Script

```bash
cd apps/aviation-accident-tracker/backend

# Run optimization script
sqlite3 data/accidents.db < scripts/optimize-database.sql

# Expected output:
# ✓ Created 8 indexes
# ✓ Enabled WAL mode
# ✓ Optimized cache settings
# ✓ Vacuumed database
# ✓ Analyzed statistics
```

### Index Strategy

#### Created Indexes

1. **idx_events_date_z** - Date descending (most common sort)
2. **idx_events_category** - Category filter (GA/Commercial)
3. **idx_events_country** - Country filter
4. **idx_events_registration** - Registration lookup
5. **idx_events_airport** - Airport filter
6. **idx_events_date_category** - Composite (date + category)
7. **idx_events_country_date** - Composite (country + date)
8. **idx_events_narrative_lower** - Text search (case-insensitive)

#### Index Effectiveness

Check if indexes are being used:

```bash
sqlite3 data/accidents.db

sqlite> EXPLAIN QUERY PLAN 
        SELECT * FROM events 
        WHERE date_z >= '2024-01-01' 
        ORDER BY date_z DESC 
        LIMIT 50;

# Expected output:
# SEARCH events USING INDEX idx_events_date_z (date_z>?)
```

### Query Optimization

#### Analyze Slow Queries

```sql
-- Enable query timer
.timer on

-- Run query
SELECT * FROM events WHERE country = 'USA' ORDER BY date_z DESC LIMIT 50;

-- View query plan
EXPLAIN QUERY PLAN SELECT * FROM events WHERE country = 'USA' ORDER BY date_z DESC LIMIT 50;
```

#### Optimize Common Patterns

**Bad**: Full table scan
```sql
SELECT * FROM events WHERE LOWER(narrative) LIKE '%engine%';
```

**Better**: Use index
```sql
SELECT * FROM events WHERE LOWER(narrative) LIKE 'engine%';  -- Uses index for prefix
```

**Best**: Use FTS5 for full-text search
```sql
-- Create FTS5 virtual table
CREATE VIRTUAL TABLE events_fts USING fts5(narrative, content=events, content_rowid=id);

-- Search
SELECT * FROM events_fts WHERE events_fts MATCH 'engine failure';
```

### Database Maintenance

#### Weekly Maintenance

```bash
# Update statistics
sqlite3 data/accidents.db "ANALYZE;"
```

#### Monthly Maintenance

```bash
# Reclaim space and defragment
sqlite3 data/accidents.db "VACUUM;"
```

#### Check Database Health

```bash
# Integrity check
sqlite3 data/accidents.db "PRAGMA integrity_check;"

# Quick check
sqlite3 data/accidents.db "PRAGMA quick_check;"
```

---

## API Optimization

### Response Caching

#### In-Memory Cache Implementation

```typescript
// backend/src/cache/memory-cache.ts
import NodeCache from 'node-cache';

class MemoryCache {
  private cache: NodeCache;
  
  constructor() {
    this.cache = new NodeCache({
      stdTTL: 300,           // 5 minutes default
      checkperiod: 60,        // Check for expired keys every 60s
      useClones: false,       // Don't clone objects (faster)
      maxKeys: 1000           // Max 1000 keys
    });
  }
  
  get<T>(key: string): T | undefined {
    return this.cache.get(key);
  }
  
  set<T>(key: string, value: T, ttl?: number): void {
    this.cache.set(key, value, ttl || 300);
  }
  
  del(key: string): void {
    this.cache.del(key);
  }
  
  flush(): void {
    this.cache.flushAll();
  }
  
  getStats() {
    return this.cache.getStats();
  }
}

export const cache = new MemoryCache();
```

#### Using Cache in API Routes

```typescript
// backend/src/api/events.ts
import { cache } from '../cache/memory-cache';

router.get('/events', async (req, res) => {
  const { page = 1, pageSize = 50, category, country } = req.query;
  
  // Generate cache key
  const cacheKey = `events:${page}:${pageSize}:${category}:${country}`;
  
  // Check cache
  const cached = cache.get(cacheKey);
  if (cached) {
    res.setHeader('X-Cache', 'HIT');
    return res.json(cached);
  }
  
  // Query database
  const events = await repository.getEvents({ page, pageSize, category, country });
  
  // Cache result (5 minutes)
  cache.set(cacheKey, events, 300);
  
  res.setHeader('X-Cache', 'MISS');
  res.json(events);
});
```

### Response Compression

Enable gzip compression for all responses:

```typescript
// backend/src/app.ts
import compression from 'compression';

app.use(compression({
  level: 6,              // Compression level (0-9)
  threshold: 1024,       // Only compress responses > 1KB
  filter: (req, res) => {
    if (req.headers['x-no-compression']) {
      return false;
    }
    return compression.filter(req, res);
  }
}));
```

### Rate Limiting

Implemented rate limiting to prevent abuse:

```typescript
// backend/src/middleware/rate-limit.ts
import rateLimit from 'express-rate-limit';

export const apiLimiter = rateLimit({
  windowMs: 60 * 1000,   // 1 minute
  max: 100,              // 100 requests per minute
  message: 'Too many requests, please try again later',
  standardHeaders: true,
  legacyHeaders: false,
});

// Apply to all API routes
app.use('/api/', apiLimiter);
```

### Pagination Best Practices

Always use LIMIT and OFFSET for pagination:

```typescript
// Good: Paginated query
const events = await db.all(
  'SELECT * FROM events ORDER BY date_z DESC LIMIT ? OFFSET ?',
  [pageSize, (page - 1) * pageSize]
);

// Bad: Loading all results
const events = await db.all('SELECT * FROM events');
```

### Connection Pooling

For production, use connection pooling:

```typescript
// backend/src/db/connection-pool.ts
import { Pool } from 'generic-pool';
import sqlite3 from 'sqlite3';

const pool = new Pool({
  create: () => {
    return new Promise((resolve, reject) => {
      const db = new sqlite3.Database('./data/accidents.db', (err) => {
        if (err) reject(err);
        else resolve(db);
      });
    });
  },
  destroy: (db) => {
    return new Promise((resolve) => {
      db.close(() => resolve());
    });
  },
  max: 10,      // Max 10 connections
  min: 2,       // Min 2 connections
});
```

---

## Frontend Optimization

### Bundle Size Analysis

Analyze bundle size:

```bash
cd frontend

# Build with analysis
npm run build -- --analyze

# Or use webpack-bundle-analyzer
npm install --save-dev webpack-bundle-analyzer
```

**Current bundle sizes**:
- Main bundle: ~250KB gzipped
- Vendor bundle: ~180KB gzipped
- Total: ~430KB gzipped ✓ (under 500KB target)

### Code Splitting

Split code by route for lazy loading:

```typescript
// frontend/src/App.tsx
import { lazy, Suspense } from 'react';

const MapView = lazy(() => import('./components/MapView'));
const TableView = lazy(() => import('./components/TableView'));
const DetailModal = lazy(() => import('./components/DetailModal'));

function App() {
  return (
    <Suspense fallback={<LoadingSpinner />}>
      <Routes>
        <Route path="/" element={<MapView />} />
        <Route path="/table" element={<TableView />} />
        <Route path="/detail/:id" element={<DetailModal />} />
      </Routes>
    </Suspense>
  );
}
```

### Map Performance

#### Clustering

Use marker clustering for large datasets:

```typescript
// frontend/src/components/MapView.tsx
import MarkerClusterGroup from 'react-leaflet-cluster';

<MapContainer>
  <MarkerClusterGroup
    chunkedLoading
    maxClusterRadius={50}
    spiderfyOnMaxZoom={true}
    showCoverageOnHover={false}
  >
    {events.map(event => (
      <Marker key={event.id} position={[event.lat, event.lon]} />
    ))}
  </MarkerClusterGroup>
</MapContainer>
```

#### Virtual Scrolling

Use virtual scrolling for large lists:

```bash
npm install react-window
```

```typescript
// frontend/src/components/EventTable.tsx
import { FixedSizeList } from 'react-window';

<FixedSizeList
  height={600}
  itemCount={events.length}
  itemSize={50}
  width="100%"
>
  {({ index, style }) => (
    <div style={style}>
      <EventRow event={events[index]} />
    </div>
  )}
</FixedSizeList>
```

### Image Optimization

Optimize images:

```bash
# Install optimization tools
npm install --save-dev imagemin imagemin-webp

# Convert to WebP
imagemin images/*.png --out-dir=images/optimized --plugin=webp
```

Use responsive images:

```html
<picture>
  <source srcset="image.webp" type="image/webp">
  <source srcset="image.png" type="image/png">
  <img src="image.png" alt="..." loading="lazy">
</picture>
```

---

## Caching Strategy

### Cache Layers

```
┌─────────────────────────────────────┐
│   Browser Cache                     │
│   - Static assets (24h)             │
│   - Service Worker cache            │
└─────────────────────────────────────┘
              ↓
┌─────────────────────────────────────┐
│   CDN Cache (if deployed)           │
│   - HTML, CSS, JS (1h)              │
│   - API responses (5m)              │
└─────────────────────────────────────┘
              ↓
┌─────────────────────────────────────┐
│   Application Cache (Node.js)       │
│   - API responses (5m)              │
│   - Query results (10m)             │
└─────────────────────────────────────┘
              ↓
┌─────────────────────────────────────┐
│   Database (SQLite)                 │
│   - Persistent storage              │
└─────────────────────────────────────┘
```

### Cache Invalidation

Invalidate cache when data changes:

```typescript
// After ingestion or data update
cache.flush();  // Clear all cache
// or
cache.del('events:*');  // Clear specific pattern
```

### HTTP Cache Headers

Set appropriate cache headers:

```typescript
// Static assets (1 year)
app.use('/static', express.static('public', {
  maxAge: '1y',
  immutable: true
}));

// API responses (5 minutes)
app.get('/api/events', (req, res) => {
  res.set('Cache-Control', 'public, max-age=300');
  // ...
});

// Health check (no cache)
app.get('/api/health', (req, res) => {
  res.set('Cache-Control', 'no-cache, no-store, must-revalidate');
  // ...
});
```

---

## Monitoring

### Metrics to Track

1. **Request Metrics**:
   - Request rate (req/s)
   - Response time (p50, p95, p99)
   - Error rate (%)
   - Endpoint-specific metrics

2. **Database Metrics**:
   - Query execution time
   - Database size
   - Index usage
   - Cache hit rate

3. **System Metrics**:
   - CPU usage
   - Memory usage
   - Disk I/O
   - Network I/O

### Prometheus Integration

Export metrics for Prometheus:

```typescript
// backend/src/metrics/prometheus.ts
import { register, Counter, Histogram } from 'prom-client';

export const httpRequestCounter = new Counter({
  name: 'http_requests_total',
  help: 'Total HTTP requests',
  labelNames: ['method', 'endpoint', 'status']
});

export const httpRequestDuration = new Histogram({
  name: 'http_request_duration_seconds',
  help: 'HTTP request duration',
  labelNames: ['method', 'endpoint'],
  buckets: [0.01, 0.05, 0.1, 0.2, 0.5, 1, 2, 5]
});

// Expose metrics endpoint
app.get('/api/metrics', (req, res) => {
  res.set('Content-Type', register.contentType);
  res.end(register.metrics());
});
```

### Application Performance Monitoring (APM)

Integrate APM tools:

- **New Relic**: `npm install newrelic`
- **Datadog**: `npm install dd-trace`
- **Elastic APM**: `npm install elastic-apm-node`

---

## Troubleshooting

### Slow API Responses

**Symptom**: API requests taking >500ms

**Diagnostic**:
```bash
# Enable query logging
sqlite3 data/accidents.db
sqlite> .timer on
sqlite> SELECT * FROM events LIMIT 50;
```

**Solutions**:
- Check if indexes are being used (EXPLAIN QUERY PLAN)
- Run ANALYZE to update statistics
- Enable caching for frequently accessed data
- Reduce page size if returning too much data

### High Memory Usage

**Symptom**: Node.js process using >1GB RAM

**Diagnostic**:
```bash
# Check heap size
node --expose-gc --max-old-space-size=512 dist/index.js

# Profile memory
node --inspect dist/index.js
# Open chrome://inspect
```

**Solutions**:
- Enable garbage collection
- Reduce cache size
- Limit concurrent connections
- Use streaming for large responses

### Database Locks

**Symptom**: SQLITE_BUSY errors

**Solutions**:
- Enable WAL mode: `PRAGMA journal_mode=WAL;`
- Increase busy timeout: `PRAGMA busy_timeout=5000;`
- Reduce write concurrency
- Consider PostgreSQL for high write loads

---

## Performance Checklist

### Pre-Deployment

- [ ] Run load tests with expected traffic
- [ ] Optimize database (indexes + VACUUM + ANALYZE)
- [ ] Enable response compression
- [ ] Implement caching strategy
- [ ] Set up monitoring and alerts
- [ ] Review and optimize slow queries
- [ ] Optimize frontend bundle size
- [ ] Enable CDN for static assets
- [ ] Configure rate limiting
- [ ] Test with production-like data volume

### Post-Deployment

- [ ] Monitor p95/p99 response times
- [ ] Track error rates
- [ ] Monitor database size growth
- [ ] Check cache hit rates
- [ ] Review slow query logs
- [ ] Analyze user behavior patterns
- [ ] Optimize based on real usage
- [ ] Schedule regular maintenance (VACUUM/ANALYZE)

---

**Document Version**: 1.0.0  
**Last Updated**: 2026-01-14  
**Maintainer**: Aviation Team
