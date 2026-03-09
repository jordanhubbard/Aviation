import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createOpenClawClient } from '../client';

describe('createOpenClawClient', () => {
  const mockFetch = vi.fn();
  beforeEach(() => {
    vi.stubGlobal('fetch', mockFetch);
    mockFetch.mockReset();
  });

  it('builds system content with appId, userId, and appContextPrefix', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        choices: [{ message: { content: 'Hello', role: 'assistant' }, finish_reason: 'stop' }],
        model: 'openclaw:main',
      }),
    });

    const client = createOpenClawClient({
      baseUrl: 'http://openclaw.local',
      apiKey: 'test-key',
    });

    const result = await client.sendMessage({
      message: 'What can I do here?',
      userId: 'user-1',
      appId: 'flight-planner',
      appContextPrefix: 'This app is for VFR route planning.',
    });

    expect(result.content).toBe('Hello');
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, options] = mockFetch.mock.calls[0];
    expect(url).toBe('http://openclaw.local/v1/chat/completions');
    expect(options.method).toBe('POST');
    expect(options.headers?.Authorization).toBe('Bearer test-key');
    const body = JSON.parse(options.body);
    expect(body.model).toBe('openclaw:main');
    expect(body.user).toBe('user-1');
    expect(body.messages[0].role).toBe('system');
    expect(body.messages[0].content).toContain('App: flight-planner');
    expect(body.messages[0].content).toContain('User: user-1');
    expect(body.messages[0].content).toContain('Context for this app:');
    expect(body.messages[0].content).toContain('This app is for VFR route planning.');
    expect(body.messages[1].role).toBe('user');
    expect(body.messages[1].content).toBe('What can I do here?');
  });

  it('includes history when provided', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        choices: [{ message: { content: 'Follow-up reply', role: 'assistant' }, finish_reason: 'stop' }],
      }),
    });

    const client = createOpenClawClient({ baseUrl: 'http://oc', apiKey: 'k' });
    await client.sendMessage({
      message: 'And then?',
      userId: 'u',
      appId: 'app',
      history: [
        { role: 'user', content: 'First question' },
        { role: 'assistant', content: 'First answer' },
      ],
    });

    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.messages.length).toBe(4);
    expect(body.messages[1].content).toBe('First question');
    expect(body.messages[2].content).toBe('First answer');
    expect(body.messages[3].content).toBe('And then?');
  });

  it('throws on API error', async () => {
    mockFetch.mockResolvedValueOnce({ ok: false, status: 401, text: async () => 'Unauthorized' });

    const client = createOpenClawClient({ baseUrl: 'http://oc', apiKey: 'k' });
    await expect(
      client.sendMessage({ message: 'Hi', userId: 'u', appId: 'a' })
    ).rejects.toThrow(/OpenClaw API error 401/);
  });
});
