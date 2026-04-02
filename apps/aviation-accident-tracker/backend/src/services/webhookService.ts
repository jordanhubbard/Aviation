/**
 * webhookService.ts — Webhook subscription and delivery service.
 *
 * Allows external systems to subscribe to aviation accident events.
 * Subscriptions are stored in-memory (suitable for development; swap the
 * subscriptions Map for a persistent store in production).
 *
 * Delivery features:
 *   - HMAC-SHA256 request signing (X-Webhook-Signature header)
 *   - Exponential-backoff retry (up to maxRetries attempts)
 *   - Per-subscription event filtering (eventTypes array)
 *   - Delivery history ring (last 50 attempts per subscription)
 *   - Configurable timeout per delivery (default 10s)
 */

import { createHmac, randomBytes } from 'node:crypto';
import type { EventRecord } from '../types/event.js';

// ── Types ─────────────────────────────────────────────────────────────────────

export type WebhookEventType =
  | 'event.created'
  | 'event.updated'
  | 'event.deleted'
  | 'ingest.completed'
  | 'ingest.failed';

export interface WebhookSubscription {
  id:          string;
  url:          string;
  secret:       string;      // HMAC signing secret
  eventTypes:   WebhookEventType[];
  active:       boolean;
  createdAt:    string;
  description?: string;
}

export interface WebhookPayload {
  id:         string;
  event:      WebhookEventType;
  ts:         string;
  data:       unknown;
}

export interface DeliveryAttempt {
  id:         string;
  ts:         string;
  status:     number | null;  // HTTP status, or null if network error
  success:    boolean;
  durationMs: number;
  error?:     string;
}

export interface DispatchResult {
  subscriptionId: string;
  attempts:       DeliveryAttempt[];
  delivered:      boolean;
}

export interface WebhookServiceOptions {
  /** Maximum delivery attempts per dispatch (default 3) */
  maxRetries?: number;
  /** Base backoff delay in ms for retries (default 1000) */
  retryBaseMs?: number;
  /** Per-delivery fetch timeout in ms (default 10_000) */
  timeoutMs?: number;
  /** Maximum delivery history entries per subscription (default 50) */
  historySize?: number;
}

// ── WebhookService ────────────────────────────────────────────────────────────

export class WebhookService {
  private readonly subscriptions = new Map<string, WebhookSubscription>();
  private readonly history        = new Map<string, DeliveryAttempt[]>();

  private readonly maxRetries:  number;
  private readonly retryBaseMs: number;
  private readonly timeoutMs:   number;
  private readonly historySize: number;

  constructor(options: WebhookServiceOptions = {}) {
    this.maxRetries  = options.maxRetries  ?? 3;
    this.retryBaseMs = options.retryBaseMs ?? 1_000;
    this.timeoutMs   = options.timeoutMs   ?? 10_000;
    this.historySize = options.historySize ?? 50;
  }

  // ── HMAC signing ────────────────────────────────────────────────────────────

  /**
   * Compute HMAC-SHA256 signature for a JSON body string.
   * Returns the hex digest prefixed with "sha256=" (GitHub webhook style).
   */
  sign(body: string, secret: string): string {
    return 'sha256=' + createHmac('sha256', secret).update(body, 'utf8').digest('hex');
  }

  /**
   * Verify a webhook signature.
   */
  verify(body: string, signature: string, secret: string): boolean {
    const expected = this.sign(body, secret);
    // Constant-time comparison
    if (expected.length !== signature.length) return false;
    let diff = 0;
    for (let i = 0; i < expected.length; i++) {
      diff |= expected.charCodeAt(i) ^ signature.charCodeAt(i);
    }
    return diff === 0;
  }

  // ── Subscription management ─────────────────────────────────────────────────

  register(params: {
    url:          string;
    secret?:      string;
    eventTypes?:  WebhookEventType[];
    description?: string;
  }): WebhookSubscription {
    if (!params.url || !params.url.startsWith('http')) {
      throw new Error('url must be a valid http/https URL');
    }
    const id = randomBytes(12).toString('hex');
    const sub: WebhookSubscription = {
      id,
      url:        params.url,
      secret:     params.secret ?? randomBytes(32).toString('hex'),
      eventTypes: params.eventTypes ?? ['event.created', 'event.updated'],
      active:     true,
      createdAt:  new Date().toISOString(),
      description: params.description,
    };
    this.subscriptions.set(id, sub);
    this.history.set(id, []);
    return sub;
  }

