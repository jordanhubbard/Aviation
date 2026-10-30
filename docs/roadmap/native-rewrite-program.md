# Native rewrite program

- **Status:** active
- **Owning queue item:** [ADOPT-002](active-work.md#adopt-002)
- **Completion / archival evidence:** pending while ADOPT-002 remains open

The retained implementation at `components/legacy-project-wrapper/implementation` remains source-authority
until each boundary earns transfer under ADR 0002.

The initial application, package, asset, and harness map is in the
[native boundary inventory](native-boundary-inventory.md). It is a partial source-evidence pass;
public contracts and file-by-file authority classification remain open.

## Target architecture

`aviation-sdk` is the distribution and compatibility surface, not one monolithic
Component. Domain Components own airports, navigation, weather, procedures/navigation
data, flight dynamics, avionics protocols/rendering, reusable UI, configuration, and
integration infrastructure. Each Component owns one public capability and an independent
acceptance contract. TypeScript, Python, Go, and future bindings are realizations of the
same capability and must pass shared behavioral vectors where their surfaces overlap.

Applications may own presentation, persistence, orchestration, and genuinely unique
workflows. They must not privately reimplement a common aviation capability. Temporary
compatibility wrappers are allowed only while they delegate to a promoted Component and
carry an explicit removal checkpoint.

## Ordered work

1. [ ] Produce a boundary inventory: deployables, public interfaces, data schemas,
   runtime state, build targets, tests, packages, CI/release jobs, assets, and target
   variance. Every row names source/test/document evidence and an owner.
2. [ ] Classify each row as Component intent, Flavor requirement, conversion skill,
   immutable asset, repository-only harness, or intentionally retained source.
3. [ ] Select the smallest independently buildable/testable boundary and author its
   native authority; leave later boundaries retained.
4. [ ] Generate, build, test, execute, and package the candidate through the ordinary
   lifecycle; compare observable results with the Phase 1.2 parity record.
5. [ ] Independently accept and regeneratively qualify the candidate before authority
   transfer.
6. [ ] Remove only the replaced retained files (`git rm`/`rm`), rerun the full E2E
   workflow, record evidence, then repeat from step 3.
7. [ ] Prove no unclassified retained file remains; archive this program only after
   full parity and current project verification.

## Promotion sequence

1. [x] `aviation.navigation`: pure geodesy, bearings, coordinates, wind, fuel,
   time/speed/distance, and performance-altitude contracts; shared TypeScript/Python
   vectors; required SDK CI.
2. [ ] `aviation.airports`: airport identity, normalization, lookup/search, and cache
   behavior are promoted; bundled-data provenance and the shared asset contract remain
   open before this boundary is complete.
3. [ ] `aviation.weather`: provider-neutral observations/forecasts, METAR parsing,
   flight categories, and provider adapters.
4. [ ] `aviation.nav-data`: navaids, procedures, approaches, airspace, ingestion, and
   provenance/freshness contracts.
5. [ ] `aviation.flight-dynamics`: atmosphere, aircraft performance, wind, autopilot,
   and validated aircraft models.
6. [ ] `aviation.avionics`: G1000 protocols, telemetry schemas, rendering primitives,
   and avionics device models.
7. [ ] `aviation.ui`, `aviation.config`, and integration infrastructure: reusable UI,
   configuration, secrets, explanation, E2E isolation, and external-service adapters.
8. [ ] Migrate all eleven applications, delete superseded local implementations, and
   prove dependency and behavior parity before retiring the legacy wrapper.
