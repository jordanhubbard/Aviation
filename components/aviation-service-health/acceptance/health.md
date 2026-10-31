# Acceptance: `aviation.service.health`

Each realization SHALL execute every case in `vectors.json` without network access.

1. Normalize every status case to the expected canonical value.
2. Reject every invalid status with `health-status-invalid`.
3. Build every expected report without mutating the input options or details.
4. Reject malformed service identities and reserved detail keys with the specified
   stable code.
5. Preserve adapter-owned detail values without interpreting their schema.
