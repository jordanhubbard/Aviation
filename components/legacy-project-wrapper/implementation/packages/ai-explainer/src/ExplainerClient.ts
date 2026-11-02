import { randomBytes, timingSafeEqual } from 'node:crypto';
import { acceptQueuedResponse, isRecord, normalizeExplanationInput,
  validateExplanationCallback, type ExplanationResult, type HistoryMessage } from './protocol.js';

export type ProviderConfiguration = { brainUrl?: string; apiToken?: string; publicBaseUrl?: string };
export interface ExplainerClientOptions {
  appId?: string; brainUrl?: string; apiToken?: string; publicBaseUrl?: string;
  timeoutMs?: number; submissionTimeoutMs?: number; maxPending?: number;
  maxRequestsPerMinute?: number;
  configuration?: () => ProviderConfiguration | undefined;
  beforeSubmit?: () => void;
  fetch?: typeof globalThis.fetch; now?: () => number;
  metadata?: Readonly<Record<string, unknown>>;
}
export interface BrainRequest {
  messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>;
  maxTokens: number; priority: 'normal'; callbackUrl: string;
  metadata: Record<string, unknown>;
}
export interface BrainResponse { ok: true; requestId: string; status: 'queued' }
export type ExplanationTicket = {
  requestId: string; accessToken: string; status: 'queued'; expiresAt: string; pollAfterMs: number;
};
export type ExplanationState = {
  requestId: string; status: 'queued' | 'completed'; expiresAt: string;
} & Partial<ExplanationResult>;

const MESSAGES: Readonly<Record<string, string>> = {
  configuration: 'AI explanations are not configured for this application.',
  unavailable: 'AI explanations are unavailable.', input: 'Invalid explanation request.',
  capacity: 'Too many explanation requests. Try again later.',
  provider: 'The AI provider could not accept this request.',
  timeout: 'The AI explanation request timed out.', missing: 'Explanation request was not found.',
  duplicate: 'The explanation request is already complete.',
  access: 'Explanation access was not authorized.',
  fixture: 'Explanation fixtures are not initialized or have expired.',
};
export class ExplanationError extends Error {
  constructor(public readonly code: string, public readonly status: number) {
    super(MESSAGES[code] ?? MESSAGES.unavailable);
    this.name = 'ExplanationError';
  }
}
type Job = {
  id: string; token: string; nonce: string; expires: number;
  providerId?: string; result?: ExplanationResult;
  early?: { providerId: string; result: ExplanationResult };
  timer: ReturnType<typeof setTimeout>; abort: AbortController;
};

function absoluteHttpUrl(value: string | undefined): URL | undefined {
  try {
    const url = new URL(value ?? '');
    return ['http:', 'https:'].includes(url.protocol) && !url.username && !url.password
      && !url.hash && !url.search ? url : undefined;
  } catch { return undefined; }
}
function integerOption(value: number | undefined, fallback: number, maximum: number): number {
  const selected = value ?? fallback;
  if (!Number.isSafeInteger(selected) || selected < 1 || selected > maximum) {
    throw new ExplanationError('configuration', 503);
  }
  return selected;
}
async function untilAborted<T>(signal: AbortSignal, operation: () => Promise<T>): Promise<T> {
  if (signal.aborted) throw new ExplanationError('timeout', 504);
  return new Promise<T>((resolve, reject) => {
    const abort = () => reject(new ExplanationError('timeout', 504));
    signal.addEventListener('abort', abort, { once: true });
    Promise.resolve().then(() => {
      if (signal.aborted) throw new ExplanationError('timeout', 504);
      return operation();
    }).then(value => {
      signal.removeEventListener('abort', abort); resolve(value);
    }, error => {
      signal.removeEventListener('abort', abort); reject(error);
    });
  });
}
async function boundedQueueBody(response: Response, signal: AbortSignal): Promise<unknown> {
  if (!response.body) throw new ExplanationError('provider', 502);
  const reader = response.body.getReader();
  const abort = () => { void reader.cancel().catch(() => undefined); };
  signal.addEventListener('abort', abort, { once: true });
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      if (signal.aborted) throw new ExplanationError('timeout', 504);
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > 65_536) throw new ExplanationError('provider', 502);
      chunks.push(value);
    }
    return JSON.parse(Buffer.concat(chunks).toString('utf8')) as unknown;
  } finally {
    signal.removeEventListener('abort', abort);
    void reader.cancel().catch(() => undefined);
  }
}

