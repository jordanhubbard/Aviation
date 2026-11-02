export type DecisionContext = string | Readonly<Record<string, unknown>> | readonly unknown[];
export function explainDecision(context: DecisionContext, question?: string): Promise<void>;
export function registerDecisionContext(provider: () => DecisionContext | null | undefined,
  question?: string): () => void;
export function closeExplanation(): Promise<void>;
