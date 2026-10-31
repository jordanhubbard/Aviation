---
name: "durable-split-service"
description: "Four-boundary durable dashboard delta for the back-end parent: a browser frontend, a read-only API, a single-writer collector, and an embedded SQL snapshot cache wired only through public capabilities. Use for Literate AI workflow tasks that generate a restart-safe service polling an expensive upstream source."
metadata:
  author: "Literate AI maintainers <literate-ai-maintainers@users.noreply.github.com>"
schema: "urn:literate-ai:schema:v1:specification-to-source-skill"
skill_id: "durable-split-service"
version: "1.0.0"
title: "Durable split web/API/collector/cache application generation"
stages:
  - "plan"
  - "generate"
dependencies:
  - schema: "urn:literate-ai:schema:v1:skill-reference"
    skill_id: "backend-application"
    version: "1.0.0"
    identity:
      schema: "urn:literate-ai:schema:v1:content-identity"
      algorithm: "sha256"
      digest: "df6b4739c27798af1f48aeb4633899e4c6ebe9279f81cfc7fbaded8e27267253"
limitations:
  - "Do not collapse the four boundaries into one process or one deployment unit; the frontend, the read-only API, the single-writer collector, and the snapshot cache are independent deployment units connected only by public capabilities, so restarting one never invokes another."
  - "Do not give the frontend or the read-only API an upstream credential or an upstream client; only the collector boundary's generated code may hold provider credentials or call an upstream source. The frontend holds no database handle at all."
  - "Do not let the read-only API or the frontend write to the cache or reach an upstream source on a request path; the API reads the cache's read capability only, and the collector is the cache's single writer."
  - "Do not publish a snapshot before every required write for its collection window validates; a failed or partial collection must leave readers on the prior complete snapshot, never a half-written one."
  - "Do not open the API's or the frontend's cache access as a writable connection; reader boundaries use read-only connections that fail closed on any write attempt."
  - "Do not bake provider commands, product schemas, credentials, or application vocabulary into this template; those stay in the deriving project's authority. This is a composition of public capabilities, not a new Component kind or a framework daemon."
  - "Do not reimplement the collector's cadence here; inherit the once-daily jittered single-writer lease from the scheduler-lease-worker skill and pin it alongside this skill."
  - "Do not copy the back-end parent's process shape, store ownership, or Flavor index; inherit them."
trust: "repository-reviewed"
---
# Durable split web/API/collector/cache application generation

This skill is a delta of `backend-application`. Pin the parent in the recipe.
Apply it when the specification asks for a dashboard-style service that polls an
expensive upstream source and must stay available and restart-safe: the audited
anti-pattern is a single service that recollects upstream data inside request
handlers and loses all state on restart, coupling the frontend to collection
latency and to upstream credentials. The back-end parent already forbids calling
an expensive upstream source from a request path and already names the worker as
the store's single writer; this delta adds what the parent does not — the four
*separate deployment-unit boundaries*, their credential isolation, and their
public-capability wiring. It is a **composition of public capabilities**
(ADR-0005 `PublicInterfaceContract`), not a new Component kind and not a
scheduler process the framework runs.

## The four boundaries

Generate the service as four independent deployment units (ADR-0026) connected
*only* by public capabilities, so no boundary sees another's private authority:

1. **Browser frontend.** Consumes only a same-origin, read-only API capability.
   It holds **no upstream credential** and **no database handle**. Its generation
   follows the `frontend-application` skill (and its React dashboard delta when a
   chart/table dashboard is asked for): it fetches an already-collected dataset
   from the API and never talks to the cache or the upstream source directly.
2. **Read-only API.** Consumes only the cache's read capability. It **never**
   calls an upstream provider and **never** writes. Every handler answers from the
   last durable snapshot over a read-only cache connection; a request that finds
   no data reports staleness rather than triggering a collection.
