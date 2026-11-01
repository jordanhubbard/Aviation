# Acceptance: `aviation.testing.e2e`

Each realization SHALL execute every case in `vectors.json` without network access.

1. Validate every run identity and reject traversal, uppercase, short, and non-string
   inputs with `e2e-run-id-invalid`.
2. Derive direct-child directory and SQLite paths without creating filesystem state.
3. Tag and assert records without mutating caller-owned mappings; reject pre-existing
   isolation fields and foreign-run records with the declared stable codes.
4. Produce the exact application-bound HMAC credential in the signing vector.
5. Verify lowercase and mixed-case header mappings identically; treat an empty mapping
   as ordinary traffic and fail closed on every invalid credential vector.
6. Keep random identity generation, HTTP adapters, fixture catalogs, browser helpers,
   storage lifecycle, cleanup, and deployment behavior outside the portable oracle.
7. Run these vectors in common SDK CI independently of application test suites.


8. Construct every valid lease and reject invalid creation inputs with the stable
   declared errors. Classify active, exact-expiry, expired, foreign, malformed,
   unsupported and future-issued metadata identically across bindings, without
   modifying caller mappings or accessing resources.
