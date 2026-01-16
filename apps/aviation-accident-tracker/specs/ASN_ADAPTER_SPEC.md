# ASN Aviation Safety Network Adapter Implementation Spec

**Bead:** [Aviation-gil] Implement ASN data ingestion adapter
**Priority:** P0 - MVP Blocker
**Effort:** 2-3 days
**Dependencies:** 
- Aviation-o2d (airports for geocoding)
- Backend infrastructure (repository, classifier, types)

---

## Overview

Implement data ingestion adapter for the Aviation Safety Network (ASN) database, which provides comprehensive accident and incident data for commercial and general aviation.

### Data Source

**Aviation Safety Network (ASN)**
- URL: https://aviation-safety.net/
- Coverage: Global aviation accidents and incidents (1919-present)
- Categories: Commercial, GA, military, corporate
- Data format: HTML (requires scraping or RSS)
- Update frequency: Real-time (new accidents added daily)
- Cost: Free (public data)

---

## Target Implementation

### File Structure

```
apps/aviation-accident-tracker/backend/src/ingest/
├── asn-adapter.ts              # Main adapter implementation
├── asn-scraper.ts              # HTML scraping utilities
├── asn-parser.ts               # Data parsing and normalization
├── asn-adapter.test.ts         # Unit tests
└── asn-test-data.ts            # Test fixtures
```

---

## Data Source Analysis

### ASN Database Structure

**Latest Accidents Page:**
- URL: `https://aviation-safety.net/database/`
- Recent accidents listed (last 30 days)
- Links to detailed accident pages

**RSS Feeds:**
- Commercial: `https://aviation-safety.net/database/dblist.php?Year=YYYY&lang=&page=1`
- General Aviation: Similar structure
- Updated daily

**Individual Accident Page:**
- URL: `https://aviation-safety.net/database/record.php?id=YYYYMMDD-N`
- Detailed information:
  - Date and time
  - Aircraft type and registration
  - Operator
  - Location (airport codes, coordinates)
  - Phase of flight
  - Fatalities (crew, passengers, ground)
  - Narrative description
  - Investigation status

### Example Accident Record

```
Date: 13-JAN-2026
Time: 14:30 UTC
Type: Boeing 737-800
Registration: N12345
Operator: United Airlines
Location: San Francisco International Airport (KSFO)
Coordinates: 37°37'N 122°22'W
Phase: Landing
Fatalities: 0 (0 crew, 0 passengers, 0 ground)
Damage: Substantial
Narrative: Aircraft experienced hard landing in gusty crosswinds...
Investigation: In progress (NTSB)
```

---

## Implementation Design

### ASN Adapter Interface

```typescript
// apps/aviation-accident-tracker/backend/src/ingest/asn-adapter.ts

import { IngestionAdapter } from './adapter.js';
import { EventRecord } from '../types.js';
import { ASNScraper } from './asn-scraper.js';
import { ASNParser } from './asn-parser.js';
import { logger } from '../logger.js';

export class ASNAdapter implements IngestionAdapter {
  public readonly source = 'ASN';
  private scraper: ASNScraper;
  private parser: ASNParser;

  constructor() {
    this.scraper = new ASNScraper();
    this.parser = new ASNParser();
  }

  /**
   * Fetch recent accidents from ASN
   * @param daysBack - Number of days to look back (default: 30)
   * @returns Array of accident records
   */
  async fetch(daysBack: number = 30): Promise<EventRecord[]> {
    logger.info(`Fetching ASN accidents from last ${daysBack} days`);

    try {
      // 1. Fetch list of recent accidents
      const accidentLinks = await this.scraper.fetchRecentAccidents(daysBack);
      logger.info(`Found ${accidentLinks.length} accident links`);

      // 2. Fetch details for each accident (with rate limiting)
      const events: EventRecord[] = [];
      
      for (const link of accidentLinks) {
        try {
          const html = await this.scraper.fetchAccidentPage(link.url);
          const parsed = this.parser.parseAccidentPage(html, link);
          
          if (parsed) {
            events.push(parsed);
          }
          
          // Rate limiting: 2 seconds between requests
          await this.delay(2000);
        } catch (error) {
          logger.error(`Failed to fetch accident ${link.url}:`, error);
          // Continue with other accidents
        }
      }

      logger.info(`Successfully fetched ${events.length} accidents from ASN`);
      return events;
      
    } catch (error) {
      logger.error('ASN fetch failed:', error);
      throw error;
    }
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
```

---

### ASN Scraper

