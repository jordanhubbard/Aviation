# Elixir implementation Flavor

### Requirement: Importable Elixir library Components

When the selected Component is a library without product entrypoints, its retained
tree SHALL contain public modules beneath `source/<package>/`, where `<package>`
is a lowercase native application identifier. Its locked import surface SHALL
bind each capability and public interface identity to a module in the package's
CamelCase namespace and canonical exported function or macro names. Native names
ending in `?` or `!` SHALL be supported. Library generated tests SHALL execute
through `source/main.exs --litai-test` and remain separate from independent acceptance.

The framework SHALL observe imports by compiling only retained package `.ex`
sources and verifying each requested module's source origin and native exports.
An ambient module SHALL NOT replace an absent retained module. Independent
acceptance SHALL run an identity-bound `.exs` harness with the exact artifact,
locked import surface and cases, preserving the existing library oracle protocol
and immutable custody checks. These operations require the same execution
authorization as other library languages.

#### Scenario: Elixir library remains importable after generation source retirement

- **WHEN** the generation workspace is removed after a native library tree is built
- **THEN** its tests and exact native import observation execute from retained artifact custody

#### Scenario: A requested export is missing from the retained package

- **WHEN** a declared module or symbol is absent from the retained library
- **THEN** native import verification fails even if an ambient module has that name

### Requirement: Optional Mix toolchain custody

When the framework observes Mix for an optional ecosystem build, it SHALL bind
Mix to the already selected Elixir/OTP installation. It SHALL invoke the retained
Mix script through the selected native Elixir command, bind the complete shipped
Mix application payload and reject installation, version or byte drift. An
explicit Mix pin SHALL fail if it identifies a different installation. Discovery
SHALL NOT evaluate `mix.exs`, install Hex or acquire dependencies. This toolchain
observation alone SHALL NOT authorize a Mix build or establish dependency custody.
The portable application profile remains dependency-free.

#### Scenario: A Mix compiler task changes after selection

- **WHEN** a retained Mix compiler or dependency task changes after tool discovery
- **THEN** the toolchain guard rejects it before an authorized build can use it

#### Scenario: A project is present during Mix discovery

- **WHEN** the caller's working directory contains `mix.exs`
- **THEN** tool discovery observes only the selected installation and does not evaluate the project

### Requirement: Optional Hex plugin custody

Hex discovery SHALL require an explicitly staged complete plugin payload and the
already selected Mix/Elixir toolchain. It SHALL verify that the resolver, state,
SCM and packaging modules load on the selected OTP, originate in that payload,
and agree with the native application version. It SHALL bind every plugin module
and application file and reject additions, removals, substitutions and byte drift.
Discovery SHALL NOT search ambient archives, start Hex, evaluate a project or
download dependencies. Plugin observation SHALL NOT replace build authorization,
archive acquisition evidence or runtime dependency custody.

#### Scenario: Hex reports a version but its resolver cannot load

- **WHEN** Hex's version module loads but a critical resolver module is incompatible with the selected OTP
- **THEN** plugin discovery fails before an authorized dependency operation can use it

#### Scenario: An ambient Hex module replaces the selected plugin

- **WHEN** a critical module resolves outside the explicitly staged payload
- **THEN** discovery fails even if the reported version matches

### Requirement: Inert Mix dependency intent and acquisition evidence

Generated Mix dependency declarations SHALL use bounded declarative project
intent. Source admission SHALL reconcile declared and locked package names with
the source BOM and reject generated executable `mix.exs` manifests. Native project
code belongs only in the authorized external build projection.

The framework SHALL read native Mix locks as bounded literal data without
evaluating Elixir. It SHALL preserve direct and selected transitive dependency
edges, reject duplicate or incomplete graph entries and distinguish unselected
optional dependencies. Unsupported registries, source authorities and build
managers SHALL fail closed. Parsing a lock SHALL NOT establish acquisition or
runtime custody. Acquired public Hex package bytes SHALL match both the outer
archive checksum and the inner version/metadata/compressed-contents checksum,
with a complete bounded native archive envelope and no duplicate or linked files.
Standard admission SHALL require lifecycle-owned lock, acquisition and retained
runtime evidence before selecting this ecosystem workflow.

