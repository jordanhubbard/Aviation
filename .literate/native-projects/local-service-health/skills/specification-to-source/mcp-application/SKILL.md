---
name: "mcp-application"
description: "MCP as a product protocol for generated applications: tools, resources, schema validation, and structured errors. Use for Literate AI workflow tasks that expose MCP in a page, process, or service. Do not use for operator catalog setup."
metadata:
  author: "Literate AI maintainers <literate-ai-maintainers@users.noreply.github.com>"
schema: "urn:literate-ai:schema:v1:specification-to-source-skill"
skill_id: "mcp-application"
version: "1.0.0"
title: "MCP application protocol"
stages:
  - "plan"
  - "generate"
dependencies: []
limitations:
  - "Do not treat a maintainer's personal MCP catalog or reserved operator ids as product authority."
  - "Do not put secrets, tokens, or credential-shaped bytes in generated MCP descriptions, schemas, or tool names."
  - "Do not fold MCP tools (invoked actions) into MCP resources (readable URIs), or the reverse."
  - "Do not require a project `mcps/` catalog item, a plugin adapter, or a hidden generation-time MCP as a condition of generating product MCP."
trust: "repository-reviewed"
---
# MCP application protocol

MCP is one protocol. Nested skills are deltas of this parent: they add a leaf
(transport, in-page actuation, or language ecosystem) without restating hygiene,
identity pins, or secret rejection.

## MCP is the first adapter of the unified IPC surface

MCP is one **adapter of the framework's IPC-surface notion** (ADR 0029), not a
standalone protocol — its peers `rest-application` (OpenAPI/JSON-Schema) and
`grpc-application` (`.proto` + reflection) are the other two adapters of the same
contract. Every adapter exposes the same four surface properties, which this
parent already requires for MCP and only names generically here: a **declared
schema** (schema-validated input, typed output, structured errors — below); a
**served self-description** a consumer or verifier can fetch (for MCP, the
tool/resource listing; for REST, `/openapi.json`; for gRPC, server reflection);
a **conformance acceptance** that fails a surface whose served description does
not match its declared schema (the verifier-owned
`literate-ai/ipc-surface-conformance-acceptance@1` oracle, protocol tag `mcp`,
launched via `--litai-serve`); and a **semantic version + compatibility promise**
reusing the framework's existing `CompatibilityPromise`. An MCP surface is not a
new entrypoint kind — a deployment unit exposes it. Do not invent a second schema,
self-description, or version mechanism when a surface already declares one.

## One protocol, four distinct leaves

Keep these leaves distinct. Do not collapse them in generated source or in this
recipe:

1. **Personal operator catalog** — MCP servers a *user* opts into for the coding
   session. That catalog is not product policy and must not appear as a generation
   requirement.
2. **Project MCP hygiene** — servers the *project* versions under `mcps/<id>/mcp.md`
   with identity pins, no secrets, and no duplicate ids. Catalog hygiene is not an
   application entrypoint.
3. **Embedded application MCP** — a generated process exposes tools and resources as
   product behavior (stdio or HTTP/SSE). Nested backend skills own the process and
   store; they inherit this protocol chapter.
4. **WebMCP** — the same protocol *in the page*: JavaScript functions or HTML tools
   registered for in-browser agents. Nested WebMCP skills inherit this chapter and
   add in-page actuation. WebMCP is not a second protocol and is not a backend
   integration that bypasses the page.

## Tools, resources, and errors

Expose tools (actions and parametrized queries the caller invokes) separately from
resources (readable context addressed by URI). Validate every tool's input against an
explicit schema before executing it, and reject invalid input with a structured error
rather than executing a partially-valid call. Every tool has a concise description
covering what it returns and its parameters' constraints. Errors returned to an MCP
caller are structured, not a bare string. Do not invent a second tool schema language
when the specification already names MCP.

## Hygiene this parent owns

Pin MCP identity the same way skills pin identity: a stable id, a semantic version,
and exact bytes after modify. Reject secrets in tool descriptions and sibling
generated metadata. Do not reuse reserved operator ids (`jira`, `slack`, `outlook`,
`registry`) as product tool or server names. Nested skills inherit these rules; they
must not copy them.
