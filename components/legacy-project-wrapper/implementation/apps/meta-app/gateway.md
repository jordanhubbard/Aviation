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
The JSON maps namespace to `{origin, websocketOrigin?, basePath, adapter}`; defaults use each
service's public HTTPS origin, empty basePath and `identity` adapter. Secrets
must be supplied by callers to the destination service, never configured as
gateway-wide injected credentials. Each service retains its own authorization.
Host/origin checks protect MCP; API CORS is not granted to arbitrary origins.
Browser gateway cookies use names and paths scoped to their namespace. MCP
Cookie headers are explicit service cookies and are passed as supplied; tool
responses retain service Set-Cookie values. Transport cookies are never inherited. Redirects are
not followed, and same-service locations are rewritten through the namespace.
HTTP timeout is 180 seconds; unsafe paths and hop-by-hop headers are rejected
or removed. WebSocket upgrades use the same namespaced paths and private bindings.
The handshake deadline is 180 seconds; established sessions stream in both directions
until a peer disconnects or the gateway stops. Origin must match the destination
application or Meta App when present. Protocol negotiation and initial upgrade bytes
are preserved. MCP remains a request/response interface, with HTTP/WebSocket used
for live transport.

## Central application ingress

In production, each application hostname also terminates at Meta App. The gateway
selects that hostname's namespace from the same catalog and forwards its original
path to the private provider. HTML, assets, API calls, forms, uploads and live sockets
therefore share the central routing layer without changes to app URLs or local
standalone development. Native host routes retain their own cookie names, paths,
redirects and CSRF Origin headers; they do not interpret Meta App's discovery or MCP
paths. On Meta App's hostname, `/api/v1` continues to isolate cookies by namespace.
Providers receive their canonical public Host and HTTPS forwarding metadata. Client
IP forwarding is accepted only from the loopback reverse proxy in application-host
mode, using the final address appended by Caddy.

Enable this mode explicitly with `AVIATION_GATEWAY_APP_HOSTS=1`. It requires an
explicit binding for every service and refuses public ingress destinations that
would recurse. The deployment manifest derives these bindings from service loopback
ports, including a separate `websocketOrigin` when a service has a separate live
listener. Flight Tracker publishes that listener only on host loopback port 18777.
The Meta App container alone uses host networking and listens strictly on
`127.0.0.1`, allowing it to reach both Docker services and the native analyzer.
Every other container keeps its existing isolated network and loopback publication.
The deployed Caddy sites forward to Meta App's loopback port. Native app responses
include `X-Aviation-Gateway: v1` and `X-Aviation-Namespace` for cutover verification.
The central process is now an availability dependency for every public application;
private providers remain independently reachable on the host.

Acceptance uses real local upstream servers and an MCP client, covering routing,
upstream relocation/version adapters, auth, cookies, redirects, binary bodies,
streaming, bounded failures, native sessions for every app host, real WebSocket
frames and schema parity. Hosted checks are read-only.

## General aviation operation discovery

The planning catalog entry also advertises `/api/v1/planning/api/openapi.json`.
Read MCP resource `aviation://v1/planning/openapi` or call tool
`v1.planning.describe` with `{}` for the full planner operation schemas. Then call
`v1.planning.request` using the documented operation's service-relative path,
including `/api`. This includes aircraft reference profiles, performance and
loading calculations, cross-country navigation logs, airport runways/frequencies
and dated facility service codes, terrain, GeoJSON airport/navaid/class-airspace
layers, NOAA aviation weather products and FAA TFR summaries. Unknown fuel prices,
FBO hours and provider failures remain explicit; TFR summaries are not a complete
NOTAM briefing. Generic v1 request tools remain compatible.

Run the read-only domain audit from the repository root:

```sh
python3 components/legacy-project-wrapper/implementation/deploy/verify_ga_mcp.py \
  --report _build/ga-mcp-report.json --expected-revision <deployed-git-sha>
```

The audit checks actual data through MCP, independent calculation examples,
HTTP/resource/tool schema parity and error statuses. The optional base URL supports
an isolated local gateway. It never saves flight plans or aircraft records.
