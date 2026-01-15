# Seed Data Generation Implementation Spec

**Bead:** [Aviation-7r4] Create seed data for testing and development
**Priority:** P1 - High Priority  
**Effort:** 0.5-1 day
**Dependencies:**
- Backend infrastructure (repository, types)
- Database schema (Aviation-p0c)

---

## Overview

Create realistic seed data for development, testing, and demos. Seed data should represent a diverse set of aviation accidents and incidents with various characteristics.

---

## Target Implementation

### File Structure

```
apps/aviation-accident-tracker/backend/
├── seed/
│   ├── seed.ts                    # Main seed script
│   ├── generate-events.ts         # Event generation logic
│   ├── templates/                 # Event templates
│   │   ├── commercial.ts          # Commercial aviation events
│   │   └── ga.ts                  # General aviation events
│   └── data/
│       ├── aircraft-types.json    # Aircraft type catalog
│       ├── operators.json         # Airline/operator names
│       └── locations.json         # Sample locations/airports
├── package.json                   # Add seed script
└── README.md                      # Document seed usage
```

---

## Seed Data Requirements

### Diversity

- **50-100 events total**
- **70% Commercial, 30% GA**
- **Mix of sources** (ASN, AVHerald)
- **Date range**: Last 2 years
- **Geographic diversity**: Worldwide locations
- **Severity range**: 0-200+ fatalities
- **Various aircraft types**: Jets, turboprops, pistons
- **Different phases**: Takeoff, cruise, landing, ground
- **Investigation statuses**: In progress, closed, pending

---

## Implementation

### Main Seed Script

```typescript
// apps/aviation-accident-tracker/backend/seed/seed.ts

import { EventRepository } from '../src/db/repository.js';
import { generateCommercialEvents } from './templates/commercial.js';
import { generateGAEvents } from './templates/ga.js';
import { logger } from '../src/logger.js';

export async function seedDatabase() {
  logger.info('Starting database seeding...');

  const repository = new EventRepository();
  await repository.initialize();

  try {
    // Clear existing data (optional - only in dev)
    if (process.env.NODE_ENV === 'development') {
      await repository.deleteAll();
      logger.info('Cleared existing data');
    }

    // Generate events
    const commercialEvents = generateCommercialEvents(70);
    const gaEvents = generateGAEvents(30);
    const allEvents = [...commercialEvents, ...gaEvents];

    logger.info(`Generated ${allEvents.length} events`);

    // Insert events
    let inserted = 0;
    for (const event of allEvents) {
      await repository.upsert(event);
      inserted++;
    }

    logger.info(`✅ Successfully seeded ${inserted} events`);
  } catch (error) {
    logger.error('Seed failed:', error);
    throw error;
  } finally {
    await repository.close();
  }
}

// Run if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  seedDatabase()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
}
```

---

### Event Generation Logic

```typescript
// apps/aviation-accident-tracker/backend/seed/generate-events.ts

import type { EventRecord } from '../src/types.js';

interface GenerateOptions {
  count: number;
  category: 'Commercial' | 'GA';
  source: 'ASN' | 'AVHerald';
  dateRange: {
    start: Date;
    end: Date;
  };
}

export function generateEvents(options: GenerateOptions): EventRecord[] {
  const events: EventRecord[] = [];

  for (let i = 0; i < options.count; i++) {
    const event = generateSingleEvent({
      index: i,
      category: options.category,
      source: options.source,
      dateRange: options.dateRange
    });

    events.push(event);
  }

  return events;
}

function generateSingleEvent(params: {
  index: number;
  category: 'Commercial' | 'GA';
  source: 'ASN' | 'AVHerald';
  dateRange: { start: Date; end: Date };
}): EventRecord {
  const { index, category, source, dateRange } = params;

  // Random date within range
  const date = randomDate(dateRange.start, dateRange.end);

  // Select aircraft type based on category
  const aircraft = selectAircraft(category);

  // Select location
  const location = selectLocation();

  // Generate fatalities (weighted towards zero)
  const fatalities = generateFatalities(category);

  return {
    external_id: `seed-${source.toLowerCase()}-${index}-${Date.now()}`,
    source,
    date_time: date.toISOString(),
    aircraft_type: aircraft.type,
    registration: aircraft.registration,
    operator: aircraft.operator,
    flight_number: category === 'Commercial' ? generateFlightNumber() : undefined,
    location: location.name,
    airport_code: location.code,
    latitude: location.latitude,
    longitude: location.longitude,
    phase_of_flight: selectPhase(),
    fatalities,
    injuries: Math.floor(Math.random() * 10),
    damage: selectDamage(fatalities),
    description: generateDescription(aircraft, location, fatalities),
    investigation_status: selectInvestigationStatus(),
    source_url: `https://${source.toLowerCase()}.example.com/event/${index}`
  };
}

