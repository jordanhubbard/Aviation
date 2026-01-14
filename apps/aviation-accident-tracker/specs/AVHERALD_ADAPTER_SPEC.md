# AVHerald Adapter Implementation Spec

**Bead:** [Aviation-82s] Implement AVHerald data ingestion adapter
**Priority:** P0 - MVP Blocker
**Effort:** 2 days
**Dependencies:**
- Aviation-o2d (airports for geocoding)
- Backend infrastructure (repository, classifier, types)

---

## Overview

Implement data ingestion adapter for The Aviation Herald (AVHerald), which provides real-time aviation incident and accident news with detailed technical analysis.

### Data Source

**The Aviation Herald (AVHerald)**
- URL: https://avherald.com/
- Coverage: Global aviation incidents and accidents (2006-present)
- Focus: Technical incidents, serious events, notable occurrences
- Data format: HTML articles with structured metadata
- Update frequency: Real-time (multiple updates daily)
- Cost: Free (public data)
- Unique Features:
  - Detailed technical analysis
  - Follow-up updates
  - Investigation progress tracking
  - Expert commentary

---

## Target Implementation

### File Structure

```
apps/aviation-accident-tracker/backend/src/ingest/
├── avherald-adapter.ts         # Main adapter implementation
├── avherald-scraper.ts         # HTML scraping utilities
├── avherald-parser.ts          # Data parsing and normalization
├── avherald-adapter.test.ts   # Unit tests
└── avherald-test-data.ts      # Test fixtures
```

---

## Data Source Analysis

### AVHerald Structure

**Latest News Page:**
- URL: `https://avherald.com/h?list&opt=0`
- Recent incidents listed (chronological)
- Each entry has:
  - Headline
  - Date
  - Aircraft type and registration
  - Location
  - Brief summary
  - Link to full article

**RSS Feed:**
- URL: `https://avherald.com/rss/main_en.xml`
- Real-time updates
- Easier to parse than HTML

**Individual Article:**
- URL: `https://avherald.com/h?article=XXXXXXXX`
- Detailed information:
  - Incident date and time
  - Aircraft details
  - Location and airport
  - Event description
  - Technical analysis
  - Updates and follow-ups
  - Investigation status

### Example Article

```
Incident: United B738 at San Francisco on Jan 13th 2026, hard landing

An United Airlines Boeing 737-800, registration N12345 performing 
flight UA-123 from Chicago,IL to San Francisco,CA (USA), landed on 
San Francisco's runway 28R at about 14:30L (22:30Z) but touched 
down hard prompting a go around. The aircraft positioned for another 
approach to runway 28R and landed safely about 20 minutes later.

The FAA reported the aircraft experienced a hard landing in gusty 
crosswind conditions. The crew executed a go-around and made a 
successful second approach. Post-flight inspection revealed minor 
damage to the landing gear.

Aircraft: Boeing 737-800
Registration: N12345
Flight: UA-123
Route: KORD-KSFO
Location: San Francisco International Airport
Date: January 13th 2026
Time: 22:30Z
Status: Under investigation by FAA
```

---

## Implementation Design

### AVHerald Adapter Interface