#### Scenario: A generated Hex declaration is absent from the source BOM

- **WHEN** declarative Mix intent names a package omitted from the admitted source BOM
- **THEN** source dependency reconciliation fails before package acquisition

#### Scenario: A valid lock is presented without acquired package custody

- **WHEN** source contains a syntactically valid native Mix lock without lifecycle-owned dependency evidence
- **THEN** Standard rejects dependency admission instead of treating checksums as acquired bytes

### Requirement: Authorized native Mix artifact production

A native Mix builder SHALL require an exact, acknowledged host-build request and
a live revocation verifier before fetching, compiling, packaging or observing
retained application code. It SHALL recheck authorization and selected tool bytes
at every native phase. It SHALL synthesize the project in an external projection,
keep admitted source and native project inputs unchanged, derive and freeze the
lock, and validate source-BOM inventory before dependency compilation.

Native observation SHALL prove version requirement satisfaction and acquired
package metadata coordinates and edges. Publication SHALL retain source, native
Hex package bytes, acquired archives, the complete compiled application/dependency
payload, process output and request/authorization-bound evidence. Native import
observation SHALL verify retained application versions and module origins; an
ambient module or duplicate module SHALL fail verification. Source and build
workspaces SHALL NOT be needed for product execution. Reuse SHALL check complete
retained bytes against independently held artifact and evidence identities.
These build records SHALL NOT replace Standard plan, SBOM, package or runtime
authorization and custody integration.

Mix library production SHALL bind its declared package and public import surface
to the acknowledged request without requiring an application entrypoint. It SHALL
reject compiled modules outside the package namespace and missing public exports.
A compiled provider closure SHALL retain exact application names, versions, native
metadata and byte identities for the library and its locked dependencies. Original
and copied provider payloads SHALL be checked around every native phase. Conflicting
applications, duplicate modules and ambient runtime shadows SHALL fail closed.
A library importing other compiled libraries SHALL bind both its own public import
surface and the complete selected provider inputs to the same acknowledged request.
Direct and transitive imports MAY share an application only when its name, version
and exact retained byte identity agree; conflicting payloads SHALL fail closed.

#### Scenario: A library consumes another compiled library

- **WHEN** an authorized library build selects a compiled provider and its own declared import surface
- **THEN** both selections remain bound to the acknowledged request and retained native closure

#### Scenario: Direct and transitive imports share a dependency

- **WHEN** the selected direct and transitive closures contain an application with identical name, version and byte identity
- **THEN** the consumer uses the retained closure after producer retirement and rejects changed retained bytes

#### Scenario: Authorization is revoked after dependency fetching

- **WHEN** the current build grant is revoked before compilation
- **THEN** the builder refuses the next native phase and publishes no artifact

#### Scenario: The native build changes its input projection

- **WHEN** a native phase changes admitted inputs, the synthesized project or the frozen lock
- **THEN** the builder refuses publication

#### Scenario: A retained compiled dependency changes before reuse

- **WHEN** compiled dependency bytes differ from the independently retained artifact identity
- **THEN** verification rejects the artifact even if its local manifest is present

### Requirement: Mix source-to-resolved dependency evidence

Source inventory identities SHALL preserve the original UTF-8 bytes, including
CRLF line endings, so admission and retained-artifact observation bind the same
source on every host.
Windows host dependency observation SHALL inspect the selected BEAM runtime DLL
as an exact regular PE payload without requiring it to be an executable command.
It SHALL reject relative DLL selection, command arguments, links and invalid PE
headers, while preserving ordinary executable command discovery.

The dependency resolver SHALL accept declarative Mix intent only with explicit
lifecycle-owned source authority bound to the complete admitted text inventory.
Source admission SHALL require declared root Hex coordinates and dependency edges
before acquisition authorization, and SHALL reject executable manifests, generated
locks and alternate package roots. Resolution SHALL require a fresh lifecycle
callback that revalidates acquired archive and retained compiled payload bytes
against independently held artifact and evidence identities on every reuse.
Serialized build metadata SHALL NOT replace that callback.