```typescript
// apps/aviation-accident-tracker/backend/src/ingest/asn-scraper.ts

import * as cheerio from 'cheerio';

export interface AccidentLink {
  id: string;              // ASN accident ID (e.g., "20260113-0")
  url: string;             // Full URL to accident page
  date: string;            // Date from listing (YYYY-MM-DD)
  brief: string;           // Brief description from listing
}

export class ASNScraper {
  private baseUrl = 'https://aviation-safety.net';

  /**
   * Fetch list of recent accidents
   * @param daysBack - Number of days to look back
   * @returns Array of accident links
   */
  async fetchRecentAccidents(daysBack: number = 30): Promise<AccidentLink[]> {
    const links: AccidentLink[] = [];
    const cutoffDate = this.getDateDaysAgo(daysBack);

    // ASN lists accidents by year
    const currentYear = new Date().getUTCFullYear();
    const url = `${this.baseUrl}/database/dblist.php?Year=${currentYear}&lang=&page=1`;

    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`ASN fetch failed: ${response.status}`);
    }

    const html = await response.text();
    const $ = cheerio.load(html);

    // Parse accident table
    $('table.list tr').each((i, row) => {
      if (i === 0) return; // Skip header

      const $row = $(row);
      const date = $row.find('td:nth-child(1)').text().trim();
      const type = $row.find('td:nth-child(2)').text().trim();
      const location = $row.find('td:nth-child(3)').text().trim();
      const link = $row.find('td:nth-child(1) a').attr('href');

      if (!link || !date) return;

      const accidentDate = this.parseASNDate(date);
      if (accidentDate < cutoffDate) return; // Too old

      // Extract accident ID from URL
      const match = link.match(/record\.php\?id=([^&]+)/);
      const id = match ? match[1] : '';

      links.push({
        id,
        url: `${this.baseUrl}${link}`,
        date: accidentDate.toISOString().split('T')[0],
        brief: `${type} - ${location}`
      });
    });

    return links;
  }

  /**
   * Fetch detailed accident page
   * @param url - Full URL to accident page
   * @returns HTML content
   */
  async fetchAccidentPage(url: string): Promise<string> {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to fetch ${url}: ${response.status}`);
    }
    return response.text();
  }

  private parseASNDate(dateStr: string): Date {
    // ASN format: "13-JAN-2026"
    const months: { [key: string]: number } = {
      'JAN': 0, 'FEB': 1, 'MAR': 2, 'APR': 3, 'MAY': 4, 'JUN': 5,
      'JUL': 6, 'AUG': 7, 'SEP': 8, 'OCT': 9, 'NOV': 10, 'DEC': 11
    };

    const parts = dateStr.split('-');
    if (parts.length !== 3) return new Date();

    const day = parseInt(parts[0]);
    const month = months[parts[1]];
    const year = parseInt(parts[2]);

    return new Date(Date.UTC(year, month, day));
  }

  private getDateDaysAgo(days: number): Date {
    const date = new Date();
    date.setUTCDate(date.getUTCDate() - days);
    return date;
  }
}
```

---

### ASN Parser

```typescript
// apps/aviation-accident-tracker/backend/src/ingest/asn-parser.ts

import * as cheerio from 'cheerio';
import { EventRecord } from '../types.js';
import { AccidentLink } from './asn-scraper.js';
import { normalizeToUTC } from './adapter.js';
import { getAirport } from '@aviation/shared-sdk'; // When available

export class ASNParser {
  /**
   * Parse accident detail page
   * @param html - HTML content of accident page
   * @param link - Accident link metadata
   * @returns Parsed event record or null
   */
  parseAccidentPage(html: string, link: AccidentLink): EventRecord | null {
    const $ = cheerio.load(html);

    try {
      // Extract structured data from page
      const data = this.extractData($);

      // Build event record
      const event: EventRecord = {
        external_id: `asn-${link.id}`,
        source: 'ASN',
        date_time: normalizeToUTC(data.date, data.time),
        aircraft_type: data.type || 'Unknown',
        registration: data.registration || '',
        operator: data.operator || '',
        location: data.location || '',
        airport_code: data.airportCode || undefined,
        latitude: data.latitude,
        longitude: data.longitude,
        phase_of_flight: data.phase || undefined,
        fatalities: data.fatalities,
        injuries: data.injuries,
        damage: data.damage,
        description: data.narrative || '',
        investigation_status: data.investigationStatus,
        source_url: link.url,
        raw_data: data
      };

      return event;
    } catch (error) {
      console.error(`Failed to parse accident ${link.id}:`, error);
      return null;
    }
  }

