# Sourced aircraft performance

Behavioral authority for [#494](https://github.com/jordanhubbard/Aviation/issues/494),
part of [#488](https://github.com/jordanhubbard/Aviation/issues/488).

## Source and review

The private aircraft-document service hosts an operational-performance registry.
A dataset pins one retained original document ID/SHA-256, exact source metadata,
ICAO, variant, manual revision and aircraft configuration. Preserve physical page
numbers, original-text citations, table identification, conditions, units and
notes. Source association is an operator claim, not certification for a tail.
Source metadata edits, missing/corrupt originals or changed cited evidence must
invalidate use until a new matching dataset is prepared and reviewed.

Every transcription starts as a draft. A distinct authenticated review action
requires the content identity and explicit attestation that source values,
conditions, units and applicability were checked against the original. Records
retain reviewer and UTC review time. Dataset content is immutable; revisions create
new identities. A review is an operator claim, not manufacturer approval. No RAG
answer or distillation automatically creates a usable numerical dataset.

## Calculations

Support takeoff/landing ground roll and obstacle distances, climb rate and
cumulative time/fuel/distance, cruise TAS/fuel flow, and source-published
range/endurance with explicit fuel/reserve conditions. Values use named canonical
units. Source-supplied rectangular grids may span pressure altitude, temperature,
weight or power/RPM. Atmosphere specifies either absolute temperature or an explicit ISA deviation, never an inferred standard day. Every required fixed condition must match the request;
configuration, variant and type/tail applicability must match the pinned source.
Missing inputs remain missing. Do not silently substitute a nearby weight,
configuration, surface, wind or source revision.

Interpolation requires explicitly reviewed axes and original-page evidence; unselected axes accept exact source coordinates only, including weight. Interpolate only inside complete rectangular grids and return contributing source
points/citations and weights. No extrapolation, nearest-neighbor substitution or
implicit weight correction is allowed. Keep the existing caller-supplied PA/OAT
endpoint compatible, including its minimum grid and no-extrapolation errors; reuse
one interpolation kernel rather than maintain a second formula.

Wind, runway surface or slope corrections apply only through explicitly declared,
reviewed, page-cited rules within their coverage. Preserve the source percentage,
per-unit divisor, direction and table/metric applicability. Uncovered conditions
fail explicitly. Never invent a correction, combine unrelated tables or turn an
unknown source condition into zero. Preserve correction steps in each result. Percent rules identify their basis as
this metric's current result; a correction based on a different ground-roll/other
metric must never be approximated as a multiplier on total distance. Linked-basis
and additive corrections remain unavailable until an explicit source-backed rule
is implemented. Multiple corrections require cited combination authority and an
explicit reviewed order; otherwise reject the combination.

Use of a dataset requires a current review and original-source integrity. Results
identify dataset/content identity, source revision/configuration, all conditions,
method, corrections, units and original-page links. They remain planning research;
no result establishes dispatch, maintenance or aircraft applicability approval.

## Applications and acceptance

Expose typed authenticated HTTP/MCP operations for creating, listing, reading,
reviewing and calculating datasets, with the document library's private/no-store
and bounded authenticated parsing. Model-provider availability must not affect
calculations from reviewed original-manual tables.

Planner, Preflight Check and Flight Track Analyzer must let the user select a
matching sourced dataset and retain its conditions/provenance with applied values
or comparisons. Keep measured analyzer performance distinct from source predictions;
missing weather, weight or configuration cannot produce a supposedly matched
comparison. Do not silently replace user-entered aircraft settings.

Desktop/mobile UI shows draft/review/stale/unavailable states, exact source pages,
conditions and correction coverage. Private source/aircraft data and credentials
stay out of general AI explanations and public shell caches. Source review must be
a deliberate operation. Preserve unavailable/partial/error behavior through legacy
and current consumers. Verify independent examples against original PDF figures,
boundaries, malformed grids, unit/applicability mismatches, missing inputs, source
and metadata drift, persistence and HTTP/MCP parity. Deterministic synthetic cases
prove arithmetic/failure handling; actual original-manual examples are separately
required before full acceptance, followed by exact-head CI, review and deployment.