// Helper functions

function randomDate(start: Date, end: Date): Date {
  return new Date(
    start.getTime() + Math.random() * (end.getTime() - start.getTime())
  );
}

function generateFlightNumber(): string {
  const airlines = ['UA', 'AA', 'DL', 'WN', 'B6', 'AS', 'NK'];
  const airline = airlines[Math.floor(Math.random() * airlines.length)];
  const number = Math.floor(Math.random() * 9999) + 1;
  return `${airline}${number}`;
}

function selectPhase(): string {
  const phases = [
    'Taxi',
    'Takeoff',
    'Initial Climb',
    'Climb',
    'Cruise',
    'Descent',
    'Approach',
    'Landing',
    'Go-around',
    'Parking'
  ];
  return phases[Math.floor(Math.random() * phases.length)];
}

function generateFatalities(category: 'Commercial' | 'GA'): number {
  // 80% zero fatalities
  if (Math.random() < 0.8) return 0;

  // 20% with fatalities
  if (category === 'Commercial') {
    // 1-200 for commercial
    return Math.floor(Math.random() * 200) + 1;
  } else {
    // 1-6 for GA
    return Math.floor(Math.random() * 6) + 1;
  }
}

function selectDamage(fatalities: number): string {
  if (fatalities > 0) return 'Destroyed';
  
  const rand = Math.random();
  if (rand < 0.5) return 'None';
  if (rand < 0.8) return 'Minor';
  return 'Substantial';
}

function selectInvestigationStatus(): string {
  const statuses = [
    'Under investigation',
    'Investigation complete',
    'Report published',
    'Preliminary report issued',
    'Investigation in progress - NTSB',
    'Investigation in progress - FAA',
    'Closed'
  ];
  return statuses[Math.floor(Math.random() * statuses.length)];
}
```

---

### Commercial Aviation Templates

```typescript
// apps/aviation-accident-tracker/backend/seed/templates/commercial.ts

import { generateEvents } from '../generate-events.js';
import { loadJSON } from '../utils.js';

const aircraftTypes = [
  { type: 'Boeing 737-800', minPax: 150, maxPax: 189 },
  { type: 'Airbus A320', minPax: 150, maxPax: 180 },
  { type: 'Boeing 777-300ER', minPax: 300, maxPax: 396 },
  { type: 'Airbus A350-900', minPax: 300, maxPax: 366 },
  { type: 'Boeing 787-9', minPax: 250, maxPax: 296 },
  { type: 'Embraer E190', minPax: 96, maxPax: 114 },
  { type: 'Bombardier CRJ-900', minPax: 76, maxPax: 90 },
  { type: 'ATR 72-600', minPax: 68, maxPax: 78 }
];

const operators = [
  'United Airlines',
  'American Airlines',
  'Delta Air Lines',
  'Southwest Airlines',
  'JetBlue Airways',
  'Alaska Airlines',
  'Spirit Airlines',
  'Frontier Airlines',
  'Lufthansa',
  'British Airways',
  'Air France',
  'Emirates',
  'Singapore Airlines',
  'Cathay Pacific',
  'Qantas'
];

export function generateCommercialEvents(count: number) {
  const now = new Date();
  const twoYearsAgo = new Date(now);
  twoYearsAgo.setFullYear(now.getFullYear() - 2);

  return generateEvents({
    count,
    category: 'Commercial',
    source: Math.random() < 0.5 ? 'ASN' : 'AVHerald',
    dateRange: {
      start: twoYearsAgo,
      end: now
    }
  });
}

