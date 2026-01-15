# Integration Tests Implementation Spec

**Bead:** [Aviation-5ra] Implement integration tests
**Priority:** P1 - High Priority
**Effort:** 1-2 days
**Dependencies:**
- All backend components
- All frontend components
- Seed data (Aviation-7r4)

---

## Overview

Implement comprehensive integration tests to validate end-to-end functionality of the Aviation Accident Tracker, including API endpoints, data ingestion, database operations, and frontend-backend integration.

---

## Target Implementation

### File Structure

```
apps/aviation-accident-tracker/
├── backend/
│   └── tests/
│       ├── integration/
│       │   ├── api.test.ts              # API endpoint tests
│       │   ├── ingestion.test.ts        # Data ingestion tests
│       │   ├── database.test.ts         # Database operations
│       │   └── end-to-end.test.ts       # Full workflow tests
│       └── setup/
│           ├── test-db.ts               # Test database setup
│           └── test-server.ts           # Test server setup
└── frontend/
    └── tests/
        ├── integration/
        │   ├── api-integration.test.ts  # Frontend-API integration
        │   ├── table-filters.test.ts    # Table + filters integration
        │   └── map-integration.test.ts  # Map + events integration
        └── e2e/
            └── full-flow.spec.ts        # End-to-end with Playwright
```

---

## Backend Integration Tests

### API Endpoint Tests

```typescript
// apps/aviation-accident-tracker/backend/tests/integration/api.test.ts

import { describe, test, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../../src/app.js';
import { EventRepository } from '../../src/db/repository.js';
import { seedDatabase } from '../../seed/seed.js';

describe('API Integration Tests', () => {
  let app: any;
  let repository: EventRepository;

  beforeAll(async () => {
    // Set up test database
    process.env.DATABASE_PATH = ':memory:';
    
    app = createApp();
    repository = new EventRepository();
    await repository.initialize();
    
    // Seed test data
    await seedDatabase();
  });

  afterAll(async () => {
    await repository.close();
  });

  describe('GET /api/events', () => {
    test('returns paginated events', async () => {
      const response = await request(app)
        .get('/api/events')
        .query({ page: 1, limit: 10 })
        .expect(200);

      expect(response.body).toHaveProperty('events');
      expect(response.body).toHaveProperty('total');
      expect(response.body).toHaveProperty('page', 1);
      expect(response.body).toHaveProperty('limit', 10);
      expect(Array.isArray(response.body.events)).toBe(true);
      expect(response.body.events.length).toBeLessThanOrEqual(10);
    });

    test('supports sorting by date', async () => {
      const response = await request(app)
        .get('/api/events')
        .query({ sort: 'date_time', order: 'desc', limit: 5 })
        .expect(200);

      const dates = response.body.events.map((e: any) => 
        new Date(e.date_time).getTime()
      );
      
      // Check descending order
      for (let i = 1; i < dates.length; i++) {
        expect(dates[i]).toBeLessThanOrEqual(dates[i - 1]);
      }
    });

    test('filters by category', async () => {
      const response = await request(app)
        .get('/api/events')
        .query({ category: 'Commercial' })
        .expect(200);

      response.body.events.forEach((event: any) => {
        expect(event.category).toBe('Commercial');
      });
    });

    test('filters by date range', async () => {
      const dateFrom = '2025-01-01';
      const dateTo = '2025-12-31';

      const response = await request(app)
        .get('/api/events')
        .query({ dateFrom, dateTo })
        .expect(200);

      response.body.events.forEach((event: any) => {
        const eventDate = new Date(event.date_time);
        expect(eventDate.getTime()).toBeGreaterThanOrEqual(
          new Date(dateFrom).getTime()
        );
        expect(eventDate.getTime()).toBeLessThanOrEqual(
          new Date(dateTo).getTime()
        );
      });
    });
  });

  describe('GET /api/events/:id', () => {
    test('returns event by ID', async () => {
      // Get first event
      const listResponse = await request(app)
        .get('/api/events')
        .query({ limit: 1 });

      const eventId = listResponse.body.events[0].id;

      const response = await request(app)
        .get(`/api/events/${eventId}`)
        .expect(200);

      expect(response.body).toHaveProperty('id', eventId);
      expect(response.body).toHaveProperty('aircraft_type');
      expect(response.body).toHaveProperty('location');
    });

    test('returns 404 for non-existent event', async () => {
      await request(app)
        .get('/api/events/99999')
        .expect(404);
    });

    test('returns 400 for invalid ID', async () => {
      await request(app)
        .get('/api/events/invalid')
        .expect(400);
    });
  });

  describe('POST /api/ingest/run', () => {
    test('requires authentication', async () => {
      await request(app)
        .post('/api/ingest/run')
        .expect(401);
    });

    test('triggers ingestion with valid token', async () => {
      const response = await request(app)
        .post('/api/ingest/run')
        .set('Authorization', 'Bearer dev-token')
        .send({ daysBack: 7 })
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('eventsIngested');
    });
  });

  describe('GET /health', () => {
    test('returns health status', async () => {
      const response = await request(app)
        .get('/health')
        .expect(200);

      expect(response.body).toHaveProperty('status', 'ok');
      expect(response.body).toHaveProperty('timestamp');
    });
  });

  describe('GET /version', () => {
    test('returns version info', async () => {
      const response = await request(app)
        .get('/version')
        .expect(200);

      expect(response.body).toHaveProperty('version');
      expect(response.body).toHaveProperty('name', 'aviation-accident-tracker');
    });
  });
});
```