The resolved BOM SHALL preserve source intent and references, satisfy source VERS
ranges, retain acquired archive checksums and compiled runtime identities, and
cover the complete selected native graph, including selected optional edges.
Unknown, missing or duplicated packages, graph mismatches, conflicting source
hashes and absent module or payload claims SHALL fail resolution. Historical build
records SHALL NOT authorize current execution. A selectable Standard Mix target
SHALL independently enforce current plan, tool and execution authority.

#### Scenario: Serialized Mix metadata is supplied without a payload verifier

- **WHEN** a build record claims verified Mix acquisition but no lifecycle callback exists
- **THEN** resolution fails without publishing a resolved BOM

#### Scenario: Source inventory changes or retained payload bytes drift

- **WHEN** selected source or retained package bytes differ from independent bindings
- **THEN** admission or fresh resolution fails instead of accepting cached metadata

### Requirement: Standard native Mix authority

A Standard Mix target SHALL bind the selected Component, resolver, Hex/Mix build
installation and Elixir runtime to its locked command authority. Its source and
network-capable build request SHALL be indexed before authorization. Native phases
SHALL use the exact issued Standard grant and finalized plan through a live
revocation verifier; missing verifiers, forged grants, expired or revoked grants,
changed source and unfinalized plans SHALL fail before dispatch. The shared native
producer SHALL keep its canonical source-byte digest separate from Standard's
source bundle and tree identities, without manufacturing a substitute grant.

Native exports SHALL retain complete Mix evidence inside a tree export. Source and
resolved BOMs SHALL use the lifecycle-owned fresh artifact observer. Cache reuse
SHALL check the complete outer tree against an independently retained publication
checkpoint before deriving nested artifact pins. Runtime materialization SHALL
recheck sealed tree and acquired/compiled payload custody and current authorization,
then supply only the exact retained application/dependency code paths. Product
runtime checks SHALL NOT require the former generation workspace.
Sealed library-provider history SHALL resolve its exact issued producer plan,
including when a later producer rebuild has selected different source. That
historical context SHALL NOT authorize current compilation or execution.
Retained provider paths SHALL use a shallow Windows-portable layout while sealed
metadata retains complete provider identities and independently checked tree pins.

#### Scenario: A cached native Mix payload changes

- **WHEN** a dependency BEAM differs from the independent publication checkpoint
- **THEN** cache reuse and runtime materialization reject it

#### Scenario: The current Standard grant is revoked after building

- **WHEN** runtime materialization is attempted with the revoked issued grant
- **THEN** it refuses dispatch even though historical build evidence remains valid

### Requirement: Portable Elixir implementation

When `implementation.language-ecosystem=elixir` is selected without an explicit
native Mix build profile, the application SHALL
provide `source/main.exs` and run on Elixir 1.18 or later with Erlang/OTP 27 or later.
It SHALL use only the Elixir and Erlang standard libraries, including the built-in
`JSON` module. It SHALL accept one complete UTF-8 JSON arguments array from
`System.argv()` and emit one deterministic JSON result followed by a newline.
It SHALL keep helpers and native behavior tests beneath `source/`, load them by
paths relative to `__DIR__`, and require no Mix project, Hex packages or network fetch. When a selected
build-system profile requires a single-file export, it SHALL assemble helpers and
native tests into one self-contained `.exs` script, preserving the same modes.

#### Scenario: Elixir application executes from the artifact

- **WHEN** the selected Elixir runtime invokes the copied application tree after the generation workspace is unavailable
- **THEN** the application implements the Component acceptance contract without reading the former workspace

### Requirement: Elixir build and test modes

Without an explicit native Mix build profile, the language-native build SHALL
parse every `.ex` and `.exs` source file without
evaluating application code and publish the complete source tree only after parsing
succeeds. The application SHALL implement `--litai-test` and `--litai-smoke` before
product argument parsing, delegating native behavior tests to
`source/tests/litai_test.exs` without reading the generated test manifest.

