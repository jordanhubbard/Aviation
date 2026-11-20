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
(GeoJSON up to 128 MiB transferred/256 MiB inflated; retained AIXM bootstrap
has the separate streaming bound below), without silent truncation. These
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
HTTP/MCP and desktop/mobile evidence. Hosted activation may use the owner-authorized working environment after actual
authentication/data evidence, reviewed merge, exact-head/main CI and hosted
verification. Preserve its literal source environment and production_data=false
for staging/FIT. A production-host authentication refusal does not block use of
other authorized access and must not be described as missing owner authorization.

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

## Read API and consumer contract

Expose GET `/api/notams/capabilities`, GET `/api/notams?airport=KPAO,KSFO`
and GET `/api/notams/detail?id=<source-id>`, each with explicit operation IDs and
typed OpenAPI responses for HTTP/MCP discovery. The web process reads the shared
cache and never reads FAA credentials, starts synchronization, or calls FAA.
Environment and cache-directory selection match the worker; an absent/invalid
selection or unavailable/corrupt cache returns explicit unavailable state without
creating a new feed or presenting an empty successful briefing.

List queries require 1–100 source location identifiers, 2–8 ASCII alphanumeric
characters each, and use stable bounded pagination. Expand only location/ICAO
pairs actually present in source records, never by adding or removing country
prefixes. Return requested and matched identifiers and warn that unmatched source
aliases, international coverage and en-route geometry are not a complete briefing.
A fresh complete snapshot with zero matches is `no_reports`, meaning no matching
cached records, never a claim that no applicable NOTAM exists. Retain partial,
stale and unavailable distinctions; every response exposes the environment and
non-production warning. Missing source text, start/end/type and permanent expiry
remain explicit. Dates are UTC strings or null, not fake bounds for permanence.

List responses contain at most 100 notices with a 2,000-character display excerpt,
full text length, an explicit truncation flag and a same-service detail link.
Detail returns the unmodified full text and original GeoJSON feature, bounded to
16 MiB; oversized/unavailable detail fails explicitly. Never print temporary
content tokens, upstream bodies or credentials in error responses. Responses use
no-store so CDN/browser caching cannot hide locally evaluated expiry/freshness.

The common TypeScript SDK supplies a typed cached-report client. Weather Briefing
uses reports, source status, complete pagination, full notice text and warnings;
no client has FAA credentials or calls the old direct key-as-secret path. Existing
strict portable NOTAM normalization remains unchanged. Compatibility array helpers
may only project complete, current production reports that fit that strict shape;
otherwise they fail explicitly and direct callers to the richer report API. No
incomplete/permanent notice is silently discarded and no network failure triggers
sample data. Explicitly named sample generators remain test/development tools.

Pagination and detail carry a snapshot identity derived from the environment and
committed full/delta watermarks. Source alias matching, counts and page selection
read one transaction. Clients must reject mixed snapshots or changing totals,
and pin the snapshot for subsequent pages/details; a mismatch returns HTTP 409
and requires an explicit reload rather than publishing a silently mixed briefing.

## NOTAM workspace

Flight Planner provides a responsive NOTAM page with explicit location submission,
cache status, source timestamps, aliases and conspicuous non-production warnings.
It shows every loaded report's activity and missing-field states, original text
previews and full-source detail/download actions. Input changes/unmount abort
requests and prevent late responses from restoring the wrong airport. Source
freshness ages locally without network polling. Source data is rendered as text.
Only in-flight operations are aborted. Completed request ownership is released so
later input changes or unmount do not abort a response the browser already consumed.
Client body limits still cancel incomplete streams. Count bytes on one response
branch before consuming its native clone, keeping the buffered body within the
limit and allowing the browser to finish the network request. Oversize or failed
reads cancel both branches concurrently; successful reads do not cancel either.
The existing Weather Briefing UI/HTTP text endpoint uses the same SDK report
contract and preserves status, original full text, schedules and coverage warnings.

Web cache connections use SQLite read-only mode and never initialize or migrate
the store. The worker owns schema updates and can mount the same cache for writes
while the web service mounts it read-only, without any FAA credentials. Notices
show the original source number/series/year when supplied, retaining the opaque
source ID for audit/download identity. Missing source references remain unknown.

## Hosted worker deployment

The deployment manifest mounts a dedicated `nms` directory into Flight Planner
read-only at `/app/nms`, separate from its writable application data. Select the
web feed explicitly with `FAA_NMS_ENVIRONMENT` and
`FAA_NMS_CACHE_DIR=/app/nms/<environment>` in the planner's protected configuration.
Never place FAA client credentials in that web configuration or its keystore.