export function selectAircraft(category: 'Commercial' | 'GA') {
  if (category === 'Commercial') {
    const aircraft = aircraftTypes[Math.floor(Math.random() * aircraftTypes.length)];
    const operator = operators[Math.floor(Math.random() * operators.length)];
    
    return {
      type: aircraft.type,
      operator,
      registration: generateRegistration()
    };
  } else {
    // GA aircraft
    const gaTypes = [
      'Cessna 172',
      'Cessna 182',
      'Piper PA-28',
      'Cirrus SR22',
      'Beechcraft Bonanza',
      'Diamond DA40'
    ];
    
    return {
      type: gaTypes[Math.floor(Math.random() * gaTypes.length)],
      operator: undefined,
      registration: generateNNumber()
    };
  }
}

function generateRegistration(): string {
  // US: N12345
  const letter = String.fromCharCode(65 + Math.floor(Math.random() * 26));
  const num = Math.floor(Math.random() * 99999);
  return `N${num}${letter}`;
}

function generateNNumber(): string {
  const num = Math.floor(Math.random() * 99999);
  const suffix = Math.random() < 0.5 ? '' : 
    String.fromCharCode(65 + Math.floor(Math.random() * 26));
  return `N${num}${suffix}`;
}
```

---

### Location Data

```typescript
// apps/aviation-accident-tracker/backend/seed/templates/locations.ts

export const locations = [
  {
    name: 'San Francisco International Airport',
    code: 'KSFO',
    latitude: 37.619,
    longitude: -122.375
  },
  {
    name: 'John F. Kennedy International Airport',
    code: 'KJFK',
    latitude: 40.640,
    longitude: -73.779
  },
  {
    name: 'Los Angeles International Airport',
    code: 'KLAX',
    latitude: 33.942,
    longitude: -118.408
  },
  {
    name: 'Chicago O\'Hare International Airport',
    code: 'KORD',
    latitude: 41.979,
    longitude: -87.905
  },
  {
    name: 'London Heathrow Airport',
    code: 'EGLL',
    latitude: 51.471,
    longitude: -0.462
  },
  {
    name: 'Paris Charles de Gaulle Airport',
    code: 'LFPG',
    latitude: 49.010,
    longitude: 2.548
  },
  {
    name: 'Tokyo Narita International Airport',
    code: 'RJAA',
    latitude: 35.765,
    longitude: 140.386
  },
  {
    name: 'Sydney Kingsford Smith Airport',
    code: 'YSSY',
    latitude: -33.946,
    longitude: 151.177
  },
  {
    name: 'Dubai International Airport',
    code: 'OMDB',
    latitude: 25.253,
    longitude: 55.365
  },
  {
    name: 'Singapore Changi Airport',
    code: 'WSSS',
    latitude: 1.350,
    longitude: 103.994
  }
];

export function selectLocation() {
  return locations[Math.floor(Math.random() * locations.length)];
}
```

---

### Description Generator

```typescript
// apps/aviation-accident-tracker/backend/seed/generate-description.ts

export function generateDescription(
  aircraft: { type: string; operator?: string },
  location: { name: string; code?: string },
  fatalities: number
): string {
  const scenarios = [
    'experienced a hard landing',
    'encountered severe turbulence',
    'had an engine failure',
    'experienced landing gear malfunction',
    'encountered windshear on approach',
    'had a runway excursion',
    'experienced bird strike',
    'had hydraulic system failure',
    'encountered icing conditions',
    'had electrical system failure'
  ];

  const scenario = scenarios[Math.floor(Math.random() * scenarios.length)];

  const aircraftStr = aircraft.operator
    ? `A ${aircraft.operator} ${aircraft.type}`
    : `A ${aircraft.type}`;

  const fatalityStr =
    fatalities > 0
      ? ` resulting in ${fatalities} ${fatalities === 1 ? 'fatality' : 'fatalities'}`
      : ' with no fatalities reported';

  const description =
    `${aircraftStr} ${scenario} at ${location.name}${fatalityStr}. ` +
    `The aircraft was ${selectOutcome(fatalities)}. ` +
    `Investigation is ongoing.`;

  return description;
}

