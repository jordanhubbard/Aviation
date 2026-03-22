const DEFAULT_BRAIN_URL = 'http://localhost:8765/api/brain/request';

export interface ExplainerClientOptions {
  brainUrl?: string;
}

export interface BrainRequest {
  context: string;
  question?: string;
}

export interface BrainResponse {
  explanation: string;
}

export class ExplainerClient {
  private readonly brainUrl: string;

  constructor(options: ExplainerClientOptions = {}) {
    this.brainUrl =
      options.brainUrl ??
      process.env['RCC_BRAIN_URL'] ??
      DEFAULT_BRAIN_URL;
  }

  async explain(context: string, question?: string): Promise<string> {
    const body: BrainRequest = { context };
    if (question !== undefined) {
      body.question = question;
    }

    const response = await fetch(this.brainUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      throw new Error(
        `RCC brain request failed: ${response.status} ${response.statusText}`
      );
    }

    const data = (await response.json()) as BrainResponse;
    if (typeof data.explanation !== 'string') {
      throw new Error('RCC brain response missing explanation field');
    }
    return data.explanation;
  }
}
