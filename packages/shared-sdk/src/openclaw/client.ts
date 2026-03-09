/**
 * OpenClaw HTTP client for Aviation in-app chat.
 * Compose system/context from app identity + user/app ids + app CLAUDE.md content,
 * then call OpenClaw's OpenAI-compatible chat completions endpoint.
 * Caller must provide baseUrl and apiKey (e.g. from keystore); no direct env access here.
 */

import type { OpenClawClientConfig, SendMessageParams, SendMessageResult } from './types';

const DEFAULT_MODEL = 'openclaw:main';

function buildSystemContent(params: {
  appId: string;
  userId: string;
  appContextPrefix?: string;
}): string {
  const lines: string[] = [
    'You are helping a user inside an aviation application. Answer concisely and in context.',
    '',
    `App: ${params.appId}`,
    `User: ${params.userId}`,
    '',
  ];
  if (params.appContextPrefix?.trim()) {
    lines.push('Context for this app:');
    lines.push(params.appContextPrefix.trim());
    lines.push('');
  }
  return lines.join('\n');
}

export function createOpenClawClient(config: OpenClawClientConfig) {
  const baseUrl = config.baseUrl.replace(/\/$/, '');
  const apiKey = config.apiKey;
  const model = config.model ?? DEFAULT_MODEL;

  return {
    async sendMessage(params: SendMessageParams): Promise<SendMessageResult> {
      const systemContent = buildSystemContent({
        appId: params.appId,
        userId: params.userId,
        appContextPrefix: params.appContextPrefix,
      });

      const messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = [
        { role: 'system', content: systemContent },
      ];

      if (params.history?.length) {
        for (const turn of params.history) {
          messages.push({ role: turn.role, content: turn.content });
        }
      }

      messages.push({ role: 'user', content: params.message });

      const body = {
        model,
        messages,
        user: params.userId,
        max_tokens: 2048,
      };

      const url = `${baseUrl}/v1/chat/completions`;
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const text = await response.text();
        throw new Error(`OpenClaw API error ${response.status}: ${text}`);
      }

      const data = (await response.json()) as {
        choices?: Array<{
          message?: { content?: string; role?: string };
          finish_reason?: string;
        }>;
        model?: string;
      };

      const choice = data.choices?.[0];
      const content = choice?.message?.content ?? '';
      const finishReason = choice?.finish_reason;

      return {
        content,
        model: data.model,
        finishReason,
      };
    },
  };
}

export type { OpenClawClientConfig, SendMessageParams, SendMessageResult } from './types';
