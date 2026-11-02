/** Portable decision input and queued RCC wire validation. */
export const DEFAULT_QUESTION = 'Explain this decision using the supplied facts.';
export const INPUT_LIMITS = Object.freeze({ context: 16_384, question: 2_048, message: 4_096,
  total: 32_768, history: 12, result: 65_536 });

export type HistoryMessage = { role: 'user' | 'assistant'; content: string };
export type ExplanationInput = { context: string; question: string; history: HistoryMessage[] };
export type ExplanationResult = { explanation: string; completedAt: string; model?: string };
export type CallbackOwner = { appId: string; nonce: string; requestId: string };

export class ExplanationContractError extends Error {
  constructor(public readonly code: string) {
    super(code);
    this.name = 'ExplanationContractError';
  }
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

export function textSize(value: string): number {
  return new TextEncoder().encode(value).byteLength;
}

function text(value: unknown, maximum: number): value is string {
  return typeof value === 'string' && value.trim().length > 0 && textSize(value) <= maximum;
}

export function normalizeExplanationInput(value: unknown): ExplanationInput {
  const fail = () => { throw new ExplanationContractError('explanation-input-invalid'); };
  if (!isRecord(value) || !text(value.context, INPUT_LIMITS.context)) return fail();
  const question = value.question === undefined ? DEFAULT_QUESTION : value.question;
  const history = value.history === undefined ? [] : value.history;
  if (!text(question, INPUT_LIMITS.question) || !Array.isArray(history)
      || history.length > INPUT_LIMITS.history) return fail();
  const messages: HistoryMessage[] = [];
  let size = textSize(value.context) + textSize(question);
  for (const message of history) {
    if (!isRecord(message) || (message.role !== 'user' && message.role !== 'assistant')
        || !text(message.content, INPUT_LIMITS.message)) return fail();
    size += textSize(message.content);
    messages.push({ role: message.role, content: message.content });
  }
  if (size > INPUT_LIMITS.total) return fail();
  return { context: value.context, question, history: messages };
}

function requestId(value: unknown): value is string {
  return text(value, 128) && !/[\s\u0000-\u001f\u007f]/u.test(value);
}

export function acceptQueuedResponse(status: number, value: unknown): string {
  if (status !== 202 || !isRecord(value) || value.ok !== true || value.status !== 'queued'
      || !requestId(value.requestId)) throw new ExplanationContractError('explanation-queue-invalid');
  return value.requestId;
}

export function validateExplanationCallback(owner: CallbackOwner, value: unknown): ExplanationResult {
  const fail = () => { throw new ExplanationContractError('explanation-callback-invalid'); };
  if (!isRecord(value) || !isRecord(value.metadata)
      || !/^[0-9a-f]{64}$/.test(owner.nonce)
      || value.metadata.aviation_app_id !== owner.appId
      || value.metadata.aviation_callback_nonce !== owner.nonce
      || value.requestId !== owner.requestId || !requestId(value.requestId)
      || !text(value.result, INPUT_LIMITS.result)
      || typeof value.completedAt !== 'string' || value.completedAt.length !== 24
      || !Number.isFinite(Date.parse(value.completedAt))) return fail();
  if (new Date(value.completedAt).toISOString() !== value.completedAt
      || (value.model !== undefined && !text(value.model, 128))) return fail();
  return { explanation: value.result, completedAt: value.completedAt,
    ...(value.model === undefined ? {} : { model: value.model as string }) };
}
