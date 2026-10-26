# npm package provider

### Requirement: npm packaging requires JavaScript

When `packaging=npm` is selected, the Component SHALL also select
`implementation.language-ecosystem=javascript`. Selecting `package-npm` without
JavaScript, or alongside a conflicting language Flavor as the only language, SHALL
fail closed.

#### Scenario: npm without JavaScript is rejected

- **WHEN** a Component selects `package-npm` and does not select JavaScript on the
  language axis
- **THEN** Flavor resolution fails closed with an unsatisfied target constraint

### Requirement: Enumerated lockfile-pinned closure

When `package-npm` is selected, generated JavaScript MAY declare an enumerated npm
dependency closure in `package.json`. Every declared package SHALL be pinned by a
complete `package-lock.json` (lockfileVersion 2 or 3) beside that manifest. The
authorized lifecycle SHALL validate and replay that supplied lockfile in a disposable
projection. Non-root package names MAY be derived from canonical `node_modules` paths
when the npm format omits the redundant `name`. Exact locked optional runtime nodes
SHALL be present in the installed inventory. A required peer SHALL resolve to an exact
package in the admitted lock graph; a missing peer is allowed only when its
`peerDependenciesMeta` entry explicitly marks it optional. Generation SHALL NOT invent
lockfile bytes or unpinned registry ranges.

#### Scenario: Manifest without a lockfile is rejected

- **WHEN** generated source declares npm dependencies in `package.json` and no
  matching `package-lock.json` is present
- **THEN** dependency observation fails closed before install or build

### Requirement: Detect before install

The npm install phase SHALL detect `npm` and the selected Node.js toolchain on
PATH before any install and return a concrete host prerequisite when unavailable.
It SHALL not install npm, Node.js, or a global package without separate
authorization. When the toolchain is present, install SHALL use the pinned
lockfile (`npm ci` or equivalent lockfile replay) into `OBJ_DIR` / ignored
`node_modules`, never into admitted generated source.

#### Scenario: Host npm is absent

- **WHEN** `package-npm` is selected and `npm` cannot be resolved on PATH
- **THEN** the lifecycle stops before executing any npm install command

### Requirement: Bind artifact packaging to exact accepted authority

The artifact packager SHALL consume an exact PackagePlan that binds the Component lock,
target, artifact graph, authored specification closure, source and resolved CycloneDX
SBOMs, entrypoints, runtime requirements, and packager identity. It SHALL retain the
dependency-complete application closure only in object custody and the sealed artifact,
write outputs only beneath OBJ_DIR, and SHALL NOT publish them to a registry.

#### Scenario: Dependency-complete application artifact is constructed

- **WHEN** every planned input is present with its exact content identity
- **THEN** build the JavaScript application artifact with its exact installed runtime
  closure and retain the accepted products and CycloneDX documents as bound package
  data without claiming to construct or publish a registry package
