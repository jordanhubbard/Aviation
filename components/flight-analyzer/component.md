---
namespace: aviation
version: 0.1.0
display_name: Flight track analyzer
profiles: ["application"]
sample: false
inheritable: false
provides:
  - name: application.flight-track-analysis
    version: 0.1.0
requires: []
authoring_inputs:
  - kind: specification-to-source-skill
    uri: skills/specification-to-source/backend-application/python-service-application/SKILL.md
  - kind: specification-to-source-skill
    uri: skills/specification-to-source/frontend-application/SKILL.md
workflow_definition: workflows/production/staging/dev/workflow.md
routing_policy: routing/production/staging/dev/routing.json
flavor_slots: []
entrypoints:
  - name: serve
    kind: http-service
    path: components/legacy-project-wrapper/implementation/apps/flight-track-analyzer/app/run.py
acceptance_contracts: []
source_dependencies: []
---
# Flight track analyzer

A web application with a Python back end and a browser front end. A pilot uploads
ForeFlight or Garmin KML tracklogs; the back end turns each log into a cleaned,
uniformly sampled flight track and derives aircraft performance, ground tracks,
take-off and landing distances, traffic-pattern shape, and how accurately the pilot
held airspeed and altitude. Nothing in the analysis depends on a GPU.

## Input

- KML files from ForeFlight and Garmin (Pilot, Connect). A file may hold several
  Placemarks; each Placemark with a time-stamped track is one flight.
- Accepted track encodings: `gx:Track` / `gx:MultiTrack` (`when` + `gx:coord`, with
  optional `gx:SimpleArrayData` such as speed or course), time-stamped `Point`
  Placemarks (speed, course, altitude may appear in ExtendedData or the description),
  and `LineString` Placemarks with a `TimeSpan` (timestamps are interpolated and the
  result carries a warning). Elements are matched by local name, not namespace prefix.
- Coordinates are WGS-84; KML altitude is metres. Recorded speed and vertical speed
  carry no reliable unit, so the unit is inferred by comparing against the speed
  derived from position and is reported, never assumed silently.
- Uploads are untrusted: XML entity expansion and external entities are rejected, size
  is bounded, and a malformed or track-less file yields a per-file error, not a failure
  of the other files in the same upload. Identical content is stored once.

## Aircraft association and storage

- Every upload must name the aircraft **tail number** (N-number: letters, digits or `-`, at most 10
  characters, stored upper-case) for each file, either one value per file or one value for all. The
  request is refused with a 422 naming the offending files **before anything is parsed or stored**.
  The upload UI asks for a tail per file and keeps Upload disabled until all are valid. A flight's tail
  can be changed later but never removed; uploading identical content again with another tail moves the
  flight to that aircraft.
- Data is stored in SQLite. The tail is the leading primary-key column of **every** table: `aircraft(tail)`,
  `flights(tail, flight_id)`, `flight_conditions(tail, flight_id)`, `events(tail, flight_id, kind, seq)`,
  `patterns(tail, flight_id, seq)`, `poh_reference(tail, type, pa_ft, oat_c)`, `poh_meta(tail)`. Child
  rows follow a flight when it is re-tagged and are removed when it is deleted. Raw KML is kept on disk
  by content hash. Summary and Performance can be filtered per aircraft.

## Track conditioning

Samples are sorted, de-duplicated, and screened for position and altitude spikes, then
resampled to 1 Hz and smoothed with a Savitzky–Golay filter whose derivatives give
ground speed, course, turn rate, vertical speed and along-track acceleration. Gaps over
15 s are flagged and excluded from statistics. Each flight reports sample count, native
interval, gap count, rejected-sample count, and warnings.

## Derived quantities

- **Phases** per sample: ground, take-off roll, climb, level, descent, landing roll.
- **Height above the airfield (AGL)** uses the median GPS altitude of the nearest
  stationary block (ground speed under 8 kt for 10 s or more) as its primary reference.
  When Aviation's bundled airport cache has a nearby airport with a valid elevation in
  feet MSL, report the airport identity, distance, field elevation, and difference from
  the observed GPS ground altitude. A calibrated GPS MSL offset from an observed ground
  block may extend the reference to another nearby airport that lacks a stationary
  block. Airport elevation alone never proves touchdown: the descending altitude,
  vertical-speed transition, and ground-speed or rollout evidence remain required.
  Missing, invalid, or distant airport records preserve track-only analysis.
- **Wind and airspeed.** A circle fit (SciPy least squares) of ground-velocity vectors
  yields wind and true airspeed. It is graded *high* confidence only from steady,
  straight, level legs on at least three distinct headings (cross-country flying), and
  *low* confidence otherwise (pattern work, where airspeed differs between legs and
  biases the fit). Zero-wind distance normalisation is produced only at high
  confidence. Estimated airspeed is `|ground velocity − wind|`; with no usable fit,
  speed statistics fall back to ground speed and say so. Deviations within a leg are
  insensitive to a constant wind bias.
