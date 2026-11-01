# `aviation.testing.e2e` interface

## Constants and identities

- A run identity matches `^e2e_[0-9a-f]{32}$` exactly.
- An application identity matches `^[a-z0-9-]+$` exactly.
- The credential headers are `x-aviation-test-run`,
  `x-aviation-test-expires`, and `x-aviation-test-signature`.
- The maximum credential lifetime is 900,000 milliseconds.

Header names are case-insensitive. Supplying the same credential header more than
once through differently cased mapping keys fails closed.

## Operations

- `parseE2ERunId(value)`: return the validated run identity.
- `isolatedRunDirectory(root, runId)`: return the direct run-owned directory beneath
  the caller's resolved root.
- `isolatedSqlitePath(root, runId)`: return the direct run-owned `<runId>.db` path
  beneath the caller's resolved root.
- `tagTestRecord(runId, record)`: return a new record containing
  `is_test_data: true` and `test_run_id: runId`.
- `assertTestRecordForRun(value, runId)`: accept only a tagged record for that exact
  run.
- `signE2EHeaders(appId, runId, secret, nowMs, ttlMs)`: return the three credential
  headers. The signature is lowercase hexadecimal HMAC-SHA256 over the UTF-8 string
  `<appId>\n<runId>\n<expiresAtMs>`.
- `verifyE2EHeaders(appId, headers, secret, nowMs)`: return the run identity, return
  no identity when all credential headers are absent, or fail closed.

Signing requires a secret of at least 32 characters, a positive lifetime no greater
than 900,000 milliseconds, and safe integer millisecond inputs. Verification accepts
an expiry equal to `nowMs`, rejects an earlier expiry, and rejects an expiry beyond
`nowMs + 900000`.

All record operations leave caller-owned mappings unchanged. Path operations do not
create or remove filesystem objects. Verification does not read the clock when an
explicit `nowMs` is supplied.

## Stable failures

- `e2e-run-id-invalid`
- `e2e-app-id-invalid`
- `e2e-secret-invalid`
- `e2e-credential-lifetime-invalid`
- `e2e-credentials-incomplete`
- `e2e-header-duplicate`
- `e2e-expiration-invalid`
- `e2e-credentials-expired`
- `e2e-signature-invalid`
- `e2e-record-fields-present`
- `e2e-record-run-mismatch`
- `e2e-lease-lifetime-invalid`

Random run-ID generation, secret discovery, HTTP routing, response mapping, directory
creation, database schemas, fixture catalogs, browser/network orchestration, cleanup,
residual-row verification, deployment, and scheduling are outside this interface.


## Bounded resource lease identities

- `createE2ELease(appId, runId, nowMs, ttlMs)` returns a new mapping with schema
  `aviation/e2e-lease@1`, `app_id`, `is_test_data: true`, `test_run_id`,
  `issued_at_ms: nowMs` and `expires_at_ms: nowMs + ttlMs`.
- Application and run identities use the existing grammar. Timestamps must be
  nonnegative safe integers; lifetime must be positive and at most 900000 ms, and
  the sum must remain a safe integer. Invalid lifetime/timestamps fail with
  `e2e-lease-lifetime-invalid`; identity errors use existing stable codes.
- `classifyE2ELease(value, expectedAppId, nowMs)` returns `active`, `expired`, or
  `unowned`. Only a mapping with the exact schema, true tag, valid run identity,
  matching valid application, safe nonnegative timestamps, positive bounded
  duration, and issue time no later than a valid nonnegative `nowMs` is owned.
  Owned leases are expired when `expires_at_ms <= nowMs`. Every other input is
  unowned, including boolean or fractional timestamps. Integer-valued numeric
  representations are accepted and constructed timestamps are canonical integers.
  Caller mappings remain unchanged.

Lease classification is pure ownership policy. Resource discovery, Docker labels,
process deadlines, cleanup timing and scheduling remain adapter behavior.
