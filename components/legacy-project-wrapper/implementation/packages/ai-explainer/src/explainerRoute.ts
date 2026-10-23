import type { Request, Response, Router } from 'express';
import { Router as createRouter } from 'express';
import type { ExplainerClient } from './ExplainerClient.js';

export interface ExplainRequestBody {
  context: string;
  question?: string;
}

export interface ExplainResponseBody {
  explanation: string;
}

export function explainerRoute(client: ExplainerClient): Router {
  const router = createRouter();

  router.post(
    '/api/explain',
    async (req: Request, res: Response): Promise<void> => {
      const { context, question } = req.body as ExplainRequestBody;

      if (typeof context !== 'string' || context.trim() === '') {
        res.status(400).json({ error: 'context is required and must be a non-empty string' });
        return;
      }

      try {
        const explanation = await client.explain(context, question);
        const body: ExplainResponseBody = { explanation };
        res.json(body);
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        res.status(502).json({ error: `AI explainer failed: ${message}` });
      }
    }
  );

  return router;
}
