/**
 * OpenClaw chat client types for Aviation SDK.
 * Used by the aviation-chat proxy or app backends; not for direct browser use.
 */

export interface OpenClawClientConfig {
  baseUrl: string;
  apiKey: string;
  /** Optional model/agent id (e.g. "openclaw:main"). Defaults to a sensible default if not set. */
  model?: string;
}

export interface SendMessageParams {
  message: string;
  userId: string;
  appId: string;
  /** App context (e.g. CLAUDE.md content) sent as system context so OpenClaw can give app-specific advice. */
  appContextPrefix?: string;
  /** Optional conversation id for multi-turn; may be used as part of session key. */
  conversationId?: string;
  /** Prior turns for this conversation (proxy-managed history when OpenClaw does not persist). */
  history?: Array<{ role: 'user' | 'assistant'; content: string }>;
}

export interface SendMessageResult {
  content: string;
  /** Model/agent used, if returned by the API. */
  model?: string;
  /** Finish reason, if returned. */
  finishReason?: string;
}
