# Acceptance: `aviation.ai.explanation`

Execute every case in [vectors.json](vectors.json) independently of a live model provider.

1. Preserve every valid input, supply defaults and reject malformed inputs with the
   specified stable code. Exercise byte and history limits at their boundaries.
2. Accept only the authored queued responses; an immediate result is not queue
   acceptance. Construct messages and callback metadata without provider credentials.
3. Correlate callbacks to the exact app, nonce and provider ID. Reject malformed
   results, timestamps and optional model identities without exposing input values.
4. Use a real local HTTP RCC fixture to verify authenticated submission, 202 handling
   and callback completion, including a callback arriving before queue acceptance.
5. Prove request access-token isolation, duplicate callback rejection, timeout,
   bounded capacity, submission failure and removal of all owned state on shutdown.
6. Exercise the shared browser UI with explanations and follow-ups at desktop and
   mobile widths. Use SDK mocks for external calls, SDK ownership tags for test
   state, and verify cleanup after both success and injected failure.
   Verify nested decision registration, restoration of a previous context, closure
   of the replaced transcript, and noninterference when an inactive scope is removed.

SDK implementation tests remain retained-source evidence until qualified through
the project's declared lifecycle; their existence is not native generation or
native Component acceptance evidence.
