import { useEffect, useRef, useState } from 'react';

export interface ExplanationEvent {
  registration: string;
  dateZ: string;
  category: string;
  aircraftType?: string;
  operator?: string;
  country?: string;
  fatalities?: number;
  injuries?: number;
  summary?: string;
  narrative?: string;
}

export function AccidentExplanation({ event }: { event: ExplanationEvent }) {
  const [loading, setLoading] = useState(false);
  const [text, setText] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const request = useRef<AbortController | null>(null);
  useEffect(() => () => request.current?.abort(), []);

  async function explain() {
    const controller = new AbortController();
    request.current = controller;
    setLoading(true);
    setError(null);
    setText(null);
    const context = Object.entries({
      registration: event.registration, date: event.dateZ, category: event.category,
      aircraft: event.aircraftType, operator: event.operator, country: event.country,
      fatalities: event.fatalities, injuries: event.injuries,
      summary: event.summary, narrative: event.narrative,
    })
      .filter(([, value]) => value !== undefined)
      .map(([name, value]) => `${name}: ${value}`)
      .join('\n');
    try {
      const response = await fetch('/api/explain', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          context,
          question: 'Explain the recorded facts and possible contributing factors. Distinguish evidence from speculation; do not invent an official cause.',
        }),
        signal: controller.signal,
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || `Explanation failed (${response.status})`);
      if (typeof result.explanation !== 'string') throw new Error('Explanation response is invalid');
      if (!controller.signal.aborted) setText(result.explanation);
    } catch (failure) {
      if (!controller.signal.aborted) setError(failure instanceof Error ? failure.message : 'Explanation unavailable');
    } finally {
      if (!controller.signal.aborted) setLoading(false);
    }
  }

  return <section aria-label="AI explanation">
    <button onClick={() => void explain()} disabled={loading}>
      {loading ? 'Loading explanation…' : 'Explain with AI'}
    </button>
    {error && <p role="alert">{error}</p>}
    {text && <div aria-live="polite">
      <strong>AI analysis — not an official finding</strong>
      <p style={{ whiteSpace: 'pre-wrap' }}>{text}</p>
    </div>}
  </section>;
}
