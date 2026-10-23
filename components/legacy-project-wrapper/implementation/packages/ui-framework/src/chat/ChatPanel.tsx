import * as React from 'react';

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface ChatPanelProps {
  /** Application id (e.g. flight-planner); must match appId used by the aviation-chat proxy. */
  appId: string;
  /** User id for memory; from auth or anonymous id. */
  userId: string;
  /** Base URL of the aviation-chat proxy (e.g. http://localhost:31416). */
  apiBaseUrl: string;
  /** Optional conversation id for multi-turn sessions. */
  conversationId?: string;
  /** Optional placeholder for the input. */
  placeholder?: string;
  /** Optional title above the chat. */
  title?: string;
  /** Optional class name for the container. */
  className?: string;
}

export const ChatPanel: React.FC<ChatPanelProps> = ({
  appId,
  userId,
  apiBaseUrl,
  conversationId,
  placeholder = 'Ask OpenClaw...',
  title = 'Chat',
  className,
}) => {
  const [messages, setMessages] = React.useState<ChatMessage[]>([]);
  const [input, setInput] = React.useState('');
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const listRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    listRef.current?.scrollTo(0, listRef.current.scrollHeight);
  }, [messages]);

  const send = async () => {
    const text = input.trim();
    if (!text || loading) return;
    setInput('');
    setMessages((prev) => [...prev, { role: 'user', content: text }]);
    setLoading(true);
    setError(null);
    try {
      const url = `${apiBaseUrl.replace(/\/$/, '')}/chat`;
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          appId,
          message: text,
          ...(conversationId ? { conversationId } : {}),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? `Request failed: ${res.status}`);
        setMessages((prev) => prev.slice(0, -1));
        return;
      }
      setMessages((prev) => [...prev, { role: 'assistant', content: data.content ?? '' }]);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setError(msg);
      setMessages((prev) => prev.slice(0, -1));
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    send();
  };

  return (
    <div className={className} style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 280 }}>
      {title ? (
        <h3 style={{ margin: '0 0 8px 0', fontSize: '1rem', fontWeight: 600 }}>{title}</h3>
      ) : null}
      <div
        ref={listRef}
        style={{
          flex: 1,
          overflow: 'auto',
          border: '1px solid #ccc',
          borderRadius: 6,
          padding: 8,
          marginBottom: 8,
          minHeight: 160,
          background: '#fafafa',
        }}
      >
        {messages.length === 0 && !error && (
          <p style={{ margin: 0, color: '#666', fontSize: 14 }}>Send a message to get advice from OpenClaw in context of this app.</p>
        )}
        {messages.map((m, i) => (
          <div
            key={i}
            style={{
              marginBottom: 8,
              textAlign: m.role === 'user' ? 'right' : 'left',
            }}
          >
            <span
              style={{
                display: 'inline-block',
                maxWidth: '85%',
                padding: '6px 10px',
                borderRadius: 8,
                background: m.role === 'user' ? '#e3f2fd' : '#e8e8e8',
                fontSize: 14,
                textAlign: 'left',
              }}
            >
              {m.content}
            </span>
          </div>
        ))}
        {loading && (
          <div style={{ marginTop: 8, color: '#666', fontSize: 14 }}>Thinking…</div>
        )}
        {error && (
          <div style={{ marginTop: 8, color: '#c62828', fontSize: 14 }}>{error}</div>
        )}
      </div>
      <form onSubmit={handleSubmit} style={{ display: 'flex', gap: 8 }}>
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={placeholder}
          disabled={loading}
          style={{
            flex: 1,
            padding: '8px 12px',
            borderRadius: 6,
            border: '1px solid #ccc',
            fontSize: 14,
          }}
        />
        <button
          type="submit"
          disabled={loading || !input.trim()}
          style={{
            padding: '8px 16px',
            borderRadius: 6,
            border: '1px solid #1976d2',
            background: '#1976d2',
            color: '#fff',
            fontSize: 14,
            cursor: loading ? 'not-allowed' : 'pointer',
          }}
        >
          Send
        </button>
      </form>
    </div>
  );
};
