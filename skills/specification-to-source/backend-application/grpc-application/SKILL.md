---
name: "grpc-application"
description: "gRPC/protobuf as an IPC-surface adapter for the back-end parent: a `.proto` service/message contract as the single source of truth, schema-validated typed messages, structured gRPC status errors, server reflection + a FileDescriptorSet self-description generated from the contract, protobuf back-compat discipline, a versioned service package, and an IPC-surface conformance oracle. Use for Literate AI workflow tasks that expose a described, versioned gRPC service from a generated back-end."
metadata:
  author: "Literate AI maintainers <literate-ai-maintainers@users.noreply.github.com>"
schema: "urn:literate-ai:schema:v1:specification-to-source-skill"
skill_id: "grpc-application"
version: "1.0.2"
title: "gRPC application IPC-surface adapter"
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
  - "Do not hand-author the served descriptor separately from the `.proto`; server reflection and the FileDescriptorSet descriptor are generated from the same `.proto` contract that types the messages, so the self-description can never silently drift from behavior."
  - "Do not accept an untyped or unvalidated message on any RPC; every request message is a protobuf-typed message defined in the `.proto` and decoded against its declared message type before the handler runs — no partially-valid calls."
  - "Do not return a bare string or an ad-hoc error payload; errors are structured gRPC statuses with a canonical status code (and typed error details when carried), never a stringly-typed failure smuggled through a success response."
  - "Do not treat gRPC as a standalone protocol; it is one adapter of the unified IPC surface (ADR-0029). Reuse the IPC-surface conformance oracle (`literate-ai/ipc-surface-conformance-acceptance@2`, protocol `\"grpc\"`) and ADR-0005's `CompatibilityPromise`; do not invent a second contract, a second self-description mechanism, or a second version/compatibility notion."
  - "Do not renumber or reuse protobuf field numbers, and do not repurpose a removed field's number or name; reserve removed field numbers and names and only add new fields with fresh numbers — this back-compat discipline is the compatibility promise, not a separate convention."
  - "Do not call an expensive upstream source from an RPC handler path; inherit the back-end parent's rule that only a scheduled worker or equivalent background job may talk to that source, and answer gRPC calls from the local store."
  - "Do not bake product service names, product message schemas, credentials, or application vocabulary into this template; those stay in the deriving project's authority (ADR-0001 boundary). This is a provider-neutral gRPC surface pattern, not a product API."
  - "Do not make the gRPC surface a new entrypoint kind; it is a persistent-service deployment unit launched via the shipped `--litai-serve` path that ALSO declares the IPC-surface conformance oracle."
  - "Do not copy the back-end parent's process shape, store ownership, or Flavor index; inherit them."
trust: "repository-reviewed"
---
# gRPC application IPC-surface adapter

This skill is a delta of `backend-application`. Pin the parent in the recipe.
Apply it when the specification asks a generated service to expose a gRPC/protobuf
API to out-of-process callers — a typed, streaming-capable service boundary is the
canonical case. gRPC is **not a standalone protocol**: it is one **adapter of the
unified IPC surface** introduced by ADR-0029, exactly as `mcp-application` is the MCP
adapter and `rest-application` is the REST adapter. The same four surface properties
apply here, specialized to gRPC/protobuf with a `.proto` service contract. The
back-end parent already owns process shape, store ownership, the Flavor index, and
the rule that only a background worker may reach an expensive upstream source; this
delta owns only what makes the gRPC surface a *described, versioned,
conformance-tested* contract rather than "a gRPC service" in prose.

## The IPC surface, specialized to gRPC

An IPC surface is a Component boundary that exposes named operations to
out-of-process callers under four properties (ADR-0029). For gRPC they are:

1. **A declared schema.** The service's RPCs, request messages, response messages,
   and error details are described by a `.proto` service/message contract. Every
   request is a protobuf-typed message decoded against its declared message type
   before its handler runs; a message that does not decode against its declared type
   is rejected with a structured gRPC status, never executed as a partially-valid
   call. Every response is a protobuf-typed message of the declared response type,
   and every failure is a structured gRPC status — never a bare string.
2. **A served self-description.** The surface enables **server reflection** and serves
   its own `.proto`/`FileDescriptorSet` descriptor, **generated from the declared
   `.proto`**, never hand-drifted from it. A consumer or a verifier can query
   reflection and fetch the descriptor to learn the exact contract the surface
   honors. This served descriptor is the primary, always-current API documentation
   (ADR-0029): because it is generated from the declared `.proto` and
   conformance-checked, it cannot silently diverge from behavior.
3. **A conformance acceptance oracle.** The surface declares an IPC-surface
   conformance oracle so the verifier launches it via `--litai-serve`, fetches the
   served reflection descriptor, asserts the served descriptor matches the declared
   `.proto` schema, drives the declared request cases, and validates each response
   protobuf message against its declared message type. It fails closed on a served
   descriptor that does not match the declared schema and on any response that does
   not decode against the declared type.