The operator installs an environment-specific worker unit from the same immutable
planner image using `deploy.py nms-worker-install --environment <environment>`.
Installation preserves cache contents/reservations, refuses to replace an active
worker, and neither enables nor starts a new unit. Its root-owned credential file
is `/etc/aviation/nms-<environment>.env`, containing only the distinct client ID and
secret. `nms-worker-start` validates that private file before explicitly enabling
and starting the unit; it is never coupled to web startup. `nms-worker-stop`
disables/stops only that environment's worker, and `nms-worker-status` reports unit
state without dumping credentials. Installation reload failure restores the prior
unit. Cadence state and originals are never rolled back or erased by deployment.

The worker runs without a published port, with a read-only container filesystem,
bounded memory and temporary storage, and its single writable cache mount at
`/var/lib/aviation/flight-planner/nms/<environment>`. The deployment image revision
is checked before installation. Process status alone does not prove feed health:
hosted acceptance must also verify the read API's environment, complete snapshot,
source synchronization age and HTTP/MCP/application behavior. Do not start a
production feed using credentials already rejected by production authentication.
When moving the feed between hosts, quiesce the old owner and transfer the whole
cache with its originals and reservations. Only one writable cache is authoritative
per account/environment; independent host-local databases do not coordinate an
account quota. Never reset cadence by starting from an empty directory.

Importing the application package for the worker must not import web routers or
initialize flight-plan/recording storage. Web dependencies are loaded by the
application factory only when creating the web service. A worker with an explicit
cache path must start on a read-only container filesystem without an unrelated
writable web data directory.

## Shared aviation-data consumers

The source catalog includes FAA NMS cache-read operations. Its configuration flag
means an explicit supported reader environment is selected, never that FAA client
credentials exist in the web process or that a live complete feed is available.
The shared aviation-data panel replaces the old hard-coded connection statement
with an explicit selected-location NOTAM reader. Creating a panel, loading weather,
changing a point, or opening source configuration does not request NOTAM reports.
Source selection follows the first route airport or explicitly selected weather
point, can be edited independently, and never assumes an IATA-to-ICAO alias.

Only an explicit NOTAM load reads the cache. Show returned status, environment,
production/complete flags, synchronized/full-load times, requested/matched aliases,
missing fields, warnings and counts. A zero match is an observation about the
cached selection only; stale/partial/unavailable or non-production data never
establishes absent production notices. Effectivity, cancellation, permanence,
estimated expiry, schedules, source type and exact identifiers stay visible.
Optional inactive records require an explicit selection. Report times do not
imply applicability at the separately selected forecast validity time.

Pagination and full-source detail pin the committed snapshot and original total;
changed snapshots/totals require a reload. Detail uses a constructed same-service
path and preserves full notice text and the original source feature. No provider
URL, untrusted HTML, upstream credential, automatic polling or model call is used.
Abort and clear stale notice/detail results on route, point, validity, inactive
selection, location changes or disconnection. NOTAM controls must not submit an
embedding application's booking form or change a pilot's decision.

## Retained AIXM initial-load bootstrap (#503)

The owner authorized hosted use of the supplied working access. Reuse a retained
all-class compressed AIXM/SOAP initial load from that account/environment instead
of requesting another full load within its daily reservation. The explicit seed
operator verifies the original SHA256, environment, actual retrieval time, SOAP
wrapper and every AIXM message. Stream at most512MiB inflated/128MiB transferred;
reject declarations/entities, truncation, conflicting IDs, oversized messages or
invalid required fields atomically. Preserve every original compressed byte.

Adapt the event NOTAM and FAA FNSE metadata into the existing notice projection.
UTC compact timestamps are decoded exactly; two-digit years require matching
source-issued century context within one year; absent values remain unknown. Keep
the complete serialized AIXM message and source format on the internal feature;
geometry is null until source GeoJSON supplies it. Never invent spatial coverage.
The UI downloads source AIXM for these records and original GeoJSON for native
GeoJSON records. The original full-load archive remains the byte-level witness.

Reserve the imported full-load cycle at its actual recorded retrieval time before
parsing. Publish only after a normal overlapping GeoJSON catch-up succeeds; use a
within-24hour catch-up window anchored to the validated source FeatureCollection
timeStamp with a60second overlap; validate numberReturned against all messages and refuse an older seed. A failed
seed keeps its full-load reservation and prior published cache. Only a registered
identical failed seed can be replayed offline. Preserve all source data/history.
When a same-version native GeoJSON update replaces an AIXM-adapted record, every
normalized notice field must agree (ignore only boundary ASCII whitespace in text
for this cross-format comparison; never rewrite stored/source text). Reject same-format differences and conflicting
cross-format notice values; preserve the original AIXM archive when replacing the
representation. Worker ownership, cadence, expiry and read-only web mounts remain
unchanged. No provider credentials enter the web process.