/** One transient request registry per application instance, shared by its HTTP workers. */
export class ExplainerClient {
  public readonly appId: string;
  private readonly configuration: () => ProviderConfiguration | undefined;
  private readonly beforeSubmit?: () => void;
  private readonly timeoutMs: number;
  private readonly submissionTimeoutMs: number;
  private readonly maxPending: number;
  private readonly maxRequestsPerMinute: number;
  private requestTimes: number[] = [];
  private readonly fetchImpl: typeof globalThis.fetch;
  private readonly now: () => number;
  private readonly metadata: Readonly<Record<string, unknown>>;
  private readonly jobs = new Map<string, Job>();
  private readonly nonces = new Map<string, Job>();
  private closed = false;

  constructor(options: ExplainerClientOptions = {}) {
    this.appId = options.appId ?? '';
    const selected = { brainUrl: options.brainUrl, publicBaseUrl: options.publicBaseUrl, apiToken: options.apiToken };
    this.configuration = options.configuration ?? (() => selected);
    this.beforeSubmit = options.beforeSubmit;
    this.timeoutMs = integerOption(options.timeoutMs, 120_000, 300_000);
    this.submissionTimeoutMs = integerOption(options.submissionTimeoutMs, 10_000, 30_000);
    this.maxPending = integerOption(options.maxPending, 32, 256);
    this.maxRequestsPerMinute = integerOption(options.maxRequestsPerMinute, 16, 256);
    this.fetchImpl = options.fetch ?? globalThis.fetch;
    this.now = options.now ?? Date.now;
    this.metadata = { ...options.metadata };
  }
  private providerConfiguration(): { brainUrl: URL; publicUrl: URL; apiToken: string } | undefined {
    if (this.closed || !/^[a-z][a-z0-9-]{0,63}$/.test(this.appId)) return undefined;
    try {
      const selected = this.configuration();
      const brainUrl = absoluteHttpUrl(selected?.brainUrl);
      const publicUrl = absoluteHttpUrl(selected?.publicBaseUrl);
      return brainUrl && publicUrl && typeof selected?.apiToken === 'string' && /^[!-~]{1,4096}$/.test(selected.apiToken)
        ? { brainUrl, publicUrl, apiToken: selected.apiToken } : undefined;
    } catch { return undefined; }
  }
  isConfigured(): boolean { return this.providerConfiguration() !== undefined; }
  private remove(job: Job): void {
    if (this.jobs.get(job.id) !== job) return;
    clearTimeout(job.timer);
    job.abort.abort();
    this.jobs.delete(job.id);
    this.nonces.delete(job.nonce);
    job.early = undefined;
    job.result = undefined;
  }
  private prune(): void {
    for (const job of this.jobs.values()) if (job.expires <= this.now()) this.remove(job);
  }
  get activeRequests(): number { this.prune(); return this.jobs.size; }
  listRequests(): Array<{ requestId: string; status: 'queued' | 'completed' }> {
    this.prune();
    return [...this.jobs.values()].map(job => ({ requestId: job.id, status: job.result ? 'completed' : 'queued' }));
  }
  clearRequests(): void {
    for (const job of this.jobs.values()) this.remove(job);
    this.requestTimes = [];
  }

