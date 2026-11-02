# @aviation/ai-explainer

Common queued decision explanations for Aviation applications. The package implements
[the Aviation explanation Component](../../../../aviation-ai-explanation/component.md)
an Express HTTP adapter, managed broker and browser UI. Complete application wiring
is tracked by [AI-001](../../../../../docs/roadmap/active-work.md).
The current SDK tests are retained-source evidence, not all-app deployment acceptance.

RCC accepts authenticated requests and returns `202 queued`; it sends the result to
the application callback later. A queue response is never treated as an explanation.
RCC owns model selection and fallback.

## Configure the SDK

Pass application-owned configuration explicitly; the core does not read environment
variables, guess a provider host, or fall back to production credentials.

```typescript
import express from 'express';
import { ExplainerClient, explainerRoute } from '@aviation/ai-explainer';

const client = new ExplainerClient({
  appId: 'flight-planner',
  brainUrl: configuredRccRequestUrl,
  apiToken: configuredRccToken,
  publicBaseUrl: configuredApplicationOrigin,
});
const app = express();
app.use(explainerRoute(client));
```

Missing configuration leaves the adapter unavailable without a provider call.
`GET /api/explain/config` returns `{available: boolean}`. A normal application must
source these settings through its common SDK configuration adapter; never send the
provider token to a browser. Each application instance needs one SDK request broker.
Non-Node worker bindings must proxy to that broker so callback ownership is independent
of which application worker receives a request.

For the standard runtime, use `createExplanationRuntime(appId)` and mount its
`middleware` before application JSON parsers and fallback routes. It reads the
common configuration catalog's `rcc.request_url` and `rcc.api_token` fields from
the explicitly selected keystore, with `RCC_BRAIN_URL` / `RCC_API_TOKEN` environment
fallback. Set `AVIATION_EXPLAIN_PUBLIC_URL` to the application's public origin.
Missing settings remain unavailable. Close the runtime during server shutdown.
Plain Node HTTP servers call `if (runtime.handle(request, response)) return;`
before their own routing. The SDK handles only its explanation namespace and
supplies the same HTTP, authorization and isolation behavior as the Express adapter.

Python backends use `aviation.explanation.create_explanation_router` (FastAPI) or
`create_explanation_blueprint` (Flask). Run their worker pool under the common
managed entrypoint:

```sh
node /opt/aviation/explanation/dist/run.js --app g1000-simulator -- \
  uvicorn main:app --host 0.0.0.0 --port 8000 --workers 2
```

The supervisor assigns an owned loopback broker URL to its child; all workers
forward to the same request registry. The Python binding accepts only literal
loopback HTTP destinations, rejects redirects and ignores environment HTTP proxies.
Application authentication is supplied through the binding's authorization hook.

Ring applications use `aviation.explanation/wrap-explanation` from
`packages/shared-sdk/clojure/src`, outside application JSON/session middleware.
Its bounded Java HTTP client forwards the same namespace to the supervised broker,
checks app and storage-mode response identities, disables proxies and redirects,
and bounds response streaming and total RPC time. Run the JVM under the same SDK
supervisor. The JVM binding owns no model configuration or pending-request registry.

Browser applications import `registerDecisionContext` from
`@aviation/ai-explainer/browser` and register a getter for their selected decision
facts. The returned function removes that registration. This leaf includes no
Node provider or secret-store code. It renders shared explanations, bounded
follow-up history and plain-text results, and cleans up tickets before navigation.

Private SDK runs require the standard signed app/run headers plus a tagged
`explanation` fixture at `/api/explain/__e2e/fixtures`. They bypass normal provider
configuration entirely. `seedE2EExplanation` and `exerciseE2EExplanation` from
`@aviation/shared-sdk/e2e` own the reusable browser flow and fixture teardown;
normal app fixtures and broker fixtures are checked separately for zero residuals.

## Submit and follow up

`POST /api/explain` accepts `{context, question?, history?}` and returns HTTP 202 with
`{requestId, accessToken, status: "queued", expiresAt, pollAfterMs}`. Context contains
facts of the selected application decision. Follow-up history contains only ordered
`user` and `assistant` messages. The SDK supplies the system instruction.

Poll `GET /api/explain/requests/{requestId}` with the separate result credential in
`X-Aviation-Explain-Token`. Completed state contains `explanation`, `completedAt` and
an optional provider `model`. Delete the same resource with that credential when the
consumer finishes. Deleted, expired, unknown and wrong-token requests return 404.
Tokens belong in memory and headers, never URLs or persistent browser storage.

RCC posts to `/api/explain/callback`. Its echoed metadata must contain the exact
application and independent callback nonce, and its request ID must match queue
acceptance. An early callback is checked after acceptance; foreign and duplicate
callbacks cannot replace a result. Provider errors are generic and never echo response
bodies, messages or credentials.

## Bounds and cleanup

Defaults are a 10-second submission deadline, 120-second local request lifetime,
32 active requests, 768 maximum output tokens and 64 KiB maximum explanation text.
Input and history byte limits are in the Component contract. The adapter also bounds
JSON body and queue response sizes. Client disconnection during submission, timeout,
delete and shutdown release owned local state. `client.close()` closes the registry.

Local expiry does not cancel an RCC job: RCC currently has no cancellation endpoint
and may continue its own fallback retries. A late callback cannot revive expired local
state. Isolated application tests must use SDK provider mocks and tagged private
state; live model calls are not part of SDK qualification.

## Check the package

```sh
pnpm --filter @aviation/ai-explainer run build
pnpm --filter @aviation/ai-explainer run test
```

Tests run authored conformance vectors and real local HTTP queued/callback fixtures,
including early callbacks, follow-up history, credential isolation, bounded memory,
timeouts, malformed JSON, replay and owned-state cleanup.
