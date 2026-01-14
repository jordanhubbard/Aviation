# @aviation/shared-sdk

Shared SDK for aviation applications providing core services, aviation utilities, and AI patterns.

## Features
- BackgroundService base class for long-running services
- AIProvider/AIService interfaces
- Aviation utilities: airports lookup/search/reverse, navigation math, lightweight weather client

## Installation
```bash
npm install @aviation/shared-sdk
```

## Usage
### Background service
```typescript
import { BackgroundService, ServiceConfig } from '@aviation/shared-sdk';

class MyService extends BackgroundService {
  protected async onStart() {/* ... */}
  protected async onStop() {/* ... */}
}

const service = new MyService({ name: 'my-service', enabled: true });
await service.start();
```

### Airports
```typescript
import { AirportDirectory } from '@aviation/shared-sdk';

const dir = new AirportDirectory([
  { icao: 'KSFO', iata: 'SFO', name: 'San Francisco', country: 'US', latitude: 37.6188, longitude: -122.375 },
]);

dir.find('SFO');
const matches = dir.search('San');
const nearest = dir.reverse(37.6, -122.3);
```

### Navigation
```typescript
import { distanceNm, courseTrue, windCorrection } from '@aviation/shared-sdk';

distanceNm(37.6188, -122.375, 40.6413, -73.7781);
courseTrue(37.6188, -122.375, 40.6413, -73.7781);
const { groundSpeed, trueHeading } = windCorrection(120, 90, 60, 20);
```

### Weather
```typescript
import { AviationWeatherClient } from '@aviation/shared-sdk';

const client = new AviationWeatherClient({ fetchFn: fetch, apiKey: process.env.WX_KEY });
const metar = await client.getMetar('KSFO');
const taf = await client.getTaf('KSFO');
```

### AI
```typescript
import { AIProvider, AIService } from '@aviation/shared-sdk';

class MyAIProvider implements AIProvider {/* ... */}
class MyAIService extends AIService {
  async processData(data: any) {
    return this.provider.query('analyze ' + JSON.stringify(data));
  }
}
```

## Testing
```bash
npm test  # runs vitest
```

## License
MIT
