import { describe, expect, it } from 'vitest';
import { loadConformanceContract } from '../../shared-sdk/src/aviation/__tests__/conformance-contract.js';
import { acceptQueuedResponse, normalizeExplanationInput, validateExplanationCallback,
  type CallbackOwner } from '../src/protocol.js';

type Case = { id: string; input: unknown; expected: unknown };
type QueueCase = { id: string; status: number; body: unknown; expected: string };
type CallbackCase = { id: string; owner: CallbackOwner; body: unknown; expected: unknown };
const vectors = loadConformanceContract<{
  schema: string; inputCases: Case[]; invalidInputCases: Case[];
  queueCases: QueueCase[]; invalidQueueCases: QueueCase[];
  callbackCases: CallbackCase[]; invalidCallbackCases: CallbackCase[];
}>('ai-explanation');

describe('aviation.ai.explanation Component conformance', () => {
  it('uses the authored Component vectors', () => {
    expect(vectors.schema).toBe('aviation/ai-explanation-acceptance-vectors@1');
  });
  for (const item of vectors.inputCases) it(item.id, () => {
    const before = structuredClone(item.input);
    expect(normalizeExplanationInput(item.input)).toEqual(item.expected);
    expect(item.input).toEqual(before);
  });
  for (const item of vectors.invalidInputCases) it(item.id, () => {
    expect(() => normalizeExplanationInput(item.input)).toThrow('explanation-input-invalid');
  });
  for (const item of vectors.queueCases) it(item.id, () => {
    expect(acceptQueuedResponse(item.status, item.body)).toBe(item.expected);
  });
  for (const item of vectors.invalidQueueCases) it(item.id, () => {
    expect(() => acceptQueuedResponse(item.status, item.body)).toThrow('explanation-queue-invalid');
  });
  for (const item of vectors.callbackCases) it(item.id, () => {
    expect(validateExplanationCallback(item.owner, item.body)).toEqual(item.expected);
  });
  for (const item of vectors.invalidCallbackCases) it(item.id, () => {
    expect(() => validateExplanationCallback(item.owner, item.body)).toThrow('explanation-callback-invalid');
  });

  it('enforces UTF-8 byte limits rather than JavaScript character counts', () => {
    expect(normalizeExplanationInput({ context: '✈'.repeat(5461) }).context).toHaveLength(5461);
    expect(() => normalizeExplanationInput({ context: '✈'.repeat(5462) })).toThrow('explanation-input-invalid');
  });
  it('bounds accumulated history as well as individual messages', () => {
    const history = Array.from({ length: 12 }, () => ({ role: 'user', content: 'x'.repeat(4096) }));
    expect(() => normalizeExplanationInput({ context: 'facts', history })).toThrow('explanation-input-invalid');
    expect(() => normalizeExplanationInput({ context: 'facts', history: Array.from({ length: 13 }, () => ({ role: 'user', content: 'x' })) })).toThrow('explanation-input-invalid');
  });
  it('rejects oversized callback text without echoing the value', () => {
    const item = vectors.callbackCases[0];
    const body = { ...(item.body as object), result: 'sensitive'.repeat(8193) };
    expect(() => validateExplanationCallback(item.owner, body)).toThrow('explanation-callback-invalid');
  });
});