  private extractData($: cheerio.CheerioAPI): any {
    const data: any = {};

    // Extract from structured table
    $('table.frame tr').each((i, row) => {
      const $row = $(row);
      const label = $row.find('td:first-child').text().trim();
      const value = $row.find('td:last-child').text().trim();

      switch (label) {
        case 'Date:':
          data.date = value; // "13-JAN-2026"
          break;
        case 'Time:':
          data.time = value; // "14:30 UTC" or "c. 14:30 LT"
          break;
        case 'Type:':
          data.type = value;
          break;
        case 'Registration:':
          data.registration = value;
          break;
        case 'Operator:':
          data.operator = value;
          break;
        case 'Location:':
          data.location = value;
          this.parseLocation(value, data);
          break;
        case 'Phase:':
          data.phase = value;
          break;
        case 'Fatalities:':
          data.fatalities = this.parseFatalities(value);
          data.injuries = 0; // ASN doesn't separate injuries
          break;
        case 'Damage:':
          data.damage = value;
          break;
        case 'Investigation:':
          data.investigationStatus = value;
          break;
      }
    });

    // Extract narrative
    const narrative = $('.caption:contains("Narrative:")').next('p').text().trim();
    data.narrative = narrative;

    return data;
  }

  private parseLocation(location: string, data: any): void {
    // Extract airport code if present
    // Format: "San Francisco International Airport (KSFO)"
    const codeMatch = location.match(/\(([A-Z]{3,4})\)/);
    if (codeMatch) {
      data.airportCode = codeMatch[1];
    }

    // Extract coordinates if present
    // Format: "37°37'N 122°22'W"
    const coordMatch = location.match(/(\d+)°(\d+)'([NS])\s+(\d+)°(\d+)'([EW])/);
    if (coordMatch) {
      const latDeg = parseInt(coordMatch[1]);
      const latMin = parseInt(coordMatch[2]);
      const latDir = coordMatch[3];
      const lonDeg = parseInt(coordMatch[4]);
      const lonMin = parseInt(coordMatch[5]);
      const lonDir = coordMatch[6];

      data.latitude = (latDeg + latMin / 60) * (latDir === 'N' ? 1 : -1);
      data.longitude = (lonDeg + lonMin / 60) * (lonDir === 'E' ? 1 : -1);
    }
  }

  private parseFatalities(text: string): number {
    // Format: "0 (0 crew, 0 passengers, 0 ground)"
    const match = text.match(/^(\d+)/);
    return match ? parseInt(match[1]) : 0;
  }
}
```

---

## Testing Requirements

### Unit Tests

```typescript
// apps/aviation-accident-tracker/backend/src/ingest/asn-adapter.test.ts

import { ASNAdapter } from './asn-adapter';
import { ASNScraper } from './asn-scraper';
import { ASNParser } from './asn-parser';

describe('ASNAdapter', () => {
  let adapter: ASNAdapter;

  beforeEach(() => {
    adapter = new ASNAdapter();
  });

  describe('fetch', () => {
    test('fetches recent accidents', async () => {
      // Mock scraper responses
      const events = await adapter.fetch(30);
      
      expect(Array.isArray(events)).toBe(true);
      expect(events.length).toBeGreaterThan(0);
    });

    test('handles fetch errors gracefully', async () => {
      // Mock network error
      // Should not throw, just log and return empty array
    });

    test('respects rate limiting', async () => {
      const start = Date.now();
      await adapter.fetch(2); // Fetch 2 accidents
      const elapsed = Date.now() - start;
      
      // Should take at least 2 seconds (rate limit)
      expect(elapsed).toBeGreaterThanOrEqual(2000);
    });
  });
});

describe('ASNScraper', () => {
  let scraper: ASNScraper;

  beforeEach(() => {
    scraper = new ASNScraper();
  });

  test('parses accident listing', async () => {
    const mockHtml = `
      <table class="list">
        <tr><th>Date</th><th>Type</th><th>Location</th></tr>
        <tr>
          <td><a href="/database/record.php?id=20260113-0">13-JAN-2026</a></td>
          <td>Boeing 737-800</td>
          <td>San Francisco, CA</td>
        </tr>
      </table>
    `;

    // Test parsing logic
  });

  test('filters by date', () => {
    // Test date filtering
  });
});

