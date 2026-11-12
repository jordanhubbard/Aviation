# Design traceability

<!-- literate-ai:authority-reviewed sha256:dc808f67ec9c683d5264c5414bbe2d01cb6c8251f1dfb08364afd08f27f0f409 -->

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
