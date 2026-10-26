---
name: "rest-application"
description: "REST/HTTP+JSON as an IPC-surface adapter for the back-end parent: an OpenAPI 3.x + JSON-Schema contract as the single source of truth, schema-validated requests, structured error envelopes, a /openapi.json self-description served from the contract, versioned routes, and an IPC-surface conformance oracle. Use for Literate AI workflow tasks that expose a described, versioned REST API from a generated service."
metadata:
  author: "Literate AI maintainers <literate-ai-maintainers@users.noreply.github.com>"
schema: "urn:literate-ai:schema:v1:specification-to-source-skill"
skill_id: "rest-application"
version: "1.0.0"
title: "REST application IPC-surface adapter"
stages:
  - "plan"
  - "generate"
dependencies:
  - schema: "urn:literate-ai:schema:v1:skill-reference"
    skill_id: "backend-application"
    version: "1.0.0"
    identity:
      schema: "urn:literate-ai:schema:v1:content-identity"
      algorithm: "sha256"
      digest: "df6b4739c27798af1f48aeb4633899e4c6ebe9279f81cfc7fbaded8e27267253"
limitations:
  - "Do not hand-author the served /openapi.json separately from the declared schema; the self-description is generated from the same OpenAPI/JSON-Schema contract that validates requests and responses, so it can never silently drift from behavior."
  - "Do not accept unvalidated request input on any route; every request body, path, and query parameter is validated against the declared JSON Schema and rejected with a structured error envelope before the handler runs — no partially-valid calls."
  - "Do not return a bare string or an untyped body on error; errors are structured envelopes with a stable code, and every response validates against the declared schema for that route and status."
  - "Do not treat REST as a standalone protocol; it is one adapter of the unified IPC surface (ADR-0029). Reuse the IPC-surface conformance oracle (`literate-ai/ipc-surface-conformance-acceptance@1`, protocol `\"rest\"`) and ADR-0005's `CompatibilityPromise`; do not invent a second contract, a second self-description mechanism, or a second version/compatibility notion."
  - "Do not call an expensive upstream source from a request path; inherit the back-end parent's rule that only a scheduled worker or equivalent background job may talk to that source, and answer REST requests from the local store."
  - "Do not bake product route names, product schemas, credentials, or application vocabulary into this template; those stay in the deriving project's authority (ADR-0001 boundary). This is a provider-neutral REST surface pattern, not a product API."
  - "Do not make the REST surface a new entrypoint kind; it is a persistent-service deployment unit launched via the shipped `--litai-serve` path that ALSO declares the IPC-surface conformance oracle."
  - "Do not copy the back-end parent's process shape, store ownership, or Flavor index; inherit them."
trust: "repository-reviewed"
---
# REST application IPC-surface adapter

This skill is a delta of `backend-application`. Pin the parent in the recipe.
Apply it when the specification asks a generated service to expose a REST/HTTP+JSON
API to out-of-process callers — the frontend→API boundary of a split service
(ADR-0027) is the canonical case. REST is **not a standalone protocol**: it is one
**adapter of the unified IPC surface** introduced by ADR-0029, exactly as
`mcp-application` is the MCP adapter and `grpc-application` is the gRPC adapter. The
same four surface properties apply here, specialized to HTTP+JSON with an OpenAPI
3.x + JSON-Schema contract. The back-end parent already owns process shape, store
ownership, the Flavor index, and the rule that only a background worker may reach an
expensive upstream source; this delta owns only what makes the HTTP surface a
*described, versioned, conformance-tested* contract rather than "an HTTP API" in
prose.

## The IPC surface, specialized to REST

An IPC surface is a Component boundary that exposes named operations to
out-of-process callers under four properties (ADR-0029). For REST they are:

1. **A declared schema.** The API's operations, request bodies, path/query
   parameters, response bodies, and error envelopes are described by an OpenAPI 3.x
   document whose payloads are JSON Schemas. Every request is validated against that
   schema before its handler runs; invalid input is rejected with a structured error
   envelope, never executed as a partially-valid call. Every response — success and
   error alike — validates against the declared schema for its route and status.
2. **A served self-description.** The surface serves its own OpenAPI document at a
   discoverable path (`/openapi.json`), **generated from the declared schema**, never
   hand-drifted from it. A consumer or a verifier can fetch `/openapi.json` and learn
   the exact contract the surface honors. This served description is the primary,
   always-current API documentation (ADR-0029): because it is generated from the
   declared schema and conformance-checked, it cannot silently diverge from behavior.
