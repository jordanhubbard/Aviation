# Acceptance: `aviation.service.lifecycle`

Each realization SHALL execute every case in `vectors.json` without network access.

1. Apply every valid event sequence and produce every expected intermediate state.
2. Reject every invalid state/event pair with
   `service-lifecycle-transition-invalid`.
3. Leave transition inputs unchanged.
4. Implement no hook execution, clock access, retry, logging, or resource cleanup in
   the portable transition operation.
