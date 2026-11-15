# Aviation data in application workflows

GitHub issue [#453](https://github.com/jordanhubbard/Aviation/issues/453) owns integration
of the source APIs in [the source inventory](aviation-data-sources.md).

## Consumers and ownership

| Application | Entry point and context |
| --- | --- |
| Flight Planner | Route results carry the complete airport sequence and UTC departure validity time; local results carry the center airport. The Weather page carries the selected airport. |
| Weather Briefing | A data review below the existing briefing follows station selection and also accepts an ordered route. |
| Preflight Check | Environment review accepts route airports and a UTC validity time, alongside the existing PAVE review. Data loading never changes review checkboxes. |
| Flight School | Booking dashboard, creation/detail and dispatch check-in replace hard-coded weather cards with explicit airport/route review. No airport or booking-time timezone is inferred; dispatch approval remains user-controlled. |
| Missions | Each mission brief carries airport codes from its explicit route into a current-data review; users can correct or extend the route before requesting data. Mission objectives and ratings remain authored content. |

Meta App owns and serves `aviation-data.js`, an application presentation custom element
following the existing hosted feedback asset pattern. The clients load the shared asset
before use. It uses only the public v1 planning gateway, never credential files or
provider endpoints. Ship Meta App before these consumers. The asset is intentionally
unbundled and backward compatible with the documented `airports`/`valid-at` attributes.
A failed asset request remains visible to browser deployment checks.

The gateway admits credential-free browser CORS only from the five consumer HTTPS
origins and only on these public data GETs and the read-only route POST. It handles
Content-Type preflights locally, preserves error readability and rejects foreign origins,
extra requested headers and mutation methods. Cookie/Authorization forwarding and
Set-Cookie responses are excluded on this scoped browser path. Other gateway routes,
MCP origin checks and WebSocket rules retain their existing policy.

Historical track/logbook/accident screens have no current briefing context; inserting
current forecasts into them would misrepresent the time of their records. The live Flight Tracker screen has aircraft positions but no airport route/dispatch context; its tracking measurements remain separate. Simulated instrument screens retain their simulation inputs.

## Presentation requirements

Loading is explicit. Editing the route, UTC validity time, selected review point or
application context aborts pending requests and removes stale results. Reports stay
labeled by issuing station: requested airports and nearby reporting stations are distinct.
Route requests use the server's corridor discovery and batched TAF/METAR operation;
a single airport uses a zero-length two-point route. Limits remain bounded and visible.
No client substitutes a nearby airport forecast for a missing requested-airport report.

Preserve multiline TAF/METAR text, UTC issue/validity/retrieval times, provider identity,
original wind/temperature/pressure/geopotential-height units and unknown values.
Show partial failures, no reports, truncation and unlocated catalog stations explicitly.
Provider strings are rendered as text, including full-record details; they are never HTML.

Point weather controls select a resolved airport or reporting station. They expose
modeled pressure-level winds, NWS point alerts and surface forecasts, and nearby TAF
stations. NWS US coverage and model/TAF differences remain visible. NAS events and center
weather advisories are labeled all-US collections: no route intersection or inferred FAA
identifier conversion is claimed. Full FAA NOTAM/NMS is unavailable and linked separately.
Fetching any feed cannot establish operational suitability or complete a pilot review.

Reference lookup supports all six openAIP collections, explicit country/search filters,
25-record pages, next/previous controls, total count, full original records and attribution
with CC BY-NC 4.0 terms. Source configuration is a separate action and is never labeled
as a live availability check. Failures are isolated to their source and can be retried.

## Acceptance evidence

`apps/meta-app/aviation-data.test.mjs` runs real Chromium against deterministic browser
fixtures to cover contextual requests, UTC time, full multiline reports, model nulls,
all six reference collections and pagination, safe rendering, mobile overflow,
partial/missing/failed sources and stale-request cancellation. The normal Meta App test
command includes this suite; CI installs Chromium explicitly.

`deploy/remote-e2e.mjs` exercises the same view inside each affected application's
existing declared lifecycle screen, using browser-only synthetic fixtures tagged by the
run identity. It verifies selected route/station context and that preflight decisions do
not change. Provider credentials and production stores are untouched by these fixtures.
Production acceptance separately exercises the deployed shared asset and real gateway
requests, checks exact image revisions, and reruns the API/MCP provider audit.