```typescript
// apps/aviation-accident-tracker/backend/src/ingest/avherald-adapter.ts

import { IngestionAdapter } from './adapter.js';
import { EventRecord } from '../types.js';
import { AVHeraldScraper } from './avherald-scraper.js';
import { AVHeraldParser } from './avherald-parser.js';
import { logger } from '../logger.js';

export class AVHeraldAdapter implements IngestionAdapter {
  public readonly source = 'AVHerald';
  private scraper: AVHeraldScraper;
  private parser: AVHeraldParser;

  constructor() {
    this.scraper = new AVHeraldScraper();
    this.parser = new AVHeraldParser();
  }

  /**
   * Fetch recent incidents from AVHerald
   * @param daysBack - Number of days to look back (default: 30)
   * @returns Array of incident records
   */
  async fetch(daysBack: number = 30): Promise<EventRecord[]> {
    logger.info(`Fetching AVHerald incidents from last ${daysBack} days`);

    try {
      // Option 1: Use RSS feed (preferred)
      const articles = await this.scraper.fetchRecentArticlesFromRSS(daysBack);
      logger.info(`Found ${articles.length} articles from RSS`);

      // Option 2: Scrape HTML (fallback)
      // const articles = await this.scraper.fetchRecentArticlesFromHTML(daysBack);

      // Fetch full article content for each (with rate limiting)
      const events: EventRecord[] = [];
      
      for (const article of articles) {
        try {
          const html = await this.scraper.fetchArticlePage(article.url);
          const parsed = this.parser.parseArticle(html, article);
          
          if (parsed) {
            events.push(parsed);
          }
          
          // Rate limiting: 3 seconds between requests (be respectful)
          await this.delay(3000);
        } catch (error) {
          logger.error(`Failed to fetch article ${article.url}:`, error);
          // Continue with other articles
        }
      }

      logger.info(`Successfully fetched ${events.length} incidents from AVHerald`);
      return events;
      
    } catch (error) {
      logger.error('AVHerald fetch failed:', error);
      throw error;
    }
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
```

---

### AVHerald Scraper