3. **Single-writer collector/worker.** The **only** boundary whose generated code
   may hold provider credentials and call an upstream source, and the **only**
   writer to the cache. Its cadence — a once-daily jittered run guarded by a
   database-backed single-writer lease inside the cache boundary — is the
   `scheduler-lease-worker` skill; inherit it rather than reinventing the loop,
   the jitter, or the lease.
4. **Embedded SQL snapshot cache.** Provides two public capabilities over an
   embedded SQL store (SQLite first): a **read capability** for the API and a
   **single-writer write capability** for the collector. Configure WAL, a busy
   timeout, explicit migrations, and read-only connections for readers.

The framework template carries no provider commands, product schemas,
credentials, or application vocabulary (ADR-0001 boundary); those stay in the
deriving project's authority, injected through the collector boundary alone.

## Credential and capability isolation

The isolation is the point of the split. Only the collector receives upstream
credentials, so a leaked or misconfigured frontend or API cannot reach the
upstream source. The frontend requires only the API's read capability; the API
requires only the cache's read capability; the collector requires the cache's
write capability plus the project's upstream fixture. Wire these as capability
contracts so a boundary never sees another's private transitive specification: the
frontend cannot discover the database, and the API cannot discover the upstream
client. A capability contract, not shared code, is what connects a reader to the
snapshot it reads.

## Independent deployment units

Because the four are distinct deployment units, restarting the frontend or the
API process **does not invoke the collector** and does not recollect: a
freshly-restarted API immediately serves the previously persisted snapshot. Only
the collector's own schedule (owned by the scheduler-lease-worker delta) drives
collection. Do not entangle their lifecycles: no reader boundary may start,
signal, or block on the collector.

## Coherent current-snapshot publication

The cache boundary publishes a **current snapshot** only after *all* required
writes for a collection window validate. This is a cache-capability
postcondition, not something generated request code reinvents:

- Readers (the API, therefore the frontend) always observe the last **complete**
  snapshot.
- A collection *in progress* is invisible to readers: while the collector writes
  the next window, readers continue to see the prior complete snapshot.
- A **failed or partial** collection leaves readers on the prior complete
  snapshot — never a half-written one. The current-snapshot pointer advances
  atomically, and only once, after the window's writes validate.

Model this with a durable `current snapshot` pointer that the collector advances
in a single atomic step at the end of a validated window; readers resolve the
pointer and read only the rows of the snapshot it names. A window whose writes do
not all validate never advances the pointer, so its partial rows are never
readable as "current".

## Shared progress and freshness metadata

Progress and freshness metadata live in the cache boundary in a shape a
read-only reader can query without coordinating with the collector: the current
snapshot's identity and completion time, the collector's next-run/lease state
(from the scheduler-lease-worker delta), and per-source outcome counts. The API
reads this metadata over its read-only connection and the frontend surfaces it, so
both can report how fresh the data is and whether a collection is in progress —
without any boundary holding another's private handle.

## Behavioral contract and acceptance

The behavior above is a contract. A generated composition honoring this skill
must satisfy that: a reader during an in-progress collection still sees the prior
complete snapshot; a failed or aborted partial write leaves readers on the prior
complete snapshot with no partial visibility; after a complete publish readers see
the new snapshot; a reader boundary's connection cannot write; and the read path
frontend→API→cache never reaches the upstream source. A reference implementation
of the coherent-snapshot cache boundary and its deterministic acceptance tests
live alongside the framework's own test support
(`tests/support/snapshot_cache_reference.py` and
`tests/smoke/test_snapshot_cache_reference.py`) to prove the durability and
read-isolation contract is real and implementable with only the standard library
and the embedded SQL cache boundary. The frontend of this pattern is exactly what
the browser-acceptance skill validates; the collector's cadence is exactly the
scheduler-lease-worker delta. The live four-Component portfolio sample that
composes all boundaries end to end (with real upstream generation) is a separate,
deferred deliverable; this skill and its offline reference prove the durability
and isolation contracts that sample will compose.
