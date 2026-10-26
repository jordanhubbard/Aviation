---
name: "scheduler-lease-worker"
description: "Daily jittered single-writer collector cadence delta for the back-end parent: persisted schedule state and a database-backed lease in the cache boundary. Use for Literate AI workflow tasks that generate a scheduled collector worker."
metadata:
  author: "Literate AI maintainers <literate-ai-maintainers@users.noreply.github.com>"
schema: "urn:literate-ai:schema:v1:specification-to-source-skill"
skill_id: "scheduler-lease-worker"
version: "1.0.0"
title: "Scheduler-lease worker generation"
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
  - "Do not turn this into a framework-run scheduler daemon; this is reference authority for the application's own worker, and the generated worker owns its own loop and lifecycle."
  - "Do not read the current time or randomness directly from the standard library inside scheduling logic; take an injected clock and an injected random source so every temporal and jitter decision is deterministic under test."
  - "Do not place the lease or schedule state in a store separate from the cache boundary; the single-writer lease and the single-writer cache write are one concurrency invariant sharing one durable store and one migration lineage."
  - "Do not let bounded retry within a window spawn a second daily schedule row; retry/backoff state is tracked separately from the next daily schedule."
  - "Do not log secrets, credentials, or upstream payloads in progress or failure output; emit only window, source identity, counts, and timing."
  - "Do not copy the back-end parent's process shape, store ownership, or Flavor index; inherit them."
trust: "repository-reviewed"
---
# Scheduler-lease worker generation

This skill is a delta of `backend-application`. Pin the parent in the recipe.
Apply it when the specification asks for a collector/worker that runs on a
once-daily cadence and must not double-collect across restarts or across
concurrent workers. The back-end parent owns process shape, store ownership, and
the Flavor index; this delta owns only the cadence, the durable schedule state,
and the single-writer lease. It is **reference authority for the application's own
worker**, not a scheduler process the framework runs: the generated worker owns
its own loop, its own lifecycle, and its own graceful shutdown.

## Nominal time and symmetric jitter

The worker runs once per UTC day at a configurable nominal wall-clock time.
Around that nominal instant apply a configurable, symmetric, bounded jitter
window: the selected instant lands within `[nominal - jitter, nominal + jitter]`,
so a fleet of workers does not stampede the upstream source at the same second.
Compute the jitter offset from an **injected random source**, never from an
ambient global generator, so a seeded source makes the selected instant
reproducible. A zero jitter bound is valid and means "run exactly at nominal".

## Injected clock and random source

Every reading of "now" and every jitter draw flows through injected
dependencies: a clock callable returning the current timezone-aware UTC instant,
and a random source used solely to pick the jitter offset. This is the linchpin
of the whole contract — with these two seams the scheduler's temporal decisions
(is it time to run, has the target passed, has the lease expired, is backoff
elapsed) and its jitter selection are fully deterministic under test, and the
same code runs unchanged in production with a real clock and a real random
source. Do not scatter direct standard-library time or randomness calls through
the scheduling logic.

## Persisted schedule state in the cache boundary

Persist the schedule state inside the *same* embedded SQL cache boundary the
split-service pattern uses, not in a separate store. The persisted state records,
per UTC day window: the schedule window and its bounds, the single selected
jittered instant, whether the window has completed, the last completed window,
and the retry state. Select the jittered instant exactly once per window and
persist it; never recompute it on a later read. Storing it durably is what makes
restart-before-target safe — a worker that restarts before its target reads the
already-chosen instant rather than drawing a new one.

## Database-backed single-writer lease

Guard each window with a database-backed lease recording the owner, the
acquisition time, and an expiry. Only the worker holding a live lease for a
window may execute that window, so concurrent workers racing for the same window
yield exactly one winner. Acquire the lease with a guarded, atomic write against
the cache store (an immediate transaction over the SQLite boundary) so the race
resolves in the database, not in application memory. Placing this lease in the
cache boundary rather than a fifth store is deliberate: the single-writer lease
and the single-writer cache write are the same concurrency invariant and share
one durable store and one migration lineage.

## Restart semantics

The scheduler is restart-safe by reading durable state, holding nothing critical
only in process memory:

- **Before the target:** preserve the selected instant; a fresh process reads the
  persisted jittered instant and waits for it rather than choosing a new one.
- **After a completed target:** do not rerun; a completed window stays completed
  and a restarted worker moves on to the next day's window.
- **After an expired running lease:** recover safely; a lease whose expiry has
  passed is reclaimable, so a worker that crashed mid-run does not wedge the
  window forever — another worker (or the same one after restart) may re-acquire
  and continue.

## Bounded retry, separate from the daily schedule

Within a window, failure triggers bounded retry with backoff, tracked separately
from the next daily schedule. Bump a retry counter and a next-attempt time on the
existing window row; do not create a second schedule row for the same day. When
the retry budget is exhausted, stop attempting that window rather than looping
forever. A subsequent success completes the same single window. The next daily
window is chosen independently and is never advanced or duplicated by in-window
retry.

## Long runs crossing the next boundary

A run that legitimately takes long enough to cross the next nominal boundary must
keep its lease alive (renew the expiry while working) and must complete the
window it started, not the new day's window. The next day's window is a distinct
row with its own selected instant and its own single run; the long run neither
completes it early nor reruns the window it already owns.

## Append-only run and outcome records, secret-free output

Record each run append-only: a run record (window, owner, start, finish,
outcome) and per-source outcome records (which source, success or failure, and a
non-secret detail). A failure on one source is isolated and recorded; it does not
abort the remaining sources for that window. Progress and failure output names
only the window, the source identity, counts, and timing — never a secret, a
credential, or an upstream payload. The worker cancels gracefully on a
termination signal: it stops cleanly and leaves the durable state consistent so a
later process can resume the window's lease or move on.

## Cross-process readable next-run status

Expose next-run and progress status — the selected instant for the current
window, whether it has completed, the current lease owner and expiry, and the
retry count — so the separate read-only API process can read it directly from the
cache boundary over a read-only connection. The API never writes and never calls
the upstream source; it only reads the last durable state. Leave this state in the
cache boundary in a shape a read-only reader can query without coordinating with
the worker.

## Behavioral contract and acceptance

The behavior above is a contract, not a suggestion. A generated worker honoring
this skill must satisfy deterministic acceptance covering: negative and positive
jitter bounds around nominal; UTC date rollover and clock movement; restart before
target, during a leased run, after success, and after failure; concurrent
instances with exactly one winner; expired-lease recovery; a long run crossing the
next nominal boundary; retry that does not create a second daily run; and next-run
status readable by a separate read-only connection. A reference implementation and
its deterministic acceptance tests live alongside the framework's own test support
(`tests/support/scheduler_lease_reference.py` and
`tests/smoke/test_scheduler_lease_reference.py`) to prove the contract is real and
implementable with only an injected clock, an injected random source, and the
embedded SQL cache boundary.
