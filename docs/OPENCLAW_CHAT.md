# OpenClaw in-app chat

Apps in the Aviation monorepo can offer an in-app chat so users can ask OpenClaw for advice in the context of that application. Identity (user and app) and app-specific context are sent with each request so OpenClaw can give relevant answers and keep conversation memory.

## Architecture

- **Frontend:** Each app embeds the shared `ChatPanel` component from `@aviation/ui-framework` (or `@aviation/ui-framework/chat`). The component sends messages to the aviation-chat proxy; no API key is exposed in the browser.
- **Proxy:** The `apps/aviation-chat` service receives `POST /chat` with `{ userId, appId, message, conversationId? }`, loads the app's **CLAUDE.md** (or **AI_CONTEXT.md**), and calls the OpenClaw Gateway via the shared-sdk client. Conversation history is kept in memory per (userId, appId, conversationId).
- **Context:** Per-app **CLAUDE.md** (or **AI_CONTEXT.md**) at the app root describes what the app does, main features, and key concepts so OpenClaw can give app-specific advice without reading the repo.

## Adding chat to an app

1. **Add a CLAUDE.md** (or AI_CONTEXT.md) at the app root, e.g. `apps/my-app/CLAUDE.md`. Keep it to 1–2 screens: what the app does, main features, key terms, and brief data shapes. See `apps/flight-planner/CLAUDE.md` for an example.
2. **Embed ChatPanel** in your UI:
   ```tsx
   import { ChatPanel } from '@aviation/ui-framework/chat';

   <ChatPanel
     appId="my-app"
     userId={user?.id ?? anonymousId}
     apiBaseUrl="http://localhost:31416"
     title="Chat"
     placeholder="Ask OpenClaw..."
   />
   ```
3. **Point users at the proxy:** Ensure the aviation-chat proxy is running (default port 31416) and set `apiBaseUrl` to its URL (e.g. from env `VITE_AVIATION_CHAT_URL`).

## Configuring the proxy

The proxy resolves config **environment variables first**, then **keystore**. So on Railway (or any platform without a key vault), set the env vars below; locally you can use the keystore as fallback.

### Environment variables (Railway / deploy)

- **Gateway URL:**  
  - `OPENCLAW_BASE_URL` – full URL (e.g. `https://openclaw.example.com`), or  
  - `OPENCLAW_GATEWAY_HOST` – hostname only (e.g. `openclaw.up.railway.app`); URL is built as `OPENCLAW_GATEWAY_SCHEME://OPENCLAW_GATEWAY_HOST` (default scheme `https`).  
  - Optional: `OPENCLAW_GATEWAY_SCHEME` (e.g. `https`).
- **Gateway auth:** one of  
  - `OPENCLAW_API_KEY`  
  - `OPENCLAW_GATEWAY_TOKEN`  
  - `OPENCLAW_GATEWAY_PASSWORD`

### Keystore (local / fallback)

For service name `aviation-chat`:

```bash
npm run keystore set aviation-chat OPENCLAW_API_KEY "your-openclaw-gateway-token"
npm run keystore set aviation-chat OPENCLAW_BASE_URL "https://openclaw.example.com"
```

Or use `OPENCLAW_GATEWAY_TOKEN` / `OPENCLAW_GATEWAY_PASSWORD` and `OPENCLAW_GATEWAY_URL`. The proxy checks env first, then keystore.

### App context path

By default the proxy reads `apps/<appId>/CLAUDE.md` or `AI_CONTEXT.md` under `process.cwd()/apps`. Override with `APPS_ROOT` if needed (e.g. in Docker/Railway).

## Memory

The proxy keeps the last 10 user/assistant pairs per (userId, appId, conversationId) and sends them as `history` to OpenClaw so multi-turn conversations work. Pass an optional `conversationId` from the frontend to scope conversations (e.g. per tab or thread). No persistence across proxy restarts.

## Railway deployment

On Railway (and similar platforms) the proxy has no access to a local keystore. Set these **environment variables** in the Railway service for `aviation-chat`:

| Variable | Description |
|----------|-------------|
| `OPENCLAW_GATEWAY_HOST` | OpenClaw Gateway hostname (e.g. `openclaw.up.railway.app`), or use `OPENCLAW_BASE_URL` for the full URL |
| `OPENCLAW_GATEWAY_SCHEME` | Optional; `https` (default) or `http` when using `OPENCLAW_GATEWAY_HOST` |
| `OPENCLAW_API_KEY` | Gateway auth token/password (or `OPENCLAW_GATEWAY_TOKEN` / `OPENCLAW_GATEWAY_PASSWORD`) |

Config is resolved **env first, then keystore**, so a key vault is optional when env vars are set.

## File convention

- **CLAUDE.md** (recommended) or **AI_CONTEXT.md** at each app root.
- Same content format; the proxy checks both names. Use one consistently per app.