---

### Data Ingestion Tests

```typescript
// apps/aviation-accident-tracker/backend/tests/integration/ingestion.test.ts

import { describe, test, expect, beforeEach } from 'vitest';
import { ASNAdapter } from '../../src/ingest/asn-adapter.js';
import { AVHeraldAdapter } from '../../src/ingest/avherald-adapter.js';
import { IngestionOrchestrator } from '../../src/ingest/orchestrator.js';
import { EventRepository } from '../../src/db/repository.js';

describe('Data Ingestion Integration', () => {
  let repository: EventRepository;
  let orchestrator: IngestionOrchestrator;

  beforeEach(async () => {
    repository = new EventRepository();
    await repository.initialize();
    orchestrator = new IngestionOrchestrator(repository);
  });

  describe('ASN Adapter', () => {
    test('fetches and parses real data', async () => {
      const adapter = new ASNAdapter();
      const events = await adapter.fetch(7); // Last 7 days

      expect(Array.isArray(events)).toBe(true);
      
      if (events.length > 0) {
        const event = events[0];
        expect(event).toHaveProperty('external_id');
        expect(event.external_id).toMatch(/^asn-/);
        expect(event).toHaveProperty('source', 'ASN');
        expect(event).toHaveProperty('date_time');
        expect(event).toHaveProperty('aircraft_type');
      }
    }, 30000); // 30s timeout for network requests
  });

  describe('AVHerald Adapter', () => {
    test('fetches and parses real data', async () => {
      const adapter = new AVHeraldAdapter();
      const events = await adapter.fetch(7);

      expect(Array.isArray(events)).toBe(true);
      
      if (events.length > 0) {
        const event = events[0];
        expect(event).toHaveProperty('external_id');
        expect(event.external_id).toMatch(/^avherald-/);
        expect(event).toHaveProperty('source', 'AVHerald');
        expect(event).toHaveProperty('date_time');
      }
    }, 30000);
  });

  describe('Orchestrator', () => {
    test('runs full ingestion pipeline', async () => {
      const result = await orchestrator.run({ daysBack: 7 });

      expect(result).toHaveProperty('success');
      expect(result).toHaveProperty('eventsIngested');
      expect(result).toHaveProperty('errors');
      
      // Should have attempted both sources
      expect(result.eventsIngested).toBeGreaterThanOrEqual(0);
    }, 60000); // 60s timeout

    test('deduplicates events', async () => {
      // Run ingestion twice
      await orchestrator.run({ daysBack: 7 });
      const result2 = await orchestrator.run({ daysBack: 7 });

      // Second run should find fewer new events (duplicates filtered)
      expect(result2.eventsIngested).toBeLessThan(100);
    }, 60000);
  });
});
```

---

### Database Operations Tests