- **Take-off and landing types** from the speed profile: take-offs are *standing* (roll
  begins from near rest on the runway), *rolling* (soft-field style: already moving at taxi
  speed when the roll begins; the roll start is the onset of sustained acceleration on the
  runway heading), *stop-and-go* or *touch-and-go*; landings are *full stop*, *stop-and-go*
  or *touch-and-go*. Rolling take-offs are summarised separately and get no zero-wind
  normalisation because their starts are not comparable to standing starts.
- **Take-off events**: ground roll and distance to 50 ft, lift-off ground speed and
  estimated airspeed, field elevation, headwind component, and a first-order
  zero-wind distance. Landing events: distance from 50 ft, ground roll, approach speed at 50 ft,
  touch-down ground speed and sink rate, headwind component and zero-wind estimate.
  Touch-and-go landings and go-arounds are recognized and excluded from full-stop
  statistics. Touch-down and lift-off timing is limited by GPS altitude (seconds), so
  ground roll carries a stated along-track uncertainty; distance from 50 ft to stop does
  not depend on touch-down timing and is the primary landing figure.
- **Performance** per flight: climb segments (rate, gradient, estimated best-rate
  speed from climb-rate-versus-airspeed binning), level segments (mean airspeed and
  altitude), descent segments (rate, glide ratio), maximum turn rate and the bank angle
  it implies, plus distance, airborne time and extremes.
- **Ground track**: the track in a local metric frame, shown without map tiles so the
  app works offline.
- **Traffic pattern** for every landing, in a runway frame (origin at touch-down,
  axis along the landing course): legs (upwind, crosswind, downwind, base, final),
  direction (left or right), downwind offset and its steadiness, pattern altitude AGL
  and its steadiness, base and final length, turn-to-final distance, glide-path angle,
  and final-approach centre-line error.
- **Accuracy**: altitude hold in level segments (σ, maximum deviation, share of time
  within ±100 ft), airspeed hold in climb, level, descent and final (σ, share within
  ±5 kt), pattern-altitude deviation from the target, approach-speed consistency across
  landings, centre-line and glide-path error, and touch-down point repeatability.
  The pattern-altitude target is user-supplied AGL or defaults to the median of
  observed downwind altitudes. Altitude is GPS geometric altitude, and the app says so.

## Aggregates

`Summary` pools every stored flight (or a chosen subset): average, median, σ, minimum,
maximum and count of take-off and landing distances, grouped by runway (airfield
cluster plus runway heading), together with pooled accuracy figures and per-flight
trends.

## User interface

- Upload by drag-and-drop or file picker, several files at once, with per-file results.
- Flights list; flight detail with stat cards, ground track coloured by altitude or
  phase with event markers, altitude / speed / vertical-speed / turn-rate profiles
  with phase shading, event tables, pattern view with each pattern overlaid in the
  runway frame, and accuracy tables.
- Summary view with the aggregates above.
- A Help control (?) opens a scrolling viewer that explains the algorithms, thresholds, accuracy
  limits, and exactly how uploaded data is read, stored and shared. Its AI section, and any
  mention of an LLM, appears only when an LLM is configured.
- Everything computed by numerical analysis is available with no LLM present.

## LLM-assisted analysis

The service may be configured with an LLM through environment variables (Anthropic key,
or any OpenAI-compatible endpoint). `GET /api/capabilities` reports whether one is
usable.

- **No LLM configured:** the API refuses LLM routes and the UI shows no LLM control,
  panel, tab or message that mentions one.
- **LLM configured:** the UI offers a flight debrief (narrative critique of the take-off,
  pattern, and landing quality with prioritized suggestions) and free-form questions
  about one or more flights.
- Only a compact numeric digest of the analysis goes to the model; raw coordinates and
  timestamps of the tracklog never do. The model is told to cite only digest numbers,
  and its output is shown as generated text, never as measurement.

## HTTP interface

`POST /api/flights` (multipart `files`), `GET /api/flights`, `GET /api/flights/{id}`,
`DELETE /api/flights/{id}`, `GET /api/summary`, `GET /api/capabilities`,
`POST /api/flights/{id}/debrief`, `POST /api/ask`, `GET /api/health`, and the static
front end at `/`. Analysis parameters such as the pattern-altitude target are query
parameters on the analysing or fetching route. Errors are JSON `{ "error": ... }`.

## Acceptance

Synthetic flights with known truth (a take-off, three circuits including a touch-and-go,
a full-stop landing, a steady wind, GPS noise) written as ForeFlight- and Garmin-style
KML must be recovered within stated tolerances: distances within 15 %,
pattern altitude within 100 ft, leg and direction identification exact. Distances are
50 ft distances and take-off ground roll; landing ground roll must agree within its own
stated uncertainty. Wind is recovered within 3 kt on a steady-leg cross-country flight and
graded low (no normalisation) for pattern-only flights. Hostile XML is
rejected. With no LLM configured the capabilities route reports it disabled and LLM
routes fail closed.
