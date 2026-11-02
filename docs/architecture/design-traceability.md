# Design traceability

<!-- literate-ai:authority-reviewed sha256:56840a16e74026a5b69a7c366a74e6301ed258aa663bad507886f56379d61ddb -->

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