describe('ASNParser', () => {
  let parser: ASNParser;

  beforeEach(() => {
    parser = new ASNParser();
  });

  test('parses complete accident page', () => {
    const mockHtml = `
      <table class="frame">
        <tr><td>Date:</td><td>13-JAN-2026</td></tr>
        <tr><td>Time:</td><td>14:30 UTC</td></tr>
        <tr><td>Type:</td><td>Boeing 737-800</td></tr>
        <tr><td>Registration:</td><td>N12345</td></tr>
        <tr><td>Location:</td><td>San Francisco (KSFO) 37°37'N 122°22'W</td></tr>
        <tr><td>Fatalities:</td><td>0 (0 crew, 0 passengers, 0 ground)</td></tr>
      </table>
      <div class="caption">Narrative:</div>
      <p>Aircraft experienced hard landing...</p>
    `;

    const link = {
      id: '20260113-0',
      url: 'https://aviation-safety.net/database/record.php?id=20260113-0',
      date: '2026-01-13',
      brief: 'Test'
    };

    const event = parser.parseAccidentPage(mockHtml, link);
    
    expect(event).not.toBeNull();
    expect(event?.external_id).toBe('asn-20260113-0');
    expect(event?.aircraft_type).toBe('Boeing 737-800');
    expect(event?.registration).toBe('N12345');
    expect(event?.airport_code).toBe('KSFO');
    expect(event?.latitude).toBeCloseTo(37.617, 1);
    expect(event?.longitude).toBeCloseTo(-122.367, 1);
  });

  test('handles missing coordinates', () => {
    // Test location without coordinates
  });

  test('parses fatalities correctly', () => {
    const result = parser['parseFatalities']('5 (2 crew, 3 passengers, 0 ground)');
    expect(result).toBe(5);
  });

  test('extracts airport code', () => {
    const data = {};
    parser['parseLocation']('San Francisco International (KSFO)', data);
    expect(data.airportCode).toBe('KSFO');
  });
});
```

### Integration Tests

```typescript
// Test with real ASN data (in development only)
describe('ASN Integration', () => {
  test('fetches real accidents (dev only)', async () => {
    if (process.env.NODE_ENV !== 'development') {
      return; // Skip in CI
    }

    const adapter = new ASNAdapter();
    const events = await adapter.fetch(7); // Last week

    expect(events.length).toBeGreaterThan(0);
    
    // Verify structure
    events.forEach(event => {
      expect(event.external_id).toMatch(/^asn-/);
      expect(event.source).toBe('ASN');
      expect(event.date_time).toBeDefined();
      expect(event.aircraft_type).toBeDefined();
    });
  });
});
```

---

## Dependencies

### NPM Packages

```json
{
  "dependencies": {
    "cheerio": "^1.0.0-rc.12"  // HTML parsing
  }
}
```

---

## Error Handling

### Strategies

1. **Network Errors**
   - Retry with exponential backoff
   - Log and continue with other accidents
   - Return partial results

2. **Parse Errors**
   - Skip malformed records
   - Log detailed error with accident ID
   - Continue processing

3. **Rate Limiting**
   - Respect 2-second delay between requests
   - Handle 429 (Too Many Requests)
   - Implement exponential backoff

4. **Missing Data**
   - Provide sensible defaults
   - Mark fields as unknown
   - Don't reject entire record

---

## Performance Considerations

### Optimization

1. **Parallel Fetching**
   - Fetch accident list first
   - Then fetch details in parallel (with rate limit)
   - Use Promise.allSettled() to handle failures

2. **Caching**
   - Cache parsed HTML for development
   - Cache accident list for 1 hour
   - Don't re-fetch already processed accidents

3. **Incremental Updates**
   - Only fetch new accidents (check last run date)
   - Skip accidents already in database
   - Use deduplication logic

---

## Data Quality

### Validation

- [ ] All required fields present
- [ ] Date/time in valid format
- [ ] Coordinates in valid range
- [ ] Airport codes valid (4 letters)
- [ ] Fatalities >= 0

### Normalization

- [ ] UTC timestamps
- [ ] Consistent aircraft type names
- [ ] Standardized location format
- [ ] Trimmed whitespace

---

## Acceptance Criteria

- [ ] ASNAdapter implements IngestionAdapter interface
- [ ] Fetches accidents from last 30 days
- [ ] Parses all key fields correctly
- [ ] Handles errors gracefully
- [ ] Rate limiting implemented (2 sec)
- [ ] Tests passing (>80% coverage)
- [ ] Integration with EventRepository works
- [ ] Deduplication working
- [ ] Classification applied
- [ ] No crashes on malformed data

---

## Timeline

**Day 1:**
- Set up ASNScraper
- Implement HTML fetching
- Basic parsing logic

**Day 2:**
- Complete ASNParser
- Coordinate and location parsing
- Error handling

**Day 3:**
- ASNAdapter integration
- Rate limiting
- Tests and validation
- Integration with repository

---

## Future Enhancements

1. **Advanced Filtering**
   - By aircraft type
   - By operator
   - By location

2. **Historical Data**
   - Backfill older accidents
   - Archive processing

3. **Real-time Updates**
   - RSS feed integration
   - Scheduled polling

4. **Data Enrichment**
   - Link to NTSB reports
   - Link to accident photos
   - Weather data at time of accident

---

**Status:** Ready for implementation
**Dependencies:** Aviation-o2d (airports), Backend infrastructure
**Target Completion:** 2-3 days
