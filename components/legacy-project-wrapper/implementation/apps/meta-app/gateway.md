# Meta App edge API contract

Meta App serves its HTML launcher at `/` and a gateway-owned public contract at
`/api/v1`. GET `/api/v1/services` discovers all service namespaces, direct URLs,
and MCP tools. GET `/api/v1/openapi.json` serves the corresponding OpenAPI 3.1
description. `gateway-contract.json` is the shared HTTP/MCP schema authority.

A service-relative path follows the namespace, retaining the service's current
API prefix. For example POST `/api/v1/planning/api/plan` forwards to the planner's
`/api/plan`; GET `/api/v1/weather/briefing` forwards to weather briefing. HTTP
preserves methods, query strings, raw bodies, response status and streaming.
Unknown Meta App versions/namespaces return JSON errors; they never fall through
to the launcher. A known namespace preserves upstream status/content types,
including HTML authentication failures or redirects; MIME type alone is not a
service error.

`/mcp` exposes Streamable HTTP MCP tools `v1.<namespace>.request` and readable
catalog/OpenAPI resources. Each tool uses the same service path and explicit
headers/body; responses contain status, headers and a UTF-8 or base64 body.
Compressed responses and text that is not valid UTF-8 use base64 so callers can
recover the original bytes and apply the declared content encoding/charset.
MCP buffers at most 4 MiB; use HTTP for streaming or larger downloads. Tool
validation precedes upstream execution. Transport cookies and Authorization
never become service credentials. Upstream failures retain status and structured
content; transport failures have a stable gateway error code.

Public v1 is independent of upstream versions. Bindings select trusted origins
and reviewed adapters. An adapter translates request paths/bodies and response
headers/bodies where needed. Updating a provider requires conformance tests
against the frozen public contract; incompatible public behavior requires v2.
An identity binding does not automatically make arbitrary upstream breaking
changes compatible. Direct service APIs remain independently accessible.

Only operator configuration `AVIATION_GATEWAY_BINDINGS` may change origins,
base paths or select a declared adapter; callers cannot supply destinations.
The JSON maps namespace to `{origin, basePath, adapter}`; defaults use each
service's public HTTPS origin, empty basePath and `identity` adapter. Secrets
must be supplied by callers to the destination service, never configured as
gateway-wide injected credentials. Each service retains its own authorization.
Host/origin checks protect MCP; API CORS is not granted to arbitrary origins.
Browser gateway cookies use names and paths scoped to their namespace. MCP
Cookie headers are explicit service cookies and are passed as supplied; tool
responses retain service Set-Cookie values. Transport cookies are never inherited. Redirects are
not followed, and same-service locations are rewritten through the namespace.
HTTP timeout is 180 seconds; unsafe paths and hop-by-hop headers are rejected
or removed. WebSocket service upgrades are not part of this first public
contract; clients continue using direct WebSocket service endpoints.

Acceptance uses real local upstream servers and an MCP client, covering routing,
upstream relocation/version adapters, auth, cookies, redirects, binary bodies,
streaming, bounded failures and schema parity. Hosted checks are read-only.