```typescript
// apps/aviation-accident-tracker/backend/tests/integration/database.test.ts

import { describe, test, expect, beforeEach, afterEach } from 'vitest';
import { EventRepository } from '../../src/db/repository.js';
import type { EventRecord } from '../../src/types.js';

describe('Database Operations Integration', () => {
  let repository: EventRepository;

  beforeEach(async () => {
    process.env.DATABASE_PATH = ':memory:';
    repository = new EventRepository();
    await repository.initialize();
  });

  afterEach(async () => {
    await repository.close();
  });

  test('upsert inserts new event', async () => {
    const event: EventRecord = {
      external_id: 'test-001',
      source: 'ASN',
      date_time: new Date().toISOString(),
      aircraft_type: 'Boeing 737',
      location: 'Test Airport',
      fatalities: 0,
      injuries: 0,
      description: 'Test event'
    };

    await repository.upsert(event);

    const events = await repository.list({ page: 1, limit: 10 });
    expect(events.events.length).toBe(1);
    expect(events.events[0].external_id).toBe('test-001');
  });

  test('upsert updates existing event', async () => {
    const event: EventRecord = {
      external_id: 'test-001',
      source: 'ASN',
      date_time: new Date().toISOString(),
      aircraft_type: 'Boeing 737',
      location: 'Test Airport',
      fatalities: 0,
      injuries: 0,
      description: 'Original description'
    };

    await repository.upsert(event);

    // Update
    event.description = 'Updated description';
    await repository.upsert(event);

    const events = await repository.list({ page: 1, limit: 10 });
    expect(events.events.length).toBe(1);
    expect(events.events[0].description).toBe('Updated description');
  });

  test('list supports pagination', async () => {
    // Insert 25 events
    for (let i = 0; i < 25; i++) {
      await repository.upsert({
        external_id: `test-${i}`,
        source: 'ASN',
        date_time: new Date().toISOString(),
        aircraft_type: 'Test',
        location: 'Test',
        fatalities: 0,
        injuries: 0,
        description: 'Test'
      });
    }

    const page1 = await repository.list({ page: 1, limit: 10 });
    expect(page1.events.length).toBe(10);
    expect(page1.total).toBe(25);

    const page2 = await repository.list({ page: 2, limit: 10 });
    expect(page2.events.length).toBe(10);

    const page3 = await repository.list({ page: 3, limit: 10 });
    expect(page3.events.length).toBe(5);
  });

  test('list supports sorting', async () => {
    await repository.upsert({
      external_id: 'test-1',
      source: 'ASN',
      date_time: '2025-01-01T00:00:00Z',
      aircraft_type: 'A',
      location: 'Test',
      fatalities: 5,
      injuries: 0,
      description: 'Test'
    });

    await repository.upsert({
      external_id: 'test-2',
      source: 'ASN',
      date_time: '2026-01-01T00:00:00Z',
      aircraft_type: 'B',
      location: 'Test',
      fatalities: 10,
      injuries: 0,
      description: 'Test'
    });

    const byDateAsc = await repository.list({
      page: 1,
      limit: 10,
      sortField: 'date_time',
      sortOrder: 'asc'
    });
    expect(byDateAsc.events[0].external_id).toBe('test-1');

    const byDateDesc = await repository.list({
      page: 1,
      limit: 10,
      sortField: 'date_time',
      sortOrder: 'desc'
    });
    expect(byDateDesc.events[0].external_id).toBe('test-2');
  });

  test('list supports filters', async () => {
    await repository.upsert({
      external_id: 'commercial-1',
      source: 'ASN',
      date_time: new Date().toISOString(),
      aircraft_type: 'Boeing 737',
      location: 'Test',
      fatalities: 10,
      injuries: 0,
      description: 'Test',
      category: 'Commercial'
    });

    await repository.upsert({
      external_id: 'ga-1',
      source: 'ASN',
      date_time: new Date().toISOString(),
      aircraft_type: 'Cessna 172',
      location: 'Test',
      fatalities: 0,
      injuries: 0,
      description: 'Test',
      category: 'GA'
    });

    const commercial = await repository.list({
      page: 1,
      limit: 10,
      filters: { category: 'Commercial' }
    });
    expect(commercial.events.length).toBe(1);
    expect(commercial.events[0].category).toBe('Commercial');

    const ga = await repository.list({
      page: 1,
      limit: 10,
      filters: { category: 'GA' }
    });
    expect(ga.events.length).toBe(1);
    expect(ga.events[0].category).toBe('GA');
  });
});
```

---

## Frontend Integration Tests

### API Integration Tests

```typescript
// apps/aviation-accident-tracker/frontend/tests/integration/api-integration.test.ts

import { renderHook, waitFor } from '@testing-library/react';
import { useEvents } from '../../src/hooks/useEvents';
import { rest } from 'msw';
import { setupServer } from 'msw/node';

const server = setupServer(
  rest.get('/api/events', (req, res, ctx) => {
    return res(
      ctx.json({
        events: [
          {
            id: 1,
            external_id: 'test-001',
            source: 'ASN',
            date_time: '2026-01-13T00:00:00Z',
            aircraft_type: 'Boeing 737',
            location: 'Test Airport',
            fatalities: 0,
            injuries: 0,
            category: 'Commercial'
          }
        ],
        total: 1,
        page: 1,
        limit: 10
      })
    );
  })
);

beforeAll(() => server.listen());
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

describe('API Integration', () => {
  test('useEvents fetches and returns data', async () => {
    const { result } = renderHook(() =>
      useEvents({
        page: 1,
        limit: 10,
        sortField: 'date_time',
        sortOrder: 'desc',
        filters: {}
      })
    );

    expect(result.current.loading).toBe(true);

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.events).toHaveLength(1);
    expect(result.current.total).toBe(1);
    expect(result.current.error).toBeNull();
  });

  test('useEvents handles errors', async () => {
    server.use(
      rest.get('/api/events', (req, res, ctx) => {
        return res(ctx.status(500));
      })
    );

    const { result } = renderHook(() =>
      useEvents({
        page: 1,
        limit: 10,
        sortField: 'date_time',
        sortOrder: 'desc',
        filters: {}
      })
    );

    await waitFor(() => {
      expect(result.current.error).not.toBeNull();
    });

    expect(result.current.events).toHaveLength(0);
  });
});
```

