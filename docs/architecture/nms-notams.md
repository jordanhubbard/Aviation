# FAA NMS NOTAM integration

Behavioral authority for [#503](https://github.com/jordanhubbard/Aviation/issues/503),
within [#488](https://github.com/jordanhubbard/Aviation/issues/488).

## Provider contract and environment

Use the owner-supplied NMS API 1.0.18 (2026-02-12) specification and FAQ.
Keep original onboarding materials, keys, secrets and bearer tokens private.
The server authenticates with distinct client ID/key and secret using HTTP Basic
and form-encoded grant_type=client_credentials at /v1/auth/token on the selected
provider origin. Data endpoints are under /nmsapi/v1. Allow only explicitly
selected production, staging or FIT origins. Never send credentials to redirects.
Cache bearer tokens in memory until shortly before expires_in, coordinate refresh
and retry a data request once after HTTP 401. Treat HTTP 429 as rate limited,
retain a bounded Retry-After and do not retry immediately. Bound decoded bodies;
redact upstream bodies, URLs containing content tokens and credentials from errors.

Environment selection is explicit. Staging/FIT data may contain test NOTAMs and
must never be displayed as production operational data. Actual November 16 probes
using the supplied pair returned staging authentication/ping/data HTTP 200 and
production authentication HTTP 401. This is environment-scoped acceptance only.

## Coordinated synchronization

All suite consumers query one backend-owned durable cache. Do not call NMS for
each airport, route, browser or application. Production allows at most one delta
pull per 180 seconds and one full load per 24 hours. A complete daily load may
use one initial-load request or the documented classification pulls as one full
load. The supplied schema enumerates DOMESTIC, FDC, INTERNATIONAL, MILITARY and
LOCAL_MILITARY: a GeoJSON full-load cycle must cover every enumerated classification,
including empty classes, before coverage can be declared complete. Preserve rate reservations across processes and restarts, including failed
requests; honor longer provider Retry-After values. Staging requests are limited
to at most one per second. A token refresh must not create an extra data pull.

Build a full snapshot independently and publish atomically only when complete;
retain the previous snapshot on failure. Ingest deltas with roughly 60-second
overlap, stable identifiers and modification ordering, including cancellation and
replacement updates. Never move the last-success watermark after a failed or
partial response. A delta cannot bridge more than the provider's 24-hour lookback;
require a new full load when coverage cannot be established. Preserve source
geometry, schedules, vertical limits, raw text/translations, permanent/estimated
expiry and exact UTC timestamps. Expiry is evaluated locally even without a
delta because ordinary expiry does not generate an upstream update.

Content downloads follow only validated provider-relative /nmsapi/v1/content/
paths on the same origin with the bearer header. Do not expose those temporary
paths to browsers or follow arbitrary upstream redirects with authorization.
Preserve source notice text up to 1 MiB per record and bounded bulk payloads
(up to 128 MiB transferred/256 MiB inflated), without silent truncation. These
bounds accommodate the observed international notices of nearly 200,000 characters.
Validate decompression, response envelopes, provider errors and every record
before admitting a new cache state. Missing source text, start time, type or expiry stays unknown
and must be visibly classified as incomplete/unknown with explicit missing fields; never manufacture a normal/new type or a
permanent expiry. Retained bulk originals carry durable cycle/classification/hash
receipts so a parser repair can reprocess that exact response without another FAA
pull or a fabricated fresh retrieval time. A partial or malformed snapshot is not empty
NOTAM coverage.

## Consumers and acceptance

Expose typed source/environment/freshness/coverage status through the planning
HTTP API, legacy adapters and Meta HTTP/MCP discovery. Weather Briefing and other
applications use that common service rather than retaining legacy key-as-secret
calls. Airport and route UI show effective/cancelled/expired/scheduled status,
source timestamps, incomplete/stale/unavailable states and NMS's incomplete
non-US coverage. FAA NMS is not authoritative for all foreign NOTAMs. Results identify how many matched
records lack essential source fields; fresh results containing those records are
partial, not fully available. Coverage older than four minutes is stale, and a
future synchronization clock is never considered fresh.

The supplied FAQ states there are no display/redistribution restrictions beyond
usage expectations; preserve source attribution and coverage cautions. Credentials
and tokens stay server-side and outside logs, issues, saved plans and public
caches. Deterministic HTTP/lifecycle tests complement actual staging provider,
HTTP/MCP and desktop/mobile evidence. Production acceptance requires actual
production authentication/data evidence, reviewed merge, exact-head/main CI and
hosted deployment verification. No mock or staging response proves production.

## Worker ownership

The feed runs as an explicit foreground process, separate from web startup:
`python -m app.services.nms_worker` (or `--once` for one reserved operation).
The operator must select `FAA_NMS_ENVIRONMENT` and supply distinct server-only
`FAA_NMS_CLIENT_ID`/`FAA_NMS_CLIENT_SECRET` values through the environment or
keystore. `FAA_NMS_CACHE_DIR` selects the shared durable directory; otherwise use
`DATA_DIR/nms/<environment>` under the backend data directory. Never put secrets
in command arguments. Merely importing the worker or starting the web application
does not contact FAA. SIGTERM/SIGINT interrupt an in-flight main-thread read,
release its reservation without advancing coverage and close the client. Idle
waits are interruptible; unchanged status is not repeatedly logged.
