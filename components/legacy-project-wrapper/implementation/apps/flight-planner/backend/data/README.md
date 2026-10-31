# Flight Planner data snapshots

These files are retained runtime data, not application source and not native
Literate AI Component authority. `provenance.json` binds each tracked artifact to its
current digest, record count, known source, license evidence, and unresolved history.

- `airports_cache.json` is the same public-domain OurAirports-derived snapshot bundled
  by the common SDK. Its download time and input digest were not retained, so its
  freshness is unknown.
- `airspaces_us.json` is a simplified historical openAIP API snapshot. Despite its
  filename, its 23,872 records are not restricted to the United States.
- `airspace_cache.json` contains those simplified records plus 360 features merged
  from a legacy input which is no longer retained. That portion's provenance is
  unresolved.

The openAIP Core API schema checked on 2026-10-31 declares
[CC BY-NC 4.0](https://creativecommons.org/licenses/by-nc/4.0/) and asks applications
to attribute [openAIP](https://www.openaip.net). That current declaration does not
prove the terms under which these historical files were acquired. The files therefore
remain intentionally retained, separately licensed third-party snapshots. Recorded
evidence does not authorize commercial use or Component promotion.

These community datasets are stale by an unknown amount and are not suitable for
primary navigation. A refresh must retain source hashes and acquisition times, record
all merged inputs, preserve attribution, and rerun the provenance tests.