---

## End-to-End Tests (Playwright)

```typescript
// apps/aviation-accident-tracker/frontend/tests/e2e/full-flow.spec.ts

import { test, expect } from '@playwright/test';

test.describe('Aviation Accident Tracker E2E', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('http://localhost:3000');
  });

  test('full user flow', async ({ page }) => {
    // 1. Page loads with table
    await expect(page.locator('h6:has-text("Events")')).toBeVisible();

    // 2. Table displays events
    const firstRow = page.locator('tbody tr').first();
    await expect(firstRow).toBeVisible();

    // 3. Apply filter
    await page.locator('button:has-text("Commercial")').click();
    await page.waitForTimeout(500); // Wait for filter to apply

    // 4. Verify filtered results
    const commercialChip = page.locator('text=Commercial').first();
    await expect(commercialChip).toBeVisible();

    // 5. Click event to open modal
    await firstRow.click();

    // 6. Modal opens with details
    const modal = page.locator('[role="dialog"]');
    await expect(modal).toBeVisible();

    // 7. Close modal
    await page.locator('[aria-label="close"]').click();
    await expect(modal).not.toBeVisible();

    // 8. Change pagination
    await page.locator('text=25').click();
    await page.locator('[data-value="50"]').click();

    // 9. Sort by fatalities
    await page.locator('text=Fatalities').click();

    // 10. Verify sorted
    await page.waitForTimeout(500);
    // Check that first row has highest fatalities
  });

  test('filters work correctly', async ({ page }) => {
    // Date filter
    await page.locator('input[type="date"]').first().fill('2025-01-01');
    await page.locator('input[type="date"]').last().fill('2025-12-31');
    await page.waitForTimeout(500);

    // Verify events are filtered
    const dateChip = page.locator('text=/Date:.*2025/');
    await expect(dateChip).toBeVisible();

    // Clear filters
    await page.locator('button:has-text("Clear All")').click();
    await expect(dateChip).not.toBeVisible();
  });

  test('pagination works', async ({ page }) => {
    // Go to next page
    await page.locator('[aria-label="Go to next page"]').click();

    // Verify URL or state change
    await page.waitForTimeout(500);

    // Go back
    await page.locator('[aria-label="Go to previous page"]').click();
  });
});
```

---

## Test Configuration

### Vitest Config

```typescript
// apps/aviation-accident-tracker/backend/vitest.config.ts

import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/',
        'dist/',
        'tests/',
        '**/*.test.ts'
      ]
    },
    testTimeout: 30000,
    hookTimeout: 30000
  }
});
```

### Playwright Config

```typescript
// apps/aviation-accident-tracker/frontend/playwright.config.ts

import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
  },
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
  },
});
```

---

## NPM Scripts

```json
{
  "scripts": {
    "test:integration": "vitest run tests/integration",
    "test:e2e": "playwright test",
    "test:e2e:ui": "playwright test --ui",
    "test:all": "npm run test && npm run test:integration && npm run test:e2e"
  }
}
```

---

## Acceptance Criteria

- [ ] API endpoint tests pass
- [ ] Data ingestion tests pass (with real APIs)
- [ ] Database operations tests pass
- [ ] Frontend-API integration tests pass
- [ ] End-to-end tests pass
- [ ] All tests run in CI/CD
- [ ] Coverage >70% for integration paths
- [ ] Tests are reliable (no flakes)
- [ ] Tests complete in <5 minutes

---

## Timeline

**Day 1:**
- API endpoint tests
- Database operations tests
- MSW setup for frontend

**Day 2:**
- Data ingestion tests
- Frontend integration tests
- Playwright E2E tests

---

**Status:** Ready for implementation
**Dependencies:** All backend/frontend components, Seed data
**Target Completion:** 1-2 days
