# Native rewrite program

- **Status:** active
- **Owning queue item:** [ADOPT-002](active-work.md#adopt-002)
- **Completion / archival evidence:** pending while ADOPT-002 remains open

The retained implementation at `components/legacy-project-wrapper/implementation` remains source-authority
until each boundary earns transfer under ADR 0002.

The initial application, package, asset, and harness map is in the
[native boundary inventory](native-boundary-inventory.md). It is a partial source-evidence pass;
public contracts and file-by-file authority classification remain open.

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