  async submit(value: unknown, signal?: AbortSignal): Promise<ExplanationTicket> {
    let input;
    try { input = normalizeExplanationInput(value); }
    catch { throw new ExplanationError('input', 400); }
    try { this.beforeSubmit?.(); }
    catch (error) {
      if (error instanceof ExplanationError) throw error;
      throw new ExplanationError('unavailable', 503);
    }
    const configuration = this.providerConfiguration();
    if (!configuration) throw new ExplanationError('configuration', 503);
    if (signal?.aborted) throw new ExplanationError('timeout', 504);
    this.prune();
    if (this.jobs.size >= this.maxPending) throw new ExplanationError('capacity', 429);
    this.requestTimes = this.requestTimes.filter(time => time > this.now() - 60_000);
    if (this.requestTimes.length >= this.maxRequestsPerMinute) throw new ExplanationError('capacity', 429);
    this.requestTimes.push(this.now());
    const id = `exp_${randomBytes(16).toString('hex')}`;
    const nonce = randomBytes(32).toString('hex');
    const token = randomBytes(32).toString('hex');
    const expires = this.now() + this.timeoutMs;
    const job: Job = { id, token, nonce, expires, abort: new AbortController(),
      timer: setTimeout(() => this.remove(job), this.timeoutMs) };
    job.timer.unref();
    this.jobs.set(id, job);
    this.nonces.set(nonce, job);
    const cancel = () => this.remove(job);
    signal?.addEventListener('abort', cancel, { once: true });
    const body: BrainRequest = {
      messages: [
        { role: 'system', content: 'Explain the supplied Aviation application decision using only its facts. Distinguish facts from inference and uncertainty. Do not invent weather, restrictions, clearances or calculations. Do not present an explanation as flight authorization.' },
        { role: 'user', content: input.context }, ...input.history,
        { role: 'user', content: input.question },
      ],
      maxTokens: 768, priority: 'normal',
      callbackUrl: new URL('/api/explain/callback', configuration.publicUrl).toString(),
      metadata: { ...this.metadata, aviation_app_id: this.appId, aviation_callback_nonce: nonce },
    };
    const submissionTimer = setTimeout(() => job.abort.abort(), Math.min(this.submissionTimeoutMs, this.timeoutMs));
    submissionTimer.unref();
    try {
      job.providerId = await untilAborted(job.abort.signal, async () => {
        const response = await this.fetchImpl(configuration.brainUrl.toString(), {
          method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${configuration.apiToken}` },
          body: JSON.stringify(body), signal: job.abort.signal,
        });
        return acceptQueuedResponse(response.status, await boundedQueueBody(response, job.abort.signal));
      });
      if (this.jobs.get(id) !== job || job.expires <= this.now()) throw new ExplanationError('timeout', 504);
      if (job.early?.providerId === job.providerId) job.result = job.early.result;
      job.early = undefined;
      return { requestId: id, accessToken: token, status: 'queued',
        expiresAt: new Date(expires).toISOString(), pollAfterMs: 500 };
    } catch (error) {
      const aborted = job.abort.signal.aborted;
      this.remove(job);
      if (error instanceof ExplanationError) throw error;
      throw new ExplanationError(aborted ? 'timeout' : 'provider', aborted ? 504 : 502);
    } finally {
      clearTimeout(submissionTimer);
      signal?.removeEventListener('abort', cancel);
    }
  }

  receiveCallback(value: unknown): 'buffered' | 'completed' {
    this.prune();
    if (!isRecord(value) || !isRecord(value.metadata)
        || typeof value.metadata.aviation_callback_nonce !== 'string') throw new ExplanationError('missing', 404);
    const job = this.nonces.get(value.metadata.aviation_callback_nonce);
    if (!job || typeof value.requestId !== 'string') throw new ExplanationError('missing', 404);
    let result: ExplanationResult;
    try {
      result = validateExplanationCallback({ appId: this.appId, nonce: job.nonce,
        requestId: job.providerId ?? value.requestId }, value);
    } catch { throw new ExplanationError('missing', 404); }
    if (job.result || job.early) throw new ExplanationError('duplicate', 409);
    if (!job.providerId) {
      job.early = { providerId: value.requestId, result };
      return 'buffered';
    }
    job.result = result;
    return 'completed';
  }
  private authorizedJob(id: string, token: unknown): Job {
    this.prune();
    const job = this.jobs.get(id);
    if (!job || typeof token !== 'string' || !/^[0-9a-f]{64}$/.test(token)
        || !timingSafeEqual(Buffer.from(token), Buffer.from(job.token))) throw new ExplanationError('missing', 404);
    return job;
  }
  getRequest(id: string, token: unknown): ExplanationState {
    const job = this.authorizedJob(id, token);
    return { requestId: job.id, status: job.result ? 'completed' : 'queued',
      expiresAt: new Date(job.expires).toISOString(), ...job.result };
  }
  deleteRequest(id: string, token: unknown): void { this.remove(this.authorizedJob(id, token)); }

  /** Convenience for asynchronous Node callers; HTTP adapters use submit/poll. */
  async explain(context: string, question?: string, history?: HistoryMessage[]): Promise<string> {
    const ticket = await this.submit({ context, question, history });
    try {
      while (this.now() < Date.parse(ticket.expiresAt)) {
        const state = this.getRequest(ticket.requestId, ticket.accessToken);
        if (state.status === 'completed') return state.explanation!;
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      throw new ExplanationError('timeout', 504);
    } finally {
      const job = this.jobs.get(ticket.requestId);
      if (job) this.remove(job);
    }
  }
  close(): void {
    this.closed = true;
    this.clearRequests();
  }
}
