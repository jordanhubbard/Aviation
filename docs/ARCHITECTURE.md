# Developer-Facing Architecture Overview

## Backend/Frontend/Service Interactions

### Backend

Each aviation application has a backend service that handles data processing, business logic, and integration with external APIs. The backend is typically implemented in Python (using frameworks like Flask or FastAPI) or TypeScript (using Node.js).

### Frontend

The frontend is responsible for rendering the user interface and handling user interactions. It is implemented using React for JavaScript-based applications.

### Service Interactions

1. **Initialization**:
   - The `SecureKeyStore` is initialized to manage API keys and secrets securely.
   - A service instance is created with the necessary configuration.
   - The background service is started.
   - Graceful shutdown handlers are set up to handle SIGINT and SIGTERM signals.

2. **Data Flow**:
   - External APIs are accessed using API keys retrieved from the `SecureKeyStore`.
   - The backend processes data and performs AI analysis as needed.
   - Processed data is sent to the frontend for display.

3. **Communication**:
   - Communication between the frontend and backend can be done via RESTful APIs or WebSockets, depending on the application's requirements.

## Key Data Flows

```
External APIs
     ↓ (API Keys from KeyStore)
Backend Service
     ↓
Data Processing/AI Analysis
     ↓
UI Components
```

## Dependency Graph

Below is a simplified dependency graph showing the relationships between different components and packages in the Aviation monorepo:

```
+-------------------+
|  External APIs    |
+-------------------+
          |
          v
+-------------------+
| SecureKeyStore    |
+-------------------+
          |
          v
+-------------------+
| BackgroundService |
+-------------------+
          |
          v
+-------------------+
| Data Processing   |
| AI Analysis       |
+-------------------+
          |
          v
+-------------------+
| UI Components     |
+-------------------+

+-------------------+
| Shared SDK        |
+-------------------+
          |
          v
+-------------------+
| UI Framework      |
+-------------------+
          |
          v
+-------------------+
| Applications      |
+-------------------+
```

## Detailed Component Architecture

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

The monorepo uses **pnpm workspaces**. Internal package references use the `workspace:*` protocol.

1. **Development**: `pnpm run dev` (watches for changes)
2. **Build**: `pnpm run build` (compiles TypeScript)
3. **Test**: `make test` or `pnpm --recursive --if-present run test`
4. **Clean**: `pnpm run clean` (removes build artifacts)

### TypeScript Compatibility Notes

- Packages using TS 6.x set `"ignoreDeprecations": "6.0"` in tsconfig to suppress the `moduleResolution: "node"` deprecation warning.
- Packages using TS 5.x set `"ignoreDeprecations": "5.0"` for the same reason.
- Packages requiring Node.js globals add `"types": ["node"]` to tsconfig compilerOptions.
- The `ui-framework` package includes `src/css-modules.d.ts` to declare CSS module imports.

### Breaking Dependency Notes

- **Zustand v5**: All store files use the named import `import { create } from 'zustand'` (the default export was removed).
- **React Router v7**: Routes use `<Routes><Route element={<Component />}>` syntax (`<Switch>` and `component` prop were removed).
- **Express 5**: Some router assignments require `as any` casts due to type incompatibilities introduced in Express 5.

## Deployment

Each application can be deployed independently:

1. Build the application: `pnpm run build`
2. Set environment variables (especially `KEYSTORE_ENCRYPTION_KEY`)
3. Run the service: `pnpm start`
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
