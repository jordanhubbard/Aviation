/**
 * AI Provider interface for common AI methodology
 */
export interface AIProvider {
  name: string;
  initialize(config: AIConfig): Promise<void>;
  query(prompt: string, options?: AIQueryOptions): Promise<AIResponse>;
}

export interface AIConfig {
  apiKey?: string;
  model?: string;
  temperature?: number;
  maxTokens?: number;
}

export interface AIQueryOptions {
  context?: string;
  systemPrompt?: string;
  temperature?: number;
  maxTokens?: number;
}

export interface AIResponse {
  content: string;
  tokens?: number;
  model?: string;
  finishReason?: string;
}

/**
 * Base AI Service class that applications can extend
 */
export abstract class AIService {
  protected provider: AIProvider;

  constructor(provider: AIProvider) {
    this.provider = provider;
  }

  abstract processData(data: any): Promise<any>;
}
