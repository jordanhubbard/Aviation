# @aviation/ai-explainer

Shared AI decision explanation client for Aviation monorepo apps.

## Overview

`ExplainerClient` calls the RCC brain API to answer "why did you make this decision?" questions. It accepts a `context` string (relevant data/state) and a `question` string, and returns a natural-language explanation.

## Configuration

Set the `RCC_URL` environment variable to point at your RCC brain API instance (default: `http://localhost:8789`).

## Usage

```typescript
import { ExplainerClient, isExplainError } from '@aviation/ai-explainer';

const client = new ExplainerClient(); // reads RCC_URL from env

const result = await client.explain({
  context: 'Flight summary and relevant data...',
  question: 'Why was this route recommended?',
});

if (isExplainError(result)) {
  console.error(`Error ${result.status}: ${result.error}`);
} else {
  console.log(result.explanation);
}
```

## Backend Integration

Each app backend exposes `POST /api/explain` accepting `{ context: string, question: string }` and returning `{ explanation: string }`. Returns 503 if RCC is unreachable.

## Frontend Integration

A `? Explain with AI` button appears in event detail modals, calling `/api/explain` and displaying the response inline.