function selectOutcome(fatalities: number): string {
  if (fatalities > 50) return 'destroyed';
  if (fatalities > 0) return 'substantially damaged';
  
  const outcomes = [
    'able to land safely',
    'diverted to an alternate airport',
    'successfully recovered',
    'able to continue the flight',
    'evacuated without incident'
  ];
  
  return outcomes[Math.floor(Math.random() * outcomes.length)];
}
```

---

## NPM Script

```json
// apps/aviation-accident-tracker/backend/package.json

{
  "scripts": {
    "seed": "tsx seed/seed.ts",
    "seed:dev": "NODE_ENV=development npm run seed",
    "seed:prod": "NODE_ENV=production npm run seed"
  }
}
```

---

## Usage

### Development

```bash
# Clear and seed database
cd apps/aviation-accident-tracker/backend
npm run seed:dev
```

### Production (Append Only)

```bash
# Add seed data without clearing
npm run seed:prod
```

---

## Testing Seed Data

```typescript
// apps/aviation-accident-tracker/backend/seed/seed.test.ts

import { generateEvents } from './generate-events';

describe('Seed Data Generation', () => {
  test('generates correct number of events', () => {
    const events = generateEvents({
      count: 10,
      category: 'Commercial',
      source: 'ASN',
      dateRange: {
        start: new Date('2024-01-01'),
        end: new Date('2026-01-01')
      }
    });

    expect(events).toHaveLength(10);
  });

  test('all events have required fields', () => {
    const events = generateEvents({
      count: 5,
      category: 'GA',
      source: 'AVHerald',
      dateRange: {
        start: new Date('2024-01-01'),
        end: new Date('2026-01-01')
      }
    });

    events.forEach(event => {
      expect(event.external_id).toBeDefined();
      expect(event.source).toBeDefined();
      expect(event.date_time).toBeDefined();
      expect(event.aircraft_type).toBeDefined();
      expect(event.location).toBeDefined();
      expect(event.fatalities).toBeGreaterThanOrEqual(0);
    });
  });

  test('dates are within specified range', () => {
    const start = new Date('2025-01-01');
    const end = new Date('2026-01-01');

    const events = generateEvents({
      count: 20,
      category: 'Commercial',
      source: 'ASN',
      dateRange: { start, end }
    });

    events.forEach(event => {
      const eventDate = new Date(event.date_time);
      expect(eventDate.getTime()).toBeGreaterThanOrEqual(start.getTime());
      expect(eventDate.getTime()).toBeLessThanOrEqual(end.getTime());
    });
  });
});
```

---

## Sample Output

```json
{
  "external_id": "seed-asn-0-1705177200000",
  "source": "ASN",
  "date_time": "2025-03-15T14:30:00.000Z",
  "aircraft_type": "Boeing 737-800",
  "registration": "N12345A",
  "operator": "United Airlines",
  "flight_number": "UA1234",
  "location": "San Francisco International Airport",
  "airport_code": "KSFO",
  "latitude": 37.619,
  "longitude": -122.375,
  "phase_of_flight": "Landing",
  "fatalities": 0,
  "injuries": 3,
  "damage": "Minor",
  "description": "A United Airlines Boeing 737-800 experienced a hard landing at San Francisco International Airport with no fatalities reported. The aircraft was able to land safely. Investigation is ongoing.",
  "investigation_status": "Under investigation",
  "source_url": "https://asn.example.com/event/0"
}
```

---

## Acceptance Criteria

- [ ] Generates 50-100 realistic events
- [ ] 70% Commercial, 30% GA split
- [ ] Mix of ASN and AVHerald sources
- [ ] Dates within last 2 years
- [ ] Geographic diversity (10+ locations)
- [ ] Realistic aircraft types
- [ ] Weighted fatalities (80% zero)
- [ ] Descriptive narratives
- [ ] Valid investigation statuses
- [ ] NPM script works
- [ ] Seeds database successfully
- [ ] Tests validate data quality

---

## Timeline

**Half Day:**
- Generate-events logic
- Templates (commercial, GA)
- Seed script
- NPM integration
- Basic testing

---

**Status:** Ready for implementation
**Dependencies:** Backend infrastructure, Database schema
**Target Completion:** 0.5-1 day
