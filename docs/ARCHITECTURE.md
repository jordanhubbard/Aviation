# Architecture Overview

## Design Principles

The Aviation monorepo is designed around several key principles:

1. **Modular Services**: Each aviation application is a self-contained service
2. **Shared Infrastructure**: Common functionality is provided through shared packages
3. **Security First**: API keys and secrets are encrypted at rest
4. **Multi-Modal UI**: Applications support multiple UI paradigms
5. **AI Integration**: Common AI patterns through shared SDK

## Component Architecture

### Shared SDK (`@aviation/shared-sdk`)

The shared SDK provides base classes and interfaces for all applications:

```
shared-sdk/
├── ai.ts          # AI provider interfaces and base service
├── service.ts     # Background service base class
├── keystore.ts    # Secure key store implementation
└── index.ts       # Public exports
```

**Key Classes:**

- `BackgroundService`: Abstract base for all services
  - Provides lifecycle management (start/stop)
  - Status reporting
  - Configuration management

- `AIService`: Abstract base for AI-powered services
  - Integration with AI providers
  - Common query patterns

- `SecureKeyStore`: Encrypted storage for API keys
  - AES-256-CBC encryption
  - Service-specific key namespacing
  - File-based persistence

### UI Framework (`@aviation/ui-framework`)

Supports three UI modalities:

1. **Mobile UI**: Self-contained mobile applications
2. **Multi-Tab Web UI**: Single web app with multiple panes
3. **Standalone Web UI**: Individual web applications

**Multi-Tab Pattern:**

```typescript
const webUI = new MultiTabWebUI();

// Register application panes
webUI.registerPane({
  id: 'flight-tracker',
  title: 'Flight Tracker',
  component: FlightTrackerPane,
  order: 1
});

webUI.registerPane({
  id: 'weather',
  title: 'Weather',
  component: WeatherPane,
  order: 2
});
```

### Applications

Each application follows this structure:

```
app-name/
├── src/
│   ├── index.ts      # Entry point
│   ├── service.ts    # Background service implementation
│   └── ui/           # UI components (optional)
├── package.json
└── tsconfig.json
```

**Application Lifecycle:**

1. Initialize SecureKeyStore
2. Create service instance with configuration
3. Start background service
4. Handle graceful shutdown signals (SIGINT, SIGTERM)

## Data Flow

```
External APIs
     ↓ (API Keys from KeyStore)
Background Service
     ↓
Data Processing/AI Analysis
     ↓
UI Components
```

## Security Architecture

### Key Storage

API keys are stored encrypted on disk:

1. Master encryption key derived from environment variable or default
2. Keys stored in `.keystore` file with 0600 permissions
3. Each secret tagged with service name and key name
4. Encryption: AES-256-CBC with random IV per encryption

### Key Access Pattern

```typescript
// Service initialization
const keystore = new SecureKeyStore();
const apiKey = keystore.getSecret('service-name', 'api-key-name');

// Use API key
const response = await fetch(url, {
  headers: { 'Authorization': `Bearer ${apiKey}` }
});
```

## Extensibility

### Adding New Services

1. Create new app directory under `apps/`
2. Extend `BackgroundService`
3. Implement `onStart()` and `onStop()` methods
4. Use SecureKeyStore for API keys
5. Add to monorepo workspace

### Adding AI Providers

Implement the `AIProvider` interface:

```typescript
class MyAIProvider implements AIProvider {
  name = 'my-provider';
  
  async initialize(config: AIConfig): Promise<void> {
    // Setup
  }
  
  async query(prompt: string, options?: AIQueryOptions): Promise<AIResponse> {
    // Query implementation
  }
}
```

### Adding UI Modalities

Extend base UI classes:

```typescript
class MyMobileUI extends MobileUI {
  constructor() {
    super('my-app', 'My Aviation App');
  }
  
  render(): void {
    // Mobile-specific rendering
  }
}
```

## Development Workflow

1. **Development**: `npm run dev` (watches for changes)
2. **Build**: `npm run build` (compiles TypeScript)
3. **Test**: `npm test` (runs tests if available)
4. **Clean**: `npm run clean` (removes build artifacts)

## Deployment

Each application can be deployed independently:

1. Build the application: `npm run build`
2. Set environment variables (especially `KEYSTORE_ENCRYPTION_KEY`)
3. Run the service: `npm start`
4. Configure process manager (PM2, systemd, etc.) for production

## Future Enhancements

- Service discovery and inter-service communication
- Centralized logging and monitoring
- Health check endpoints
- API gateway for external access
- Database integration patterns
- Message queue for async communication
- Docker containerization
- Kubernetes orchestration