```typescript
// apps/aviation-accident-tracker/backend/src/ingest/avherald-scraper.ts

import * as cheerio from 'cheerio';
import { XMLParser } from 'fast-xml-parser';

export interface ArticleLink {
  id: string;              // Article ID (e.g., "4f2a8c9d")
  url: string;             // Full URL to article
  date: string;            // Publication date (ISO 8601)
  headline: string;        // Article headline
  summary: string;         // Brief summary from listing
}

export class AVHeraldScraper {
  private baseUrl = 'https://avherald.com';
  private rssUrl = 'https://avherald.com/rss/main_en.xml';

  /**
   * Fetch recent articles from RSS feed (preferred method)
   * @param daysBack - Number of days to look back
   * @returns Array of article links
   */
  async fetchRecentArticlesFromRSS(daysBack: number = 30): Promise<ArticleLink[]> {
    const articles: ArticleLink[] = [];
    const cutoffDate = this.getDateDaysAgo(daysBack);

    try {
      const response = await fetch(this.rssUrl);
      if (!response.ok) {
        throw new Error(`RSS fetch failed: ${response.status}`);
      }

      const xml = await response.text();
      const parser = new XMLParser();
      const rss = parser.parse(xml);

      const items = rss.rss?.channel?.item || [];
      
      for (const item of items) {
        const pubDate = new Date(item.pubDate);
        if (pubDate < cutoffDate) continue; // Too old

        // Extract article ID from link
        const link = item.link;
        const match = link.match(/article=([a-f0-9]+)/);
        const id = match ? match[1] : '';

        articles.push({
          id,
          url: link,
          date: pubDate.toISOString(),
          headline: item.title || '',
          summary: item.description || ''
        });
      }

      return articles;
    } catch (error) {
      console.error('RSS fetch failed, falling back to HTML:', error);
      // Fallback to HTML scraping
      return this.fetchRecentArticlesFromHTML(daysBack);
    }
  }

  /**
   * Fetch recent articles from HTML listing (fallback method)
   * @param daysBack - Number of days to look back
   * @returns Array of article links
   */
  async fetchRecentArticlesFromHTML(daysBack: number = 30): Promise<ArticleLink[]> {
    const articles: ArticleLink[] = [];
    const cutoffDate = this.getDateDaysAgo(daysBack);

    const url = `${this.baseUrl}/h?list&opt=0`;
    const response = await fetch(url);
    
    if (!response.ok) {
      throw new Error(`AVHerald fetch failed: ${response.status}`);
    }

    const html = await response.text();
    const $ = cheerio.load(html);

    // Parse article listings
    $('.atitle').each((i, elem) => {
      const $elem = $(elem);
      const link = $elem.find('a').attr('href');
      const headline = $elem.find('a').text().trim();
      
      if (!link || !headline) return;

      // Extract date from article text (format: "Jan 13th 2026")
      const dateText = $elem.parent().text();
      const articleDate = this.parseAVHeraldDate(dateText);
      
      if (articleDate < cutoffDate) return; // Too old

      // Extract article ID
      const match = link.match(/article=([a-f0-9]+)/);
      const id = match ? match[1] : '';

      articles.push({
        id,
        url: `${this.baseUrl}${link}`,
        date: articleDate.toISOString(),
        headline,
        summary: ''
      });
    });

    return articles;
  }

  /**
   * Fetch full article page
   * @param url - Full URL to article
   * @returns HTML content
   */
  async fetchArticlePage(url: string): Promise<string> {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to fetch ${url}: ${response.status}`);
    }
    return response.text();
  }

  private parseAVHeraldDate(text: string): Date {
    // AVHerald format: "Jan 13th 2026" or "January 13th 2026"
    const months: { [key: string]: number } = {
      'Jan': 0, 'January': 0,
      'Feb': 1, 'February': 1,
      'Mar': 2, 'March': 2,
      'Apr': 3, 'April': 3,
      'May': 4,
      'Jun': 5, 'June': 5,
      'Jul': 6, 'July': 6,
      'Aug': 7, 'August': 7,
      'Sep': 8, 'September': 8,
      'Oct': 9, 'October': 9,
      'Nov': 10, 'November': 10,
      'Dec': 11, 'December': 11
    };

    // Match "Jan 13th 2026" or "January 13th 2026"
    const match = text.match(/(Jan|January|Feb|February|Mar|March|Apr|April|May|Jun|June|Jul|July|Aug|August|Sep|September|Oct|October|Nov|November|Dec|December)\s+(\d+)(?:st|nd|rd|th)?\s+(\d{4})/i);
    
    if (!match) return new Date();

    const month = months[match[1]];
    const day = parseInt(match[2]);
    const year = parseInt(match[3]);

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

### AVHerald Parser

```typescript
// apps/aviation-accident-tracker/backend/src/ingest/avherald-parser.ts

import * as cheerio from 'cheerio';
import { EventRecord } from '../types.js';
import { ArticleLink } from './avherald-scraper.js';
import { normalizeToUTC } from './adapter.js';

export class AVHeraldParser {
  /**
   * Parse AVHerald article
   * @param html - HTML content of article
   * @param article - Article metadata
   * @returns Parsed event record or null
   */
  parseArticle(html: string, article: ArticleLink): EventRecord | null {
    const $ = cheerio.load(html);

    try {
      // Extract article content
      const content = $('.hcontent').text();
      
      // Extract structured data from headline and content
      const data = this.extractData(article.headline, content);

      // Build event record
      const event: EventRecord = {
        external_id: `avherald-${article.id}`,
        source: 'AVHerald',
        date_time: normalizeToUTC(data.date, data.time),
        aircraft_type: data.type || 'Unknown',
        registration: data.registration || '',
        operator: data.operator || '',
        flight_number: data.flightNumber || undefined,
        route: data.route || undefined,
        location: data.location || '',
        airport_code: data.airportCode || undefined,
        latitude: data.latitude,
        longitude: data.longitude,
        phase_of_flight: data.phase || undefined,
        fatalities: data.fatalities || 0,
        injuries: data.injuries || 0,
        damage: data.damage,
        description: this.cleanDescription(content),
        investigation_status: data.investigationStatus,
        source_url: article.url,
        raw_data: {
          headline: article.headline,
          summary: article.summary,
          ...data
        }
      };

      return event;
    } catch (error) {
      console.error(`Failed to parse article ${article.id}:`, error);
      return null;
    }
  }

  private extractData(headline: string, content: string): any {
    const data: any = {};

    // Parse headline (format: "Incident: United B738 at San Francisco on Jan 13th 2026, hard landing")
    const headlineParts = headline.match(/(Accident|Incident|Serious Incident):\s+(.+?)\s+(at|near)\s+(.+?)\s+on\s+(.+?),\s+(.+)/);
    
    if (headlineParts) {
      data.eventType = headlineParts[1]; // Accident/Incident
      data.aircraftInfo = headlineParts[2]; // "United B738"
      data.location = headlineParts[4]; // "San Francisco"
      data.date = headlineParts[5]; // "Jan 13th 2026"
      data.description = headlineParts[6]; // "hard landing"
    }

    // Extract aircraft type and operator from headline
    this.parseAircraftInfo(data.aircraftInfo || '', data);

    // Extract structured data from content
    this.extractFromContent(content, data);

    return data;
  }

  private parseAircraftInfo(info: string, data: any): void {
    // Format: "United B738" or "Delta A320" or "N12345 B738"
    
    // Try to extract operator (airline name)
    const operatorMatch = info.match(/^([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)/);
    if (operatorMatch) {
      data.operator = operatorMatch[1];
    }

    // Try to extract aircraft type code
    const typeMatch = info.match(/([AB]\d{3,4}[A-Z]*|B\d{3}|MD\d{2}|CRJ\d{3}|E\d{3})/);
    if (typeMatch) {
      data.type = this.expandAircraftType(typeMatch[1]);
    }

    // Try to extract registration
    const regMatch = info.match(/([A-Z]{1,2}-[A-Z]{3,5}|N\d{1,5}[A-Z]{0,2})/);
    if (regMatch) {
      data.registration = regMatch[1];
    }
  }

  private extractFromContent(content: string, data: any): void {
    // Extract registration if not found in headline
    if (!data.registration) {
      const regMatch = content.match(/registration\s+([A-Z]{1,2}-[A-Z]{3,5}|N\d{1,5}[A-Z]{0,2})/i);
      if (regMatch) {
        data.registration = regMatch[1];
      }
    }

    // Extract flight number
    const flightMatch = content.match(/flight\s+([A-Z]{2,3})-?(\d{1,4})/i);
    if (flightMatch) {
      data.flightNumber = `${flightMatch[1]}${flightMatch[2]}`;
    }

    // Extract route
    const routeMatch = content.match(/from\s+([A-Z][a-z]+(?:,\s*[A-Z]{2})?)\s+to\s+([A-Z][a-z]+(?:,\s*[A-Z]{2})?)/i);
    if (routeMatch) {
      data.route = `${routeMatch[1]} to ${routeMatch[2]}`;
    }

    // Extract airport code
    const airportMatch = content.match(/\b([A-Z]{4})\b/);
    if (airportMatch) {
      data.airportCode = airportMatch[1];
    }

    // Extract time (format: "14:30L" or "22:30Z")
    const timeMatch = content.match(/(\d{1,2}):(\d{2})([LZ])/);
    if (timeMatch) {
      data.time = `${timeMatch[1]}:${timeMatch[2]} ${timeMatch[3] === 'Z' ? 'UTC' : 'local'}`;
    }

    // Extract investigation status
    const invMatch = content.match(/(?:under investigation by|investigating|investigated by)\s+([A-Z]{3,})/i);
    if (invMatch) {
      data.investigationStatus = `Under investigation by ${invMatch[1]}`;
    }

    // Extract damage assessment
    if (content.includes('substantial damage') || content.includes('damaged beyond repair')) {
      data.damage = 'Substantial';
    } else if (content.includes('minor damage')) {
      data.damage = 'Minor';
    }

    // Extract fatalities/injuries
    const fatalMatch = content.match(/(\d+)\s+(?:fatalities|killed|deaths)/i);
    if (fatalMatch) {
      data.fatalities = parseInt(fatalMatch[1]);
    }

    const injuryMatch = content.match(/(\d+)\s+(?:injuries|injured)/i);
    if (injuryMatch) {
      data.injuries = parseInt(injuryMatch[1]);
    }
  }

  private expandAircraftType(code: string): string {
    const types: { [key: string]: string } = {
      'B738': 'Boeing 737-800',
      'B737': 'Boeing 737',
      'B744': 'Boeing 747-400',
      'B77W': 'Boeing 777-300ER',
      'B787': 'Boeing 787',
      'A320': 'Airbus A320',
      'A321': 'Airbus A321',
      'A359': 'Airbus A350-900',
      'A388': 'Airbus A380-800',
      'MD11': 'McDonnell Douglas MD-11',
      'CRJ9': 'Canadair CRJ-900',
      'E190': 'Embraer E190'
    };

    return types[code] || code;
  }

  private cleanDescription(content: string): string {
    // Remove excess whitespace
    let clean = content.replace(/\s+/g, ' ').trim();
    
    // Limit length
    if (clean.length > 1000) {
      clean = clean.substring(0, 997) + '...';
    }
    
    return clean;
  }
}
```

---

## Testing Requirements

### Unit Tests

```typescript
// apps/aviation-accident-tracker/backend/src/ingest/avherald-adapter.test.ts

import { AVHeraldAdapter } from './avherald-adapter';
import { AVHeraldParser } from './avherald-parser';

describe('AVHeraldAdapter', () => {
  let adapter: AVHeraldAdapter;

  beforeEach(() => {
    adapter = new AVHeraldAdapter();
  });

  test('fetches recent incidents', async () => {
    const events = await adapter.fetch(30);
    
    expect(Array.isArray(events)).toBe(true);
  });

  test('respects rate limiting', async () => {
    const start = Date.now();
    await adapter.fetch(2);
    const elapsed = Date.now() - start;
    
    // Should take at least 3 seconds per article
    expect(elapsed).toBeGreaterThanOrEqual(3000);
  });
});

describe('AVHeraldParser', () => {
  let parser: AVHeraldParser;

  beforeEach(() => {
    parser = new AVHeraldParser();
  });

  test('parses headline correctly', () => {
    const headline = 'Incident: United B738 at San Francisco on Jan 13th 2026, hard landing';
    const content = 'Test content';
    
    const article = {
      id: 'test123',
      url: 'https://avherald.com/h?article=test123',
      date: '2026-01-13',
      headline,
      summary: ''
    };

    const event = parser.parseArticle('<div class="hcontent">Test content</div>', article);
    
    expect(event).not.toBeNull();
    expect(event?.external_id).toBe('avherald-test123');
    expect(event?.operator).toContain('United');
  });

  test('extracts aircraft type', () => {
    const data: any = {};
    parser['parseAircraftInfo']('United B738', data);
    
    expect(data.operator).toBe('United');
    expect(data.type).toBe('Boeing 737-800');
  });

  test('extracts flight number', () => {
    const content = 'flight UA-123';
    const data: any = {};
    parser['extractFromContent'](content, data);
    
    expect(data.flightNumber).toBe('UA123');
  });
});
```

---

## Dependencies

### NPM Packages

```json
{
  "dependencies": {
    "cheerio": "^1.0.0-rc.12",      // HTML parsing
    "fast-xml-parser": "^4.3.0"     // RSS/XML parsing
  }
}
```

---

## Acceptance Criteria

- [ ] AVHeraldAdapter implements IngestionAdapter interface
- [ ] Fetches incidents from RSS feed
- [ ] Falls back to HTML if RSS fails
- [ ] Parses all key fields correctly
- [ ] Handles errors gracefully
- [ ] Rate limiting implemented (3 sec)
- [ ] Tests passing (>80% coverage)
- [ ] Integration with EventRepository works
- [ ] Deduplication working
- [ ] Classification applied

---

## Timeline

**Day 1:**
- AVHeraldScraper (RSS + HTML)
- Basic parsing logic
- Rate limiting

**Day 2:**
- Complete AVHeraldParser
- Error handling
- Tests and integration

---

**Status:** Ready for implementation
**Dependencies:** Aviation-o2d (airports), Backend infrastructure
**Target Completion:** 2 days
