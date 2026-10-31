# Seed and fixture data boundary

The former proposal to generate realistic-looking accidents for development and
demos is retired. Accident Tracker must not mix fabricated events with records
obtained from its named external sources.

## Runtime contract

- Production and development ingestion persist only records returned by the live ASN,
  AVHerald, NTSB, and cited-media adapters.
- An unavailable, rejected, or unparseable ASN or AVHerald source contributes no
  records. The service does not substitute bundled XML or generated events.
- Airport enrichment uses the common Aviation SDK catalog; this application does not
  own a private airport sample.
- The SQLite database is runtime state and is never preloaded by a repository seed
  command.

## Test contract

- Parser unit tests construct minimal source-format strings in the test itself.
- Integration tests insert their own deterministic records into an isolated in-memory
  or temporary repository.
- Remote E2E tests use the authenticated `aviation.testing.e2e` fixture contract. Each
  record is tagged to a run-specific database and removed by the E2E lifecycle.
- Frontend examples remain typed test fixtures under the frontend test tree and never
  enter backend ingestion.

Provider parsing and persistence are application-private adapters. They are not a
common SDK Component without a second real consumer and a provider-neutral acceptance
contract.
