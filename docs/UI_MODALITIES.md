# UI Modalities Guide

This guide explains how aviation applications in the monorepo can be accessed through different UI modalities.

## Overview

Each aviation application can support multiple UI modalities:

1. **Self-Contained Mobile UI** - Native mobile apps
2. **Multi-Tab Web UI** - Single web application with tabbed interface
3. **Standalone Web UI** - Individual web applications

This flexibility allows applications to be deployed in different contexts while sharing the same backend service logic.

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     Background Services                       │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────┐ │
│  │ Flight Tracker  │  │ Weather Briefing│  │   Service N │ │
│  └────────┬────────┘  └────────┬────────┘  └──────┬──────┘ │
│           │                     │                   │         │
│           └─────────────────────┴───────────────────┘         │
│                           │                                   │
│                    Secure KeyStore                            │
└───────────────────────────┬───────────────────────────────────┘
                            │
          ┌─────────────────┼─────────────────┐
          │                 │                 │
    ┌─────▼─────┐    ┌─────▼─────┐    ┌─────▼─────┐
    │  Mobile   │    │ Multi-Tab │    │Standalone │
    │    UI     │    │  Web UI   │    │  Web UI   │
    └───────────┘    └───────────┘    └───────────┘
```

## 1. Multi-Tab Web UI

The multi-tab web UI allows multiple aviation applications to be displayed as tabs/panes within a single web interface.

### Use Case
- Desktop web browsers
- Unified dashboard for pilots
- Consolidated view of multiple services

### Implementation

**Main Application (Container):**

```typescript
import { MultiTabWebUI } from '@aviation/ui-framework';
import { FlightTrackerPane } from '@aviation/flight-tracker/ui';
import { WeatherPane } from '@aviation/weather-briefing/ui';

// Initialize the multi-tab container
const webUI = new MultiTabWebUI();

// Register all application panes
webUI.registerPane({
  id: 'flight-tracker',
  title: 'Flight Tracker',
  icon: '✈️',
  component: FlightTrackerPane,
  order: 1
});

webUI.registerPane({
  id: 'weather',
  title: 'Weather Briefing',
  icon: '🌤️',
  component: WeatherPane,
  order: 2
});

// Render the container with all panes
renderMultiTabUI(webUI);
```

**Application Pane Component:**

```typescript
// apps/flight-tracker/src/ui/pane.tsx
export function FlightTrackerPane() {
  return (
    <div className="flight-tracker-pane">
      <h2>Flight Tracker</h2>
      {/* Pane content */}
    </div>
  );
}
```

### Features
- Tab navigation between applications
- Shared state management
- Single authentication session
- Efficient resource sharing

## 2. Self-Contained Mobile UI

Each application can have its own mobile UI for iOS and Android platforms.

### Use Case
- Mobile devices (iOS/Android)
- On-the-go access
- Device-specific features (GPS, notifications)

### Implementation

**React Native Example:**

```typescript
import { MobileUI } from '@aviation/ui-framework';

class FlightTrackerMobileUI extends MobileUI {
  constructor() {
    super('flight-tracker', 'Flight Tracker');
  }

  render(): void {
    // Render mobile-specific UI
    return (
      <View>
        <Text>Flight Tracker Mobile App</Text>
        {/* Mobile UI components */}
      </View>
    );
  }
}
```

**Flutter Example:**

```dart
class FlightTrackerMobileApp extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'Flight Tracker',
      home: FlightTrackerHome(),
    );
  }
}
```

### Features
- Native mobile experience
- Offline capabilities
- Push notifications
- Device integration (GPS, camera, etc.)

## 3. Standalone Web UI

Each application can also run as its own independent web application.

### Use Case
- Dedicated web deployment
- Specialized workflows
- Independent scaling

### Implementation

```typescript
import { StandaloneWebUI } from '@aviation/ui-framework';

class FlightTrackerWebUI extends StandaloneWebUI {
  constructor() {
    super('flight-tracker', 'Flight Tracker');
  }

  render(): void {
    // Render standalone web UI
    ReactDOM.render(
      <FlightTrackerApp />,
      document.getElementById('root')
    );
  }
}

// Initialize and render
const webUI = new FlightTrackerWebUI();
webUI.render();
```

### Features
- Full-page application
- Independent deployment
- Custom domain/URL
- Specialized authentication

## Communication with Backend Services

All UI modalities communicate with the same backend services through APIs.

### REST API Pattern

```typescript
// Shared API client (in shared-sdk)
export class ServiceClient {
  constructor(private baseUrl: string, private apiKey: string) {}

  async fetchData(endpoint: string): Promise<any> {
    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json'
      }
    });
    return response.json();
  }
}

// Usage in any UI modality
const client = new ServiceClient(
  'http://localhost:3000',
  await getApiKey()
);

const flights = await client.fetchData('/api/flights');
```

### WebSocket Pattern

```typescript
// Real-time updates for all UI modalities
export class RealtimeClient {
  private ws: WebSocket;

  connect(url: string) {
    this.ws = new WebSocket(url);
    
    this.ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      this.handleUpdate(data);
    };
  }

  private handleUpdate(data: any) {
    // Update UI regardless of modality
    updateStore(data);
  }
}
```

## Data Synchronization

All modalities can share data through:

### 1. Cloud Backend
```typescript
// Sync through REST API
await api.post('/sync', localData);
const serverData = await api.get('/sync');
mergeData(localData, serverData);
```

### 2. Local Storage
```typescript
// Mobile: AsyncStorage, SQLite
// Web: LocalStorage, IndexedDB
const cachedData = await storage.get('flights');
if (cachedData) {
  displayData(cachedData);
}
```

### 3. Real-time Sync
```typescript
// WebSocket or Server-Sent Events
ws.on('data-update', (data) => {
  updateLocalState(data);
});
```

## Example: Complete Application Structure

```
apps/flight-tracker/
├── src/
│   ├── index.ts              # Background service entry
│   ├── service.ts            # Service logic
│   ├── api/                  # REST API endpoints
│   │   └── routes.ts
│   └── ui/                   # UI implementations
│       ├── web/
│       │   ├── standalone.tsx  # Standalone web UI
│       │   └── pane.tsx        # Multi-tab pane
│       └── mobile/
│           ├── ios/            # iOS app
│           └── android/        # Android app
├── package.json
└── tsconfig.json
```

## Choosing a Modality

| Factor | Multi-Tab | Mobile | Standalone |
|--------|-----------|--------|------------|
| **Best for** | Desktop workflows | Mobile users | Dedicated apps |
| **Deployment** | Single web app | App stores | Multiple web apps |
| **Resources** | Shared | Per-device | Per-deployment |
| **Authentication** | Shared session | Per-app | Per-app |
| **Offline** | Limited | Yes | Limited |

## Best Practices

1. **Shared Business Logic**: Keep service logic in background services, not in UI
2. **Responsive Design**: Web UIs should work on various screen sizes
3. **Progressive Enhancement**: Start with basic functionality, add advanced features
4. **API-First**: Design APIs that work for all UI modalities
5. **State Management**: Use consistent state management across modalities
6. **Error Handling**: Implement robust error handling for network issues
7. **Caching**: Cache data appropriately for each modality

## Future Enhancements

- **Desktop Apps**: Electron-based desktop applications
- **Voice UI**: Integration with voice assistants
- **AR/VR**: Augmented/Virtual reality interfaces
- **Smart Watch**: Wearable device interfaces
- **CLI**: Command-line interface for automation

## References

- [Multi-Tab Web UI Package](/packages/ui-framework)
- [Background Services](/packages/shared-sdk)
- [Example Applications](/apps)
