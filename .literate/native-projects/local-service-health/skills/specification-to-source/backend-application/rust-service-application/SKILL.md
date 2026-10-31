---
name: "rust-service-application"
description: "Rust async service delta for the back-end parent. Use for Literate AI workflow tasks when lang-rust is selected with the back-end parent."
metadata:
  author: "Literate AI maintainers <literate-ai-maintainers@users.noreply.github.com>"
schema: "urn:literate-ai:schema:v1:specification-to-source-skill"
skill_id: "rust-service-application"
version: "1.0.0"
title: "Rust service application generation"
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
  - "Do not add crates the specification did not name; prefer the Rust standard library and the selected Flavor's ecosystem skill."
  - "Do not block the async runtime with synchronous I/O on a request path."
  - "Do not copy MCP hygiene, identity pins, or secret rejection; the MCP parent owns those rules."
  - "Do not apply this chapter unless `lang-rust` is selected."
trust: "repository-reviewed"
---
# Rust service application generation

This skill is a delta of `backend-application` and `mcp-application`. Apply it only
when `lang-rust` is selected. Follow the Rust ecosystem layout skill for Cargo layout
and derived `target/` state.

## Standard lifecycle serve mode

The persistent-service entrypoint is a runnable artifact the Standard lifecycle
drives after source custody is gone, exactly as a portable application's artifact
dispatches `--litai-test` and `--litai-smoke`. Before ordinary argument parsing,
the service entrypoint SHALL recognize one framework-owned, non-product mode:
`--litai-serve`. In this mode it SHALL bind the host and port given by the
following `--host <address>` and `--port <number>` arguments (defaulting to
`127.0.0.1` and the port the acceptance harness supplies), start the async HTTP
service, and stay alive serving requests until it receives a termination signal —
it does not run one request and exit. It SHALL expose a `GET /health` readiness
endpoint that returns HTTP 200 once the service is ready to answer, so the
lifecycle can poll for readiness before issuing acceptance requests. Keep the mode
dispatcher thin: `--litai-serve` starts the same service the product runs, not a
second simplified server. The lifecycle launches this served process so it can
poll `{base_url}/health`, drive the contract's request cases, and then terminate
the process tree; a service that runs one shot and exits, or never binds the
port, fails acceptance closed. Do not expose `--litai-serve` as product behavior
and do not read the acceptance contract from inside the artifact.

## HTTP and worker

Expose the HTTP API as an async service with explicit typed errors and bounded
timeouts. Collection endpoints paginate. Resource paths are nouns. The scheduled
worker, when specified, is the store's only writer, isolates per-unit failure, and
records run outcome for staleness. Do not call the upstream source from a request
handler.

## MCP transport

Expose embedded MCP as a separate entrypoint sharing the read-only store. Choose
stdio or HTTP/SSE as the back-end parent describes. Inherit the MCP parent's
tool/resource/schema/error rules.