  listSubscriptions(): WebhookSubscription[] {
    return [...this.subscriptions.values()];
  }

  getSubscription(id: string): WebhookSubscription | undefined {
    return this.subscriptions.get(id);
  }

  deleteSubscription(id: string): boolean {
    this.history.delete(id);
    return this.subscriptions.delete(id);
  }

  setActive(id: string, active: boolean): boolean {
    const sub = this.subscriptions.get(id);
    if (!sub) return false;
    sub.active = active;
    return true;
  }

  getHistory(subscriptionId: string): DeliveryAttempt[] {
    return this.history.get(subscriptionId) ?? [];
  }

  // ── Delivery ────────────────────────────────────────────────────────────────

  /**
   * Dispatch an event to all matching active subscriptions.
   * Returns one DispatchResult per subscription that was attempted.
   */
  async dispatch(eventType: WebhookEventType, data: unknown): Promise<DispatchResult[]> {
    const payload: WebhookPayload = {
      id:    randomBytes(8).toString('hex'),
      event: eventType,
      ts:    new Date().toISOString(),
      data,
    };
    const body = JSON.stringify(payload);

    const results: DispatchResult[] = [];
    for (const sub of this.subscriptions.values()) {
      if (!sub.active) continue;
      if (!sub.eventTypes.includes(eventType)) continue;
      results.push(await this._deliverToSubscription(sub, body));
    }
    return results;
  }

  /**
   * Deliver to a single subscription with retry + exponential backoff.
   */
  private async _deliverToSubscription(
    sub: WebhookSubscription,
    body: string,
  ): Promise<DispatchResult> {
    const signature = this.sign(body, sub.secret);
    const attempts: DeliveryAttempt[] = [];
    let delivered = false;

    for (let attempt = 0; attempt < this.maxRetries; attempt++) {
      if (attempt > 0) {
        // Exponential backoff: 1s, 2s, 4s, …
        const delay = this.retryBaseMs * Math.pow(2, attempt - 1);
        await new Promise(r => setTimeout(r, delay));
      }

      const attemptId = randomBytes(6).toString('hex');
      const start     = Date.now();

      try {
        const resp = await fetch(sub.url, {
          method:  'POST',
          headers: {
            'Content-Type':        'application/json',
            'X-Webhook-Event':     body.includes('"event":"') ? 'webhook' : 'event',
            'X-Webhook-Signature': signature,
            'X-Webhook-Id':        attemptId,
          },
          body,
          signal: AbortSignal.timeout(this.timeoutMs),
        });

        const dur = Date.now() - start;
        const ok  = resp.status >= 200 && resp.status < 300;
        const rec: DeliveryAttempt = {
          id: attemptId, ts: new Date().toISOString(),
          status: resp.status, success: ok, durationMs: dur,
        };
        attempts.push(rec);
        this._appendHistory(sub.id, rec);

        if (ok) { delivered = true; break; }
        // Non-2xx — retry if attempts remain
      } catch (err) {
        const dur = Date.now() - start;
        const msg = err instanceof Error ? err.message : String(err);
        const rec: DeliveryAttempt = {
          id: attemptId, ts: new Date().toISOString(),
          status: null, success: false, durationMs: dur, error: msg,
        };
        attempts.push(rec);
        this._appendHistory(sub.id, rec);
        // Network error — retry
      }
    }

    return { subscriptionId: sub.id, attempts, delivered };
  }

  private _appendHistory(subscriptionId: string, attempt: DeliveryAttempt): void {
    const ring = this.history.get(subscriptionId);
    if (!ring) return;
    ring.push(attempt);
    if (ring.length > this.historySize) ring.splice(0, ring.length - this.historySize);
  }

  // ── Convenience: dispatch for EventRecord lifecycle events ─────────────────

  async notifyEventCreated(event: EventRecord): Promise<DispatchResult[]> {
    return this.dispatch('event.created', event);
  }

  async notifyEventUpdated(event: EventRecord): Promise<DispatchResult[]> {
    return this.dispatch('event.updated', event);
  }

  async notifyIngestCompleted(summary: {
    source:   string;
    ingested: number;
    updated:  number;
    skipped:  number;
    duration: number;
  }): Promise<DispatchResult[]> {
    return this.dispatch('ingest.completed', summary);
  }
}
