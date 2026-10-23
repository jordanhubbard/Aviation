# @aviation/ai-explainer

AI decision explanation layer for the Aviation monorepo. Provides an `ExplainerClient` that calls the RCC brain API and an Express middleware factory that wires up a `POST /api/explain` endpoint.

## Installation

This package is part of the Aviation monorepo workspace. In any app's `package.json`:

```json
{
  "dependencies": {
    "@aviation/ai-explainer": "*"
  }
}
```

## Usage

### ExplainerClient

```typescript
import { ExplainerClient } from '@aviation/ai-explainer';

const client = new ExplainerClient();
// Uses RCC_BRAIN_URL env var, default http://localhost:8765/api/brain/request

const explanation = await client.explain(
  'Aircraft deviated 15° from planned heading at waypoint ALPHA',
  'Why did the autopilot make this correction?'
);
```

Configuration via constructor options (takes precedence over env var):

```typescript
const client = new ExplainerClient({ brainUrl: 'http://rcc-host/api/brain/request' });
```

### Express middleware

```typescript
import express from 'express';
import { ExplainerClient, explainerRoute } from '@aviation/ai-explainer';

const app = express();
app.use(express.json());

const client = new ExplainerClient();
app.use(explainerRoute(client));
```

This registers `POST /api/explain`:

- **Request**: `{ context: string, question?: string }`
- **Response**: `{ explanation: string }`

## Environment variables

| Variable | Default | Description |
|----------|---------|-------------|
| `RCC_BRAIN_URL` | `http://localhost:8765/api/brain/request` | RCC brain API endpoint |

## Development

```bash
npm run build   # Compile TypeScript
npm test        # Run tests
```
