// Browser-only entry: never import the Node provider or keystore barrel here.
import './widget.js';

export function explainDecision(context, question) {
  if (!globalThis.AviationExplain) return Promise.reject(new Error('Explanation UI requires a browser'));
  return globalThis.AviationExplain.open(context, question);
}

export function registerDecisionContext(provider, question) {
  if (!globalThis.AviationExplain) return () => undefined;
  return globalThis.AviationExplain.registerContext(provider, question);
}

export function closeExplanation() {
  return globalThis.AviationExplain?.close() ?? Promise.resolve();
}
