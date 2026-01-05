# @aviation/shared-sdk

Shared SDK for aviation applications providing base classes for services and AI integration.

## Features

- **BackgroundService**: Base class for long-running background services
- **AIService**: Base class for AI-powered services
- **AIProvider Interface**: Standard interface for AI provider implementations
- **SecureKeyStore**: Encrypted storage for API keys and secrets

## Installation

```bash
npm install @aviation/shared-sdk
```

## Usage

### Creating a Background Service

```typescript
import { BackgroundService, ServiceConfig } from '@aviation/shared-sdk';

class MyService extends BackgroundService {
  protected async onStart(): Promise<void> {
    console.log('Service starting...');
    // Initialize your service
  }

  protected async onStop(): Promise<void> {
    console.log('Service stopping...');
    // Cleanup resources
  }
}

const service = new MyService({
  name: 'my-service',
  enabled: true,
  autoStart: true
});

await service.start();
console.log(service.getStatus());
```

### Using SecureKeyStore

```typescript
import { SecureKeyStore } from '@aviation/shared-sdk';

const keystore = new SecureKeyStore();

// Store a secret
keystore.setSecret('my-service', 'api_key', 'your-api-key');

// Retrieve a secret
const apiKey = keystore.getSecret('my-service', 'api_key');

// List all keys for a service
const keys = keystore.listKeys('my-service');

// Delete a secret
keystore.deleteSecret('my-service', 'old_key');
```

### AI Integration

```typescript
import { AIProvider, AIService } from '@aviation/shared-sdk';

// Implement a custom AI provider
class MyAIProvider implements AIProvider {
  name = 'my-provider';
  
  async initialize(config: AIConfig): Promise<void> {
    // Setup AI provider
  }
  
  async query(prompt: string, options?: AIQueryOptions): Promise<AIResponse> {
    // Execute AI query
    return {
      content: 'AI response',
      tokens: 100,
      model: 'gpt-4'
    };
  }
}

// Use in a service
class MyAIService extends AIService {
  async processData(data: any): Promise<any> {
    const response = await this.provider.query('Analyze this data: ' + JSON.stringify(data));
    return response.content;
  }
}
```

## API Reference

### BackgroundService

Base class for background services.

**Methods:**
- `start()`: Start the service
- `stop()`: Stop the service
- `getStatus()`: Get current service status

**Abstract Methods (must implement):**
- `onStart()`: Called when service starts
- `onStop()`: Called when service stops

### SecureKeyStore

Encrypted storage for API keys and secrets.

**Methods:**
- `setSecret(service, key, value)`: Store a secret
- `getSecret(service, key)`: Retrieve a secret
- `deleteSecret(service, key)`: Delete a secret
- `listKeys(service)`: List all keys for a service

**Configuration:**
- `storePath`: Path to keystore file (default: `.keystore`)
- `encryptionKey`: Encryption key (from env var `KEYSTORE_ENCRYPTION_KEY`)

## License

MIT
