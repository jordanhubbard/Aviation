# Design traceability

<!-- literate-ai:authority-reviewed sha256:c68ffb66644c17a3082e008ded4848ad5f9692d19e1b28a5a6f696866d84d198 -->

[Project guide](../README.md) → design traceability

Behavior belongs in Component specifications; target variance belongs in Flavors;
conversion technique belongs in exact skills; execution order belongs in workflows;
model eligibility belongs in routing; validation and authorization remain framework
policy. The manifest selects the source-intelligence provider, while its local database
remains
derived evidence outside source authority. Changes should update the owning artifact,
its nearby explanation or diagram,
and an end-to-end test. Illustrations aid understanding; prose requirements and
acceptance scenarios remain normative. See the [project map](../user/project-layout.md).

Portable COM/NAV tuning, PTT state, auxiliary audio controls, and marker-input
priority belong to the `aviation.avionics` Component contract.
Its TypeScript and Python bindings evaluate the same authored vectors independently.
Flight Planner composes those models and supplies elapsed time and an optional
simulated-ATC callback. Accident Tracker's exact-first/fuzzy-fallback persistence
policy remains an application adapter: it chooses database candidates, preserves
canonical event identities and provenance, and rejects ambiguous or contradictory
matches. Its tests drive both SQLite and the actual ingest pipeline.
Provider record IDs distinguish events that share an archive URL. Placeholder
registrations never establish identity. The one-time SQLite constraint migration
preserves IDs and dependent records and rolls back on unexpected schema rather
than discarding application data.

Bounded run leases and their active/expired/unowned classification belong to the
`aviation.testing.e2e` Component. TypeScript and Python evaluate the same numeric,
identity and expiry vectors. SDK foreground-command deadlines, Docker ownership
labels and cleanup, and dedicated SSH forwarding remain runtime adapters. They
must survive controller loss and must not derive cleanup authority from a name
or a partial label alone. Docker recovery tests write real isolated service state,
kill their controller, and verify expiry and preservation of unrelated resources.

Bounded decision inputs, follow-up history, queued provider acceptance and callback
correlation belong to `aviation.ai.explanation`. Its authored vectors distinguish
RCC queue acceptance from a completed explanation. The retained common SDK owns
credentials, clocks, random capabilities, HTTP routing and request cleanup. App
adapters supply actual decision facts and retain their own access policy. Provider
model selection and fallback remain RCC-owned. SDK tests exercise real local HTTP
submission/callback behavior; they do not attest native generation or all-app
deployment acceptance.

General aviation domain APIs are owned by the retained planner application under
[the GA API contract](general-aviation-api.md). It composes
`aviation.aircraft`, `aviation.navigation`, and `aviation.weight-balance` rather than
copying operating figures or calculation formulas. FAA/NOAA/OurAirports requests,
source dates, bounded caches and GeoJSON responses remain application adapters.
`aviation.weather` owns optional METAR/SPECI prefix handling. Meta App exposes the
planner's operation schema through HTTP, an MCP resource and a discovery tool;
simulator placeholders are excluded from that schema. Domain qualification calls
real MCP operations and validates payloads and unknown/error behavior, rather than
using process health as evidence of usable aviation data.

The [application data review contract](aviation-app-data.md) defines the planning,
weather, preflight, school dispatch and mission consumers. Its shared browser presentation belongs
to Meta App and uses the public gateway; provider adapters remain in the planner.
Browser fixtures and cross-application lifecycle assertions are repository harness
code, not portable SDK contracts or evidence of live provider availability.

Browser deployment qualification owns its launched browser server. After trace,
context, and run-data cleanup, graceful browser shutdown has a five-second budget;
a timeout kills only that server's process tree and must await confirmed exit.
Failed process cleanup fails qualification. Signals retain a nonzero exit and
close the owned server. Phase timings distinguish trace, context, native process,
and driver boundaries. The enclosing 180-second isolated-run deadline and lease
ownership checks remain required. Browser workers select tested Node 22/24 LTS
runtimes before creating leases or fixtures and preserve interruption status
when delegating. These are retained runtime adapters, outside
the portable E2E Component. Ingress policy and cold-navigation acceptance are
documented in `components/legacy-project-wrapper/implementation/deploy/README.md`.

Flight Planner owns private browser-local aircraft planning preferences and their
cross-window write serialization; those inputs do not replace sourced aircraft
performance or POH authority. The shared Meta App feedback widget owns submission
completion, duplicate prevention and draft-preserving retry across applications.

Dependency automation follows the real retained workspace manifests and shared pnpm lockfile. The remaining service/model suites share Vitest while preserving hermetic provider isolation and signed loopback HTTP assertions; this removes the unsupported Jest/deepmerge development chain without changing production service behavior.

Flight Planner owns the private [Flight Service filing workflow](flight-service-filing.md),
provider transport, ICAO drafts, revision-bound confirmations and durable uncertain
outcomes. Meta discovers and forwards those typed operations with explicit client
authentication; its public aviation CORS list excludes private filing. Contract
fixtures establish deterministic behavior, while actual vendor lab and operational
approval remain separate admission requirements.

Flight Planner owns the private [aircraft-library source channels](aircraft-library.md).
Native PDF extraction, unchanged reviewed machine OCR and explicitly reviewed
page transcriptions remain distinct evidence with retained original images and
reviewer attribution. Source changes archive prior summaries; explicit recovery
admits only fully validated unchanged scopes. Operator transcriptions, including
identified agent reviews, do not confer independent human or performance-data
approval. Typed HTTP/MCP, private SDK transports and desktop/mobile review controls
share those source, privacy, history and failure semantics.

Flight Planner also owns reviewed source-use restrictions for layout-dependent
native extraction. Immutable image/reviewer receipts and document anchors survive
reindexing and metadata edits. Original/search text remains available, while
restricted native excerpts cannot support model claims. Literal reviewed text is
independent evidence; numeric presence alone never establishes a diagram
relationship. Coverage and typed HTTP/MCP/SDK/browser views expose unresolved
pages, and explicit unchanged-scope recovery stops before affected evidence.