#### Scenario: Invalid Elixir source refuses publication

- **WHEN** any generated Elixir source file contains a syntax error
- **THEN** the build fails and does not publish a runnable artifact

### Requirement: Build-system actions use the selected Elixir installation

Make and Bazel actions SHALL invoke the exact selected Elixir executable through
`LITAI_LANGUAGE_TOOL`. Standard SHALL bind native dependency observation to BEAM
and its launcher interpreter, retain launcher/core-module content identities, and
supply Bazel actions with the bound runtime's executable directory.

#### Scenario: Bazel has no ambient Elixir on its default PATH

- **WHEN** Bazel assembles the single-file Elixir artifact
- **THEN** it invokes the selected executable and bound BEAM installation through the supplied action environment

### Requirement: Windows runtime arguments remain inert

On Windows, framework discovery, parsing, testing and product execution SHALL
invoke the native Erlang entry point for the selected Elixir library installation.
They SHALL transport multiline code and JSON arguments without batch-shell parsing.
The original Elixir launcher and native runtime content SHALL remain identity-bound.

#### Scenario: JSON contains shell-sensitive text

- **WHEN** a Windows product request contains quotes, percent signs or exclamation marks
- **THEN** the application receives exactly those characters as JSON data

### Requirement: Packaged Mix custody

Standard packaging SHALL preserve each linked library export's acquired archives,
lock and runtime evidence, and capture its exact source and resolved BOM records.
Packaged Mix execution SHALL verify the copied native export against independently
retained producer identities and current consumer authorization, including after
original source and artifact retirement. It SHALL reject changed package bytes
or revoked current authorization without consulting retired producer workspaces.

#### Scenario: Original Mix workspaces are retired after packaging

- **WHEN** a verified linked package retains library archives and the consumer's compiled closure after original source and artifact removal
- **THEN** current consumer authorization permits execution using only the sealed package paths and captured source/resolved BOM records

#### Scenario: Packaged bytes or current authorization change

- **WHEN** a retained Mix package changes or its current consumer grant is revoked
- **THEN** execution fails before invoking native Elixir


### Requirement: Retained native Mix build admission is inert

Qualification capture SHALL decode native Mix build evidence from bounded canonical
export bytes without filesystem extraction, dependency acquisition or host execution.
It SHALL bind the exact issued historical plan, request and grant; independently
recorded export/file bytes; acquired Hex archive checksums and lock; complete native
phase streams; and selected provider application/runtime inventories. Current build
or execution authority SHALL remain separate from historical provenance. Mix request
toolchain identity SHALL match the complete typed Hex/Mix target, while the language
compiler/runtime retain their independently locked Elixir identities. A request bound
to that target SHALL NOT substitute generic process evidence for native Mix evidence.

#### Scenario: A captured native Mix build is reopened after workspace retirement

- **WHEN** intact native exports and exact build records are reopened after original source and artifact removal
- **THEN** the decoder verifies retained bytes and historical provenance without invoking host tools or granting execution authority

#### Scenario: Captured native authority or payload is substituted

- **WHEN** a retained plan, request, grant, archive, phase stream, provider closure or runtime inventory differs from its independent binding
- **THEN** qualification admission refuses the captured build

### Requirement: Projected Mix library verification authority

The Standard Mix adapter SHALL admit the library command contract projected from
locked Flavor authority. The library runtime identity SHALL bind the outer
verification driver used by its test and import phases. The embedded native
command SHALL bind the independently selected Elixir/OTP compiler installation.
An executable Mix application SHALL bind its runtime directly to that installation.
The adapter SHALL reject mismatched outer driver identities or embedded native
commands before generation or build; neither driver may substitute ambient code.

#### Scenario: A projected library uses the Python verification driver

- **WHEN** the locked Mix library contract binds the reviewed Python driver and embeds the selected Elixir command
- **THEN** Standard assembles the native library lifecycle with both bindings intact

#### Scenario: A library misidentifies its outer runtime driver

- **WHEN** the declared library runtime identity differs from its bound test or import tool
- **THEN** Standard rejects assembly before any native build or execution
