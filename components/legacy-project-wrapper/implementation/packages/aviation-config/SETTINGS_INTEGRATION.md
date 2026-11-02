# Settings Integration Guide

This document explains how to integrate `@aviation/aviation-config` into any Aviation app to provide a unified settings/configuration panel.

---

## 1. Add the dependency

In the app's `package.json`:

```json
{
  "dependencies": {
    "@aviation/aviation-config": "*"
  }
}
```

Then install with the workspace package manager (npm workspaces / pnpm):

```bash
npm install
# or
pnpm install
```

---

## 2. Render `<ConfigPanel>` in a settings page

### React (Vite / TypeScript)

```tsx
import { ConfigPanel } from '@aviation/aviation-config';

export function SettingsPage() {
  return (
    <div className="settings-page">
      <h1>My App Settings</h1>
      <ConfigPanel
        services={['openweather', 'sentry']}          // optional: filter to relevant services
        apiBase={import.meta.env.VITE_API_BASE_URL ?? ''}
        title="My App Configuration"
      />
    </div>
  );
}
```

**Props:**

| Prop | Type | Required | Description |
|------|------|----------|-------------|
| `title` | `string` | No | Heading shown at the top of the panel |
| `apiBase` | `string` | No | Base URL for the backend (e.g. `http://localhost:8000`). Defaults to `""` (same origin). |
| `services` | `string[]` | No | Filter panel to these service IDs. If omitted, all services are shown. |

**What the panel does:**
- On mount, calls `GET {apiBase}/api/settings` to fetch configured/not-configured status per service field.
- On "Save" for a field, calls `POST {apiBase}/api/settings/secrets` with body `{ service, key, value }`.
- Groups services by category.
- Shows a configured/not-configured badge per field.

---

## 3. Add a `/settings` route

If your app uses React Router, add the settings page as a route:

### React Router v5

```tsx
import { BrowserRouter as Router, Route, Switch } from 'react-router-dom';
import { SettingsPage } from './pages/SettingsPage';
import Dashboard from './pages/Dashboard';

function App() {
  return (
    <Router>
      <Switch>
        <Route path="/settings" component={SettingsPage} />
        <Route path="/" component={Dashboard} />
      </Switch>
    </Router>
  );
}
```

### React Router v6

```tsx
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { SettingsPage } from './pages/SettingsPage';
import Dashboard from './pages/Dashboard';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/settings" element={<SettingsPage />} />
        <Route path="/" element={<Dashboard />} />
      </Routes>
    </BrowserRouter>
  );
}
```

---

## 4. Backend: `/api/settings` endpoint

The `ConfigPanel` expects two endpoints on the app's backend.

### `GET /api/settings`

Returns the configured status of each service field (without exposing secret values).

**Response schema:**

```json
{
  "services": [
    {
      "id": "openweather",
      "configured": true,
      "fields": [
        { "key": "api_key", "configured": true }
      ]
    }
  ]
}
```

### `POST /api/settings/secrets`

Persists a single secret field to the keystore.

**Request body:**

```json
{
  "service": "openweather",
  "key": "api_key",
  "value": "sk-..."
}
```

**Response:** `{ "success": true, "service": "openweather", "key": "api_key" }`
after persistence succeeds.

---

### Python host adapters

`aviation_config.http.create_settings_router` is the optional FastAPI adapter.
It uses the common catalog and `AviationConfig.set` / `delete`, which persist
through `keystore.create_secret_loader` and the compiled Node bridge. No second
Python encryption implementation is needed.

```python
import os
from fastapi import FastAPI
from aviation_config import AviationConfig
from aviation_config.http import create_settings_router

app = FastAPI()
app.include_router(create_settings_router(
    AviationConfig("g1000-simulator"),
    write_token=os.environ.get("AVIATION_SETTINGS_TOKEN"),
    encryption_ready=len(os.environ.get("KEYSTORE_ENCRYPTION_KEY", "")) >= 32,
))
```

