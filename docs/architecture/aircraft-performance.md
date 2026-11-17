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
Known numeric conditions require finite JSON numbers in their named units in fixed conditions, grid coordinates and calculation requests. Weight and manifold pressure in inHg must be positive; fuel, reserve, RPM, power and flap settings cannot be negative; flap percentage cannot exceed 100 and absolute temperature cannot be below absolute zero. Signed winds, slopes, altitudes and ISA deviations remain valid. Categorical configuration values remain text.
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

## Performance workspace

Flight Planner exposes an authenticated performance workspace with explicit ICAO
and optional registration filtering, paginated dataset selection and visible
draft/reviewed/stale/retired status. Selecting a dataset shows its exact variant,
revision, configuration, original hash, review identity and all table conditions.
Calculation inputs are explicit: display the source's fixed values as editable
conditions and leave grid-axis inputs blank until entered. Changing a filter,
credential, dataset, table or condition clears the previous result and aborts or
ignores in-flight work. A failed request cannot leave a successful result visible.

Each result shows its conditions, units, base value, applied correction steps,
weighted source rows and exact physical-page quotations, warnings and research
limitations. Original PDFs require an authenticated download; never put tokens in
URLs. Tokens, source text, datasets and calculations remain in memory and outside
general AI context, saved plans, public caches and offline exports. No automatic
requests or polling occur before the user connects.
Private source and result content remains excluded while its outgoing view is
still rendered during navigation to another workspace.

Operators may import a bounded transcribed dataset JSON file as a draft, inspect
its source/table/condition/correction evidence and explicitly attest review using
the current content hash. Import never implies review. Retirement requires a
reason. Calculation is enabled only for a reviewed usable dataset and requires
all axis and fixed-condition inputs; the backend remains the authority for source
integrity, exact applicability and correction coverage. Broader app handoffs and
an assisted manual transcription editor remain separate acceptance work.

## Explicit application reference handoff

Planner, Preflight and Analyzer may open the private workspace after an explicit
selection action. A handoff is bound to the exact opener window, allowed origin,
random session identity and unchanged application context. Credentials and raw citation
quotations never cross the channel. Preserve bounded source warnings, operator
notes and research limitations in the explicitly returned reference. The workspace remains responsible for
authentication, current-source checks and calculation; only an explicit return
action may share a bounded numeric reference with its source/review identities,
conditions and physical-page numbers. Unknown message fields are not retained.
Reject foreign senders, origins, old sessions and malformed or non-finite results.

Reference artifacts remain in memory and outside saved plans, public caches and general AI
context. An explicit apply action may place the selected number into the ordinary
planning workflow, including its normal persistence; disclose that before applying.
Never attach private reference/source metadata or credentials to those requests. Changing aircraft, loading or analysis context clears pending references.
Show source conditions alongside known application conditions; missing weather,
weight, variant or configuration is incomplete, never a match. Applying a cruise
reference to a planning input requires a separate explicit action and retains the
source conditions and provenance with that value. Measured Analyzer rows remain
separate; unknown or assumed conditions cannot establish matched performance.
A returned reference is a calculation-time snapshot, with no background refresh
or assertion that a later source/review state remains current.

Analyzer cold navigation to `#/performance` must open the performance workspace,
including its sourced-reference control, rather than falling back to Summary.
Retain the existing flight-detail and Summary hash meanings.
