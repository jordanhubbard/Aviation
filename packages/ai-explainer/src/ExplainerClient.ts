/**
 * ExplainerClient — calls the RCC brain API to explain AI decisions.
 *
 * Configurable via the RCC_URL environment variable.
 * Defaults to http://localhost:8789.
 * Gracefully returns a 503-style error object if RCC is unreachable.
 */

export interface ExplainRequest {
  context: string;
  question: string;
}

export interface ExplainResponse {
  explanation: string;
}

export interface ExplainError {
  error: string;
  status: number;
}

export type ExplainResult = ExplainResponse | ExplainError;

export function isExplainError(result: ExplainResult): result is ExplainError {
  return 'error' in result;
}

export class ExplainerClient {
  private readonly rccUrl: string;

  constructor(rccUrl?: string) {
    this.rccUrl = rccUrl ?? process.env['RCC_URL'] ?? 'http://localhost:8789';
  }

  async explain(request: ExplainRequest): Promise<ExplainResult> {
    const url = `${this.rccUrl}/api/explain`;

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(request),
        signal: AbortSignal.timeout(10_000),
      });

      if (!response.ok) {
        const text = await response.text().catch(() => response.statusText);
        return { error: `RCC returned ${response.status}: ${text}`, status: response.status };
      }

      const data = await response.json() as ExplainResponse;
      return data;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      const isTimeout = message.includes('timeout') || message.includes('TimeoutError') || message.includes('AbortError');
      return {
        error: isTimeout
          ? 'AI explanation service timed out'
          : `AI explanation service unavailable: ${message}`,
        status: 503,
      };
    }
  }
}
