import express from 'express';
import cors from 'cors';
import { createSecretLoader } from '@aviation/keystore';
import { createHealthReport, createOpenClawClient } from '@aviation/shared-sdk';
import { loadAppContext } from './context';
import { getHistory, appendTurn } from './memory';
import { createExplanationRuntime } from '@aviation/ai-explainer';
import { tagTestData, verifyE2EHeaders } from '@aviation/shared-sdk/e2e';

const app = express();
app.use(cors({ origin: true }));
const explanation = createExplanationRuntime('aviation-chat');
const isolatedRun = process.env.AVIATION_E2E_RUN_ID;
app.use(explanation.middleware);
app.use(express.json());
app.use((req, res, next) => {
  try {
    const runId = verifyE2EHeaders('aviation-chat', req.headers, process.env.AVIATION_E2E_SECRET);
    if (req.path === '/chat' && ((isolatedRun && runId !== isolatedRun) || (!isolatedRun && runId))) {
      return res.status(403).json({ error: 'E2E credential rejected' });
    }
    if (runId && req.path !== '/chat') return res.status(403).json({ error: 'E2E route not supported' });
    res.locals.e2eRunId = runId;
    return next();
  } catch (_error) { return res.status(403).json({ error: 'Invalid E2E credentials' }); }
});

app.get('/', (_req, res) => {
  res.type('html').send(`<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Aviation Chat</title><link rel="icon" href="data:,"></head><body>
<main><h1>Aviation Chat</h1>
<p>This service provides chat to Aviation applications through an API. It does not have a standalone chat interface.</p>
<p>Applications send requests to <code>POST /chat</code>. The service can forward them to an optional OpenClaw gateway when configured.</p>
<p><a href="/health">Service health</a></p></main>
<script type="module">
  import '/api/explain/widget.js';
  window.AviationExplain.registerContext(() => (${JSON.stringify({
    application: 'Aviation Chat', decision: 'Chat request acceptance and conversation scope',
    requiredFields: ['userId', 'appId', 'message'],
    conversationScope: 'User, application and optional conversation identity',
    gatewayConfigured: Boolean(apiKey),
  }).replace(/</g, '\\u003c')}),
  'Explain the chat request requirements and conversation scope using these supplied facts.');
</script>
<script defer data-aviation-app="aviation-chat" src="https://meta-app.jordanhubbard.net/feedback-widget.js"></script></body></html>`);
});

const secrets = isolatedRun ? undefined : createSecretLoader('aviation-chat');

// Resolve OpenClaw Gateway URL: env first (Railway/deploy), then keystore, then default.
function resolveBaseUrl(): string {
  if (isolatedRun) return 'http://127.0.0.1';
  const fromEnv =
    process.env.OPENCLAW_BASE_URL ||
    (process.env.OPENCLAW_GATEWAY_HOST
      ? `${process.env.OPENCLAW_GATEWAY_SCHEME || 'https'}://${process.env.OPENCLAW_GATEWAY_HOST}`
      : undefined);
  if (fromEnv) return fromEnv;
  const fromKeystore = secrets?.get('OPENCLAW_BASE_URL') ?? secrets?.get('OPENCLAW_GATEWAY_URL');
  return fromKeystore ?? 'http://localhost:31415';
}

// Resolve API key/password: env first (Railway/deploy), then keystore.
function resolveApiKey(): string | undefined {
  if (isolatedRun) return undefined;
  const fromEnv =
    process.env.OPENCLAW_API_KEY ||
    process.env.OPENCLAW_GATEWAY_TOKEN ||
    process.env.OPENCLAW_GATEWAY_PASSWORD;
  if (fromEnv) return fromEnv;
  return (
    secrets?.get('OPENCLAW_API_KEY') ??
    secrets?.get('OPENCLAW_GATEWAY_TOKEN') ??
    secrets?.get('OPENCLAW_GATEWAY_PASSWORD')
  );
}

const baseUrl = resolveBaseUrl();
const apiKey = resolveApiKey();

interface ChatBody {
  userId: string;
  appId: string;
  message: string;
  conversationId?: string;
}

app.post('/chat', async (req, res) => {
  try {
    const { userId, appId, message } = req.body as ChatBody;
    if (!userId || !appId || !message || typeof message !== 'string') {
      res.status(400).json({
        error: 'Missing or invalid body: userId, appId, and message (string) are required',
      });
      return;
    }
    const conversationId = typeof req.body.conversationId === 'string' ? req.body.conversationId : undefined;

    if (res.locals.e2eRunId) {
      // Exercise the public chat contract without calling the gateway or writing memory.
      res.json(tagTestData(res.locals.e2eRunId, {
        content: `Synthetic Aviation chat response for ${appId}`,
        model: 'e2e-mock', finishReason: 'stop',
      }));
      return;
    }

    if (!apiKey) {
      res.status(503).json({
        error:
          'OpenClaw API key not configured. Set OPENCLAW_API_KEY (or OPENCLAW_GATEWAY_TOKEN / OPENCLAW_GATEWAY_PASSWORD) in environment or keystore for service aviation-chat.',
      });
      return;
    }

    const appContextPrefix = loadAppContext(appId);
    const history = getHistory(userId, appId, conversationId);

    const client = createOpenClawClient({ baseUrl, apiKey });
    const result = await client.sendMessage({
      message,
      userId,
      appId,
      appContextPrefix: appContextPrefix || undefined,
      conversationId,
      history: history.length ? history : undefined,
    });

    appendTurn(userId, appId, 'user', message, conversationId);
    appendTurn(userId, appId, 'assistant', result.content, conversationId);

    res.json({ content: result.content, model: result.model, finishReason: result.finishReason });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('/chat error:', message);
    res.status(500).json({ error: message });
  }
});

app.get('/health', (_req, res) => {
  res.json(createHealthReport({ service: 'aviation-chat' }));
});

const port = Number(process.env.PORT ?? 31416);
const server = app.listen(port, () => {
  console.log(`Aviation Chat proxy listening on port ${port}`);
  if (!apiKey && !isolatedRun) {
    console.warn(
      'OpenClaw API key not set; /chat will return 503. Set OPENCLAW_API_KEY (or OPENCLAW_GATEWAY_TOKEN / OPENCLAW_GATEWAY_PASSWORD) in environment or keystore.'
    );
  }
});
server.once('close', () => explanation.close());
