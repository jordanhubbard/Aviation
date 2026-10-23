import express from 'express';
import cors from 'cors';
import { createSecretLoader } from '@aviation/keystore';
import { createOpenClawClient } from '@aviation/shared-sdk';
import { loadAppContext } from './context';
import { getHistory, appendTurn } from './memory';
import { ExplainerClient, explainerRoute } from '@aviation/ai-explainer';

const app = express();
app.use(cors({ origin: true }));
app.use(express.json());

const secrets = createSecretLoader('aviation-chat');

// Resolve OpenClaw Gateway URL: env first (Railway/deploy), then keystore, then default.
function resolveBaseUrl(): string {
  const fromEnv =
    process.env.OPENCLAW_BASE_URL ||
    (process.env.OPENCLAW_GATEWAY_HOST
      ? `${process.env.OPENCLAW_GATEWAY_SCHEME || 'https'}://${process.env.OPENCLAW_GATEWAY_HOST}`
      : undefined);
  if (fromEnv) return fromEnv;
  const fromKeystore = secrets.get('OPENCLAW_BASE_URL') ?? secrets.get('OPENCLAW_GATEWAY_URL');
  return fromKeystore ?? 'http://localhost:31415';
}

// Resolve API key/password: env first (Railway/deploy), then keystore.
function resolveApiKey(): string | undefined {
  const fromEnv =
    process.env.OPENCLAW_API_KEY ||
    process.env.OPENCLAW_GATEWAY_TOKEN ||
    process.env.OPENCLAW_GATEWAY_PASSWORD;
  if (fromEnv) return fromEnv;
  return (
    secrets.get('OPENCLAW_API_KEY') ??
    secrets.get('OPENCLAW_GATEWAY_TOKEN') ??
    secrets.get('OPENCLAW_GATEWAY_PASSWORD')
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

// AI decision explanation endpoint
const explainer = new ExplainerClient({
  brainUrl: process.env['RCC_BRAIN_URL'] ?? 'http://146.190.134.110:8789/api/brain/request',
});
app.use(/* @ts-ignore Express 5 Router type issue */ explainerRoute(explainer) as any);

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', service: 'aviation-chat' });
});

const port = Number(process.env.PORT ?? 31416);
app.listen(port, () => {
  console.log(`Aviation Chat proxy listening on port ${port}`);
  if (!apiKey) {
    console.warn(
      'OpenClaw API key not set; /chat will return 503. Set OPENCLAW_API_KEY (or OPENCLAW_GATEWAY_TOKEN / OPENCLAW_GATEWAY_PASSWORD) in environment or keystore.'
    );
  }
});