3. **A conformance acceptance oracle.** The surface declares an IPC-surface
   conformance oracle so the verifier launches it via `--litai-serve`, fetches
   `/openapi.json`, asserts the served description matches the declared schema, drives
   the declared request cases, and validates each response against the schema. It
   fails closed on a served description that does not match the declared schema and on
   any response that does not validate.
4. **A version + compatibility promise.** The surface carries a semantic version and
   an ADR-0005 `CompatibilityPromise`, with versioned routes. A breaking change is a
   version transition a consumer's binding can be checked against — the same way a
   Component public-interface change is checked today.

## OpenAPI 3.x contract as the single source of truth

Model resources and routes once, in the OpenAPI 3.x document, and derive everything
else from it. The contract names each route (path + method), its typed request
(body, path, and query parameters as JSON Schemas), its typed responses per status,
and a structured error envelope schema shared across routes. Request validation, the
served `/openapi.json`, response validation, and typed handler models are all
projections of this one contract — not three parallel definitions that can drift. Do
not maintain a second schema language when OpenAPI + JSON Schema already describes
the surface; do not let a handler accept or emit a field the contract does not
declare.

## Schema-validated requests and structured error envelopes

Validate every request against its declared JSON Schema before the handler runs. A
request that fails validation is rejected with a **structured error envelope** — a
JSON object with a stable machine-readable `code`, a human-readable message, and
enough structure for a caller to act on — carrying an appropriate 4xx status, and it
never reaches business logic. Errors are structured objects, never bare strings, and
the error envelope schema is itself part of the declared OpenAPI contract so error
responses validate against it just as success responses do. Secrets, credentials, and
upstream payloads never appear in an error envelope or in the served description.

## Self-description served from the contract at /openapi.json

Serve the OpenAPI document at `/openapi.json`, produced from the same declared
contract used for validation — never a separately maintained copy. The identity of
the served description must equal the surface's `declared_schema_identity`, so the
conformance oracle's fetch of `/openapi.json` matches the declared schema exactly.
This discoverable self-description is the surface's machine-readable documentation;
human narrative docs remain the deriving project's authority (ADR-0001), while the
framework owns the discoverable description and its conformance.

## Semantic API versioning and compatibility

Version the surface with a semantic version and expose it under **versioned routes**
(e.g. a `/v1/` route prefix), so a breaking change is a new version rather than a
silent mutation of an existing route. Carry the compatibility promise with ADR-0005's
`CompatibilityPromise` — the same machinery a Component public interface uses — rather
than inventing a second version or compatibility notion. A consumer binds against a
declared surface version and can be checked against a version transition the same way
a public-interface change is checked. Additive, backward-compatible changes stay
within a major version; a breaking change is a major-version transition with a new
route family.

## Deployment unit and conformance oracle

The REST surface is served by a **persistent-service deployment unit** launched via
the shipped `--litai-serve` path — it is **not a new entrypoint kind**. That same
deployment unit additionally declares an **IPC-surface conformance oracle**: a
verifier document whose schema is `literate-ai/ipc-surface-conformance-acceptance@1`
with `protocol` set to `"rest"`, a `declared_schema_identity` equal to the served
`/openapi.json`'s identity, a `description_probe` fetching `/openapi.json`, declared
`request_cases` whose responses must validate, a `surface_version`, and a
`CompatibilityPromise`. When a persistent-service deployment unit's verifier document
declares this schema, the framework routes acceptance to the IPC-surface conformance
oracle (over the plain HTTP probe): it launches the surface, fetches `/openapi.json`,
asserts it matches the declared schema, drives the declared cases, and validates each
response — failing closed on a served description that does not match the declared
schema or a response that does not validate. Deterministic fixtures only; the oracle's
expected values are verifier-only material and never enter a generation prompt
(ADR-0005 authority boundary). The framework's own protocol-neutral IPC-surface core
(`IpcSurfaceConformanceAcceptance`, `decide_ipc_surface_conformance`,
`HttpIpcSurfaceProbe`) and its deterministic tests already prove this machinery; a
generated REST surface honoring this skill plugs into that core unchanged, so REST is
an adapter of the one contract and never a drifting standalone.
