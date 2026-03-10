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

**Response:** `{ "ok": true }` on success.

---

### FastAPI (Python) example

```python
from fastapi import FastAPI
from pydantic import BaseModel
from keystore import Keystore  # @aviation/keystore Python client

app = FastAPI()
ks = Keystore()


@app.get("/api/settings")
async def get_settings():
    from aviation_config import SERVICE_REGISTRY  # or inline the registry
    services = []
    for svc in SERVICE_REGISTRY:
        field_statuses = []
        for field in svc["fields"]:
            env_var = field["envVar"]
            value = ks.get(svc["id"], field["key"])
            field_statuses.append({"key": field["key"], "configured": bool(value)})
        services.append({
            "id": svc["id"],
            "configured": all(f["configured"] for f in field_statuses if svc["fields"][i]["required"]),
            "fields": field_statuses,
        })
    return {"services": services}


class SecretPayload(BaseModel):
    service: str
    key: str
    value: str


@app.post("/api/settings/secrets")
async def set_secret(payload: SecretPayload):
    ks.set(payload.service, payload.key, payload.value)
    return {"ok": True}
```

---

### Flask (Python) example

```python
from flask import Flask, request, jsonify
from keystore import Keystore

app = Flask(__name__)
ks = Keystore()


@app.get("/api/settings")
def get_settings():
    # Build service status list (same logic as FastAPI example above)
    return jsonify({"services": build_service_statuses(ks)})


@app.post("/api/settings/secrets")
def set_secret():
    data = request.get_json()
    ks.set(data["service"], data["key"], data["value"])
    return jsonify({"ok": True})
```

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
