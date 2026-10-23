---
name: "python-service-application"
description: "Python ASGI service delta: HTTP API conventions, MCP transport choice, and scheduled workers. Use for Literate AI workflow tasks when lang-python is selected with the back-end parent."
metadata:
  author: "Literate AI maintainers <literate-ai-maintainers@users.noreply.github.com>"
schema: "urn:literate-ai:schema:v1:specification-to-source-skill"
skill_id: "python-service-application"
version: "1.1.0"
title: "Python service application generation"
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
  - schema: "urn:literate-ai:schema:v1:skill-reference"
    skill_id: "mcp-application"
    version: "1.0.0"
    identity:
      schema: "urn:literate-ai:schema:v1:content-identity"
      algorithm: "sha256"
      digest: "3170803f41b234fbc642da2b7bd2f5bcb5eba9a4931bd5bde9b47948c7e2a979"
limitations:
  - "Do not block the event loop with synchronous I/O inside async request handlers; use an async driver or run blocking work in a worker thread."
  - "Do not invent an OpenAI-compatible endpoint shape ad hoc; match the upstream OpenAI API's field names and error envelope exactly for any endpoint claimed OpenAI-compatible."
  - "Do not let a scheduled worker's failure on one unit of work abort the run for the rest; isolate and report per-unit failure."
  - "Do not copy MCP hygiene, identity pins, or secret rejection; the MCP parent owns those rules."
trust: "repository-reviewed"
---
# Python service application generation

This skill is a delta of `backend-application` and `mcp-application`. Apply it only
when `lang-python` is selected. The back-end parent owns process shape, store
ownership, and the Flavor index. The MCP parent owns tools versus resources, schema
validation, structured errors, and secret rejection.

## Standard lifecycle serve mode

The persistent-service entrypoint is a runnable artifact the Standard lifecycle
drives after source custody is gone, exactly as a portable application's artifact
dispatches `--litai-test` and `--litai-smoke`. Before ordinary argument parsing,
the service entrypoint SHALL recognize one framework-owned, non-product mode:
`--litai-serve`. In this mode it SHALL bind the host and port given by the
following `--host <address>` and `--port <number>` arguments (defaulting to
`127.0.0.1` and the port the acceptance harness supplies), start the HTTP API,
and stay alive serving requests until it receives a termination signal — it does
not run one request and exit. It SHALL expose a `GET /health` readiness endpoint
that returns HTTP 200 once the service is ready to answer, so the lifecycle can
poll for readiness before issuing acceptance requests. Keep the mode dispatcher
thin: `--litai-serve` starts the same ASGI application the product runs, it is
not a second, simplified server. The lifecycle launches this served process so it
can poll `{base_url}/health`, drive the contract's request cases, and then
terminate the process tree; a service that runs one shot and exits, or never
binds the port, fails acceptance closed. Do not expose `--litai-serve` as product
behavior and do not read the acceptance contract from inside the artifact.

## HTTP API

Build the HTTP API with an ASGI framework (FastAPI or equivalent). Use dependency
injection for the database session and any shared service objects rather than
constructing them inline in each handler. Use the framework's native request/response
model validation (Pydantic v2 or equivalent): validators and model config use the
current, non-deprecated API, not a superseded v1-style validator or config class. Every
handler declares an explicit response model and an explicit status code; error paths
raise a typed HTTP exception carrying a real HTTP status code, never a bare 500 for a
client-caused failure. Group related endpoints into one router per resource, mounted
with an explicit path prefix and tag. Treat the framework's generated OpenAPI document
as the live contract; after adding or changing a router, regenerate and check it.
Exercise the API in tests through an async HTTP client against the running app, not by
calling handler functions directly.

Any endpoint claimed to be OpenAI-API-compatible must match the upstream OpenAI API's
request and response field names exactly, including the error envelope
(`{"error": {"message", "type", "param", "code"}}`), streaming framing
(`data: {...}` Server-Sent Events chunks terminated by a literal `data: [DONE]` line
when `stream: true`), and list-endpoint envelope (`{"object": "list", "data": [...]}`).
Do not approximate this shape; a client written against the real OpenAI API is the
acceptance bar.

Every collection endpoint, whether OpenAI-compatible or project-specific, paginates
explicitly (cursor-based: an opaque `next_cursor` plus a `has_more` flag) rather than
returning an unbounded array. Resource URIs are nouns, not verbs
(`GET /nodes/{id}`, not `GET /getNode/{id}`).

## MCP transport

Expose this project's own MCP server as a separate entrypoint from the HTTP API,
sharing the same read-only database access layer. Choose the transport deliberately:
stdio for a single local client, HTTP/SSE when the server must serve multiple
concurrent callers, since a service built on this skill exists specifically to make
expensive upstream queries cheap to repeat.

## MCP SDK by selected language Flavor

This embedded application server is not the operator catalog and not a WebMCP
page. Use the SDK that matches each **selected** language Flavor on the
Component lock. Omit any row whose Flavor is not selected. Do not add these
libraries to the `litai` wheel. Do not use a GPL implementation.

- `lang-python` (this skill's default): official Python SDK, PyPI package
  `mcp`, repository `modelcontextprotocol/python-sdk` (MIT). Generated
  services depend on `mcp` themselves. The optional extra `literate-ai[mcp]`
  installs the same module next to `litai`; it is not required for CLI
  stdio fan-out.
- `lang-javascript`: official TypeScript/JavaScript SDK,
  `@modelcontextprotocol/sdk` from `modelcontextprotocol/typescript-sdk`
  (MIT, Apache-2.0 for new contributions).
- `lang-go`: official Go SDK `github.com/modelcontextprotocol/go-sdk`
  (MIT, Apache-2.0 for new contributions).
- `lang-rust`: official Rust SDK crate `rmcp` from
  `modelcontextprotocol/rust-sdk` (MIT / Apache-2.0 as published).
- `lang-swift`: official Swift SDK product `MCP` from
  `modelcontextprotocol/swift-sdk` (MIT, Apache-2.0 for new contributions).
- `lang-cpp`: no official SDK. Use the MIT community SDK `hkr04/cpp-mcp` or
  the Apache-2.0 `GopherSecurity/gopher-mcp`.

## Scheduled worker

The worker runs on the specification's declared schedule, not on demand from a
request. It enumerates every unit of upstream work, fetches that unit's current state
from the upstream source, and upserts it into the local database keyed so that
repeated runs accumulate history rather than overwrite it. A failure fetching or
writing one unit is caught, logged with enough context to identify which unit failed,
and does not stop the worker from continuing to the next unit. The worker records its
own run outcome (start time, per-unit success/failure counts, completion time) so the
HTTP API and MCP server can answer how stale the data is without guessing.
