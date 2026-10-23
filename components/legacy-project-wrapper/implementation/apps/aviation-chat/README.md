# Aviation Chat (OpenClaw proxy)

> Part of the [Aviation Monorepo](../../README.md)

Proxy service for OpenClaw in-app chat. Receives requests from app UIs, loads each app's **CLAUDE.md** (or **AI_CONTEXT.md**) as context, and forwards to the OpenClaw Gateway with user and app identity. Keeps conversation history in memory per (userId, appId, conversationId) so multi-turn works.

**Railway (and other platforms):** Config is read from **environment variables first**, then keystore. Set `OPENCLAW_GATEWAY_HOST` (or `OPENCLAW_BASE_URL`) and `OPENCLAW_API_KEY` (or `OPENCLAW_GATEWAY_TOKEN` / `OPENCLAW_GATEWAY_PASSWORD`) in the Railway service so the proxy can reach OpenClaw without a local key vault.

## Quick start

```bash
cd apps/aviation-chat
make build
make start
```

Default port: **31416**. Override with `PORT`. Point OpenClaw Gateway URL with `OPENCLAW_BASE_URL` (default `http://localhost:31415`).

## API

### POST /chat

Request body:

```json
{
  "userId": "string (required)",
  "appId": "string (required, e.g. flight-planner)",
  "message": "string (required)",
  "conversationId": "string (optional)"
}
```

Response:

```json
{
  "content": "Assistant reply text",
  "model": "optional model id",
  "finishReason": "optional"
}
```

### GET /health

Returns `{ "status": "ok", "service": "aviation-chat" }`.

## Configuration

Configuration is resolved **environment variables first** (for Railway and other platforms without a local keystore), **then keystore** (for local/dev). This makes the proxy deployable on Railway by setting env vars only.

### OpenClaw Gateway URL

- **`OPENCLAW_BASE_URL`** – Full Gateway URL (e.g. `https://openclaw.example.com`). Preferred when you have the full URL.
- **`OPENCLAW_GATEWAY_HOST`** – Gateway hostname only; URL is built as `OPENCLAW_GATEWAY_SCHEME://OPENCLAW_GATEWAY_HOST` (e.g. `openclaw.up.railway.app`).
- **`OPENCLAW_GATEWAY_SCHEME`** – Optional; used with `OPENCLAW_GATEWAY_HOST` (default `https`).
- Keystore fallback: `OPENCLAW_BASE_URL` or `OPENCLAW_GATEWAY_URL` for service `aviation-chat`.
- Default when unset: `http://localhost:31415`.

### OpenClaw API key / password

- **`OPENCLAW_API_KEY`** or **`OPENCLAW_GATEWAY_TOKEN`** or **`OPENCLAW_GATEWAY_PASSWORD`** – Gateway auth (env vars; use on Railway).
- Keystore fallback: same key names for service `aviation-chat`.

### App context files

By default the proxy looks for `apps/<appId>/CLAUDE.md` or `AI_CONTEXT.md` under `process.cwd()/apps`. Override app root with **`APPS_ROOT`** (e.g. `/app/apps` in Docker/Railway).

## Memory

Conversation history is kept in memory per (userId, appId, conversationId). Last 10 user/assistant pairs are sent to OpenClaw as `history` so the model has prior context. No persistence across restarts.

## CORS

CORS is enabled for all origins so app frontends can call the proxy. Restrict in production (e.g. specific app origins) if needed.
