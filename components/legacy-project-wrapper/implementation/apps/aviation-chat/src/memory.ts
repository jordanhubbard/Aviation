/**
 * In-memory conversation history for proxy-managed memory.
 * Key: `${userId}:${appId}:${conversationId ?? 'default'}`.
 * Keeps last N turns (user + assistant pairs) to send as history to OpenClaw.
 */

const MAX_TURNS = 10;

interface Turn {
  role: 'user' | 'assistant';
  content: string;
}

const store = new Map<string, Turn[]>();

function key(userId: string, appId: string, conversationId: string): string {
  return `${userId}:${appId}:${conversationId || 'default'}`;
}

export function getHistory(userId: string, appId: string, conversationId?: string): Turn[] {
  const k = key(userId, appId, conversationId ?? '');
  return store.get(k) ?? [];
}

export function appendTurn(
  userId: string,
  appId: string,
  role: 'user' | 'assistant',
  content: string,
  conversationId?: string
): void {
  const k = key(userId, appId, conversationId ?? '');
  let turns = store.get(k) ?? [];
  turns.push({ role, content });
  if (turns.length > MAX_TURNS * 2) {
    turns = turns.slice(-MAX_TURNS * 2);
  }
  store.set(k, turns);
}
