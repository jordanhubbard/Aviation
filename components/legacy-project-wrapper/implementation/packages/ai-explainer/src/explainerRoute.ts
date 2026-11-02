import { Router as createRouter, json, type ErrorRequestHandler, type Request, type Response,
  type RequestHandler, type NextFunction } from 'express';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { ExplanationError, type ExplainerClient, type ExplanationState,
  type ExplanationTicket } from './ExplainerClient.js';
import type { HistoryMessage } from './protocol.js';
const widgetSource = readFileSync(join(__dirname, '../browser/widget.js'), 'utf8');

export interface ExplainRequestBody { context: string; question?: string; history?: HistoryMessage[] }
export type ExplainResponseBody = ExplanationTicket | ExplanationState;
export type ExplanationMiddleware = (request: IncomingMessage, response: ServerResponse,
  next: (error?: unknown) => void) => void;
export type ExplanationRouteOptions = {
  authorize?: (request: Request) => void;
  validateCallback?: (body: unknown) => void;
};

/** The same queued HTTP surface is embedded by Node apps and the SDK loopback broker. */
export function explainerRoute(client: ExplainerClient, options: ExplanationRouteOptions = {}): ExplanationMiddleware {
  const router = createRouter();
  router.use('/api/explain', (_request, response, next) => {
    response.set('Cache-Control', 'no-store');
    response.set('X-Content-Type-Options', 'nosniff');
    if (/^[a-z][a-z0-9-]{0,63}$/.test(client.appId)) response.set('X-Aviation-Application', client.appId);
    next();
  });
  const fail = (response: Response, error: unknown) => {
    if (!response.destroyed) response.status(error instanceof ExplanationError ? error.status : 503)
      .json({ error: error instanceof ExplanationError ? error.message : 'AI explanations are unavailable.' });
  };
  router.use('/api/explain', (request, response, next) => {
    try { options.authorize?.(request); next(); }
    catch (error) { fail(response, error); }
  });
  const respond = (operation: (request: Request) => unknown | Promise<unknown>, status = 200): RequestHandler =>
    async (request, response) => {
      try {
        const result = await operation(request);
        if (!response.destroyed) response.status(status).json(result);
      } catch (error) { fail(response, error); }
    };
  router.get('/api/explain/config', respond(() => ({ available: client.isConfigured() })));
  router.get('/api/explain/widget.js', (_request, response) => response.type('application/javascript').send(widgetSource));
  router.post('/api/explain', json({ limit: '256kb' }), async (request, response) => {
    if (!request.is('application/json')) { fail(response, new ExplanationError('input', 400)); return; }
    const controller = new AbortController();
    const disconnected = () => { if (!response.writableFinished) controller.abort(); };
    response.once('close', disconnected);
    try {
      const ticket = await client.submit(request.body, controller.signal);
      if (response.destroyed || controller.signal.aborted) {
        client.deleteRequest(ticket.requestId, ticket.accessToken);
      } else response.status(202).json(ticket);
    } catch (error) { fail(response, error); }
    finally { response.removeListener('close', disconnected); }
  });
  router.post('/api/explain/callback', json({ limit: '512kb' }), respond(request => {
    options.validateCallback?.(request.body);
    return { ok: true, status: client.receiveCallback(request.body) };
  }));
  router.get('/api/explain/requests/:requestId', respond(request =>
    client.getRequest(request.params.requestId, request.get('X-Aviation-Explain-Token'))));
  router.delete('/api/explain/requests/:requestId', respond(request => {
    client.deleteRequest(request.params.requestId, request.get('X-Aviation-Explain-Token'));
    return { deleted: true };
  }));
  const invalidBody: ErrorRequestHandler = (error, _request, response, _next) => {
    response.status(error?.type === 'entity.too.large' ? 413 : 400).json({ error: 'Invalid explanation request.' });
  };
  router.use(invalidBody);
  // Keep Express-version-specific request types inside the SDK boundary.
  return (request, response, next) => router(request as Request, response as Response, next as NextFunction);
}