4. **A version + compatibility promise.** The surface carries a semantic version and
   an ADR-0005 `CompatibilityPromise`, expressed as protobuf back-compat discipline
   in a versioned service package. A breaking change is a version transition a
   consumer's binding can be checked against — the same way a Component
   public-interface change is checked today.

## The `.proto` contract as the single source of truth

Model the service and its messages once, in the `.proto` document, and derive
everything else from it. The contract names each RPC (service method with its request
and response message types, including any client/server streaming), each message's
typed fields with stable field numbers, and the structured error detail messages
carried alongside a gRPC status. The generated server stubs, the typed message
classes, the served reflection descriptor, and response decoding are all projections
of this one `.proto` — not parallel definitions that can drift. Do not maintain a
second schema language when protobuf already describes the surface; do not let a
handler accept or emit a field the `.proto` does not declare.

## Typed messages and structured gRPC status errors

Every request and response crosses the boundary as a protobuf-typed message decoded
against its declared type. A message that fails to decode, or a call that cannot be
served, is rejected with a **structured gRPC status** — a canonical status code plus
a message, and typed error-detail messages when the contract carries them — never a
bare string and never a failure smuggled through a success response. The error detail
messages are themselves part of the declared `.proto` contract, so error responses
are as typed and validatable as success responses. Secrets, credentials, and upstream
payloads never appear in a status message, an error detail, or the served descriptor.

## Server reflection + descriptor as the served self-description

Enable server reflection and serve the `.proto`/`FileDescriptorSet` descriptor,
produced from the same declared `.proto` used to type the messages — never a
separately maintained copy. The verifier binds the raw declared `FileDescriptorSet` bytes to
`declared_schema_identity` and requires the complete dependency closure. Reflection
returns individual file descriptors; their raw wire bytes need not hash to the
FileDescriptorSet identity. The native adapter compares the exact filename set and
same-runtime deterministic file encodings, treating omitted and explicit default
JSON names equivalently while rejecting custom-name drift and preserving declarations,
dependencies, options and source information. Missing files, extra files and conflicting
descriptors refuse acceptance. Identical dependencies repeated across separate reflection
replies are collected once. This comparison does not claim cross-runtime canonical
protobuf serialization.

The served descriptor remains machine-readable documentation. Human narrative docs
and product schemas remain the deriving project's authority (ADR-0001).

## Protobuf back-compat discipline and versioned service package

Version the surface with a semantic version and place the service in a **versioned
service package** (e.g. a `v1` package suffix), so a breaking change is a new package
rather than a silent mutation of an existing service. Carry the compatibility promise
as **protobuf back-compat discipline** wired through ADR-0005's `CompatibilityPromise`
— the same machinery a Component public interface uses — rather than inventing a
second version or compatibility notion. Never renumber a field, never reuse a removed
field's number or name; reserve removed numbers and names, and add new fields with
fresh numbers. These additive, backward-compatible changes stay within a major
version and package; a breaking change is a major-version transition with a new
versioned package. A consumer binds against a declared surface version and can be
checked against a version transition the same way a public-interface change is checked.

## Deployment unit and conformance oracle

Use a persistent-service deployment unit launched through `--litai-serve`. Its
verifier-only acceptance document uses
`literate-ai/ipc-surface-conformance-acceptance@2` with `protocol` set to `"grpc"`.
Version 2 retains the common specification identity, surface version, compatibility
promise and process budget. Existing REST `@1` documents retain their contract.
Legacy non-REST `@1` documents require an explicitly supplied protocol adapter.

The independent verifier declares the complete binary `FileDescriptorSet`, its raw
SHA-256 identity, and bounded native RPC cases. Each case binds the fully qualified
method, protobuf input/output types, one of the four unary/stream cardinalities,
ordered request and response bytes, canonical status, status text, typed error
details and a finite timeout. These are native protobuf expectations, not HTTP
request/response probes. Keep all oracle cases, expected values and verifier-only
descriptor material out of the generation prompt (ADR-0005). Generate the service
from its public Component contract and selected Flavors.

The default `GrpcIpcSurfaceProbe` requires the optional `grpc-acceptance` runtime.
It refuses missing dependencies before launch, waits for native channel readiness,
collects reflection, and validates message types and ordered wire-exact observations.
Reflection and RPC deadlines consume the remaining process budget. Acceptance binds
raw reflection and RPC observations for independent checking. The lifecycle shuts the
child service down on success and refusal; successful loading or a readiness check
alone is not conformance acceptance.

Use deterministic fixtures and exercise every RPC shape the Component declares,
including its failure statuses and deadline behavior. A generated surface still
requires installed public-lifecycle qualification with retained observations; the
framework's adapter tests alone do not qualify a generated implementation.