Select `AVIATION_KEYSTORE_BRIDGE` and `KEYSTORE_PATH` explicitly in runtime
packaging. A compiled provider, encryption key of at least 32 characters and
operator token of at least 32 characters are required for normal HTTP writes.
Without them, the endpoint stays read-only. The panel uses `write_access` from
GET status to show the access-token input or a read-only notice. Tokens stay in
component memory and are sent as a Bearer header; they are not settings values.
Invalid payloads and provider failures return generic errors without input,
provider stderr or secret values. DELETE accepts the same authorization policy.

Normal reads retain registered environment and historical app-namespace fallback.
A host can declare old field names through `legacy_aliases`; new writes always
use canonical service/field identities. Isolated reads disable every production
fallback and bypass cached values. They require an explicit store whose parent
is the SDK run ID, plus an app-bound signed credential on each settings request.
A normal provider rejects test-tagged stores even if given their path.

Private instances expose the shared fixture/status/run-cleanup protocol. Before
any test write, the encrypted store receives a tagged `e2e_runs` record containing
the app/run owner and expiry. Cleanup validates the entire store and app/run
metadata before deleting fields and the run record. Unknown entries and foreign
owners fail closed. Expired configuration reads and new writes fail; redacted inspection and
authenticated owned cleanup remain available. The outer SDK instance lease removes the private
filesystem after controller loss. These endpoints are absent in normal mode.

The portable configuration Component continues to own catalog/status semantics;
HTTP, authorization, secret storage and runtime packaging remain SDK adapters.

---

## 5. Service Registry

The full registry exported as `SERVICE_REGISTRY` from `@aviation/aviation-config`:

| Service ID | Name | Category | Env Vars | Apps |
|------------|------|----------|----------|------|
| `openweather` | OpenWeatherMap | weather | `OPENWEATHERMAP_API_KEY` | flight-planner, weather-briefing, g1000-simulator |
| `openaip` | OpenAIP | navigation | `OPENAIP_API_KEY` | flight-planner, g1000-simulator |
| `opentopography` | OpenTopography | navigation | `OPENTOPOGRAPHY_API_KEY` | flight-planner |
| `foreflight` | ForeFlight | navigation | `FOREFLIGHT_API_KEY`, `FOREFLIGHT_API_SECRET` | foreflight-dashboard |
| `google-oauth` | Google OAuth | auth | `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REDIRECT_URI` | flightschool |
| `smtp` | Email (SMTP) | monitoring | `MAIL_SERVER`, `MAIL_PORT`, `MAIL_USERNAME`, `MAIL_PASSWORD` | flightschool |
| `sentry` | Sentry | monitoring | `SENTRY_DSN` | all apps |
| `g1000-stream` | G1000 Stream API | streaming | `G1000_STREAM_API_KEY` | g1000-simulator |
| `database` | Database | database | `DATABASE_URL` | flightschool, foreflight-dashboard, flight-planner |
| `redis` | Redis | database | `REDIS_URL` | foreflight-dashboard, flight-planner |

Use `getServicesByApp(appId)` to retrieve only the services relevant to a specific app:

```ts
import { getServicesByApp } from '@aviation/aviation-config';

const myServices = getServicesByApp('g1000-simulator');
// Returns: openweather, openaip, sentry, g1000-stream
```

---

## 6. CLI alternative

If an app has no backend settings UI, users can configure services directly via the keystore CLI:

```bash
npm run keystore set <service> <key> <value>
# e.g.
npm run keystore set openweather api_key sk-abc123
npm run keystore set sentry dsn https://...@sentry.io/123
```


## Save confirmation

The shared `saveServiceSecret` client requires JSON `success: true` before the
panel marks a field configured. HTTP success alone is insufficient. A supplied
service/key confirmation must match the request; malformed, negative and foreign
confirmations fail. Error messages do not echo response bodies or submitted
secret values. Requests have a ten-second deadline. Host adapters remain responsible
for authorization and persistence; the portable catalog Component is unchanged.

The panel owns a light background so its text remains readable on dark host pages.
