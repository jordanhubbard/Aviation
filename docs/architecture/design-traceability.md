# Design traceability

<!-- literate-ai:authority-reviewed sha256:7f181a4f377ff6bdb75cc3b61e94d36e6b66aba6d0521bc03d73ae19d6241c30 -->

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
