# Project layout

[`literate.project.json`](../../literate.project.json) names every authoritative root,
including `documentation_roots`; nearby directories are ambient until declared. Keep
the provider-neutral onboarding skill at root `SKILL.md` and make provider files thin
pointers to it.

The manifest declares source-intelligence policy as provider `none` with every
stage off. Literate AI does not ship or invoke a source-graph indexer.

Repository inheritance is separate from Git remotes. `.literate/repository-parent.json`
records the direct parent selection, `.literate/repository-lineage.json` locks the
complete exact ancestor DAG, and `.literate/imports.json` records inherited Component,
Flavor, and skill files. `litai update` re-resolves that chain; `litai reparent none`
explicitly makes the project a root.

Component specifications may place explanatory Mermaid diagrams beside their prose so
behavior and its illustration evolve together. Diagrams explain; prose requirements and
acceptance scenarios remain normative. See the
[traceability rule](../architecture/design-traceability.md) and
[framework flow](framework-flow.md).

A normal Component keeps portable metadata and its default behavior together in
`components/NAME/component.md`. Generated `component.lock.json` records exact target and
dependency resolution beside it but is not hand-maintained prose. Extra specification or
interface files are exceptional named boundaries, not boilerplate for every Component.
Harness vectors and private expected-value oracles live outside Component authority.

The initializer installs the content-pinned `flavors/build-bazel/` policy and its exact
`skills/specification-to-source/bazel-build-system/` input. The manifest selects it by
default only when a Component declares a compatible `build.system` slot. It is not
runtime enforcement or evidence that Bazel actually built an application.
