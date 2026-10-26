# JavaScript implementation Flavor

### Requirement: Portable JavaScript implementation

When `implementation.language-ecosystem=javascript` is selected, generate a Node.js
20+ application using only built-in modules and ECMAScript features supported across
Linux, macOS, and Windows, except when the `package-npm` Flavor is also selected
(see lockfile-pinned npm below). A single-language application SHALL use
`source/main.js` as its entrypoint, accept one UTF-8 JSON array containing the
declared application arguments in `process.argv[2]`, never read standard input, and
write only the JSON result to standard output.

A Component MAY select JavaScript for an explicitly named frontend role alongside a
second language Flavor. In that case its specification SHALL own the role-specific
source path and the placement of infrastructure arguments such as an exact backend
executable path; the application arguments SHALL remain one complete JSON array. The
frontend SHALL invoke a backend without a shell and validate its exit status and JSON
response before producing the application's final result. The frontend role changes
only source-path ownership and the backend-invocation contract; it does not by itself
admit npm packages.

#### Scenario: JavaScript application executes

- **WHEN** every generated script is syntax-checked by the selected exact Node.js toolchain
- **THEN** the checked application runs through that same toolchain and implements the selected acceptance contract

### Requirement: Deterministic output and optional npm packaging

The generated application SHALL use no implicit network service, locale-sensitive
ordering, dynamic code loading, or ambient `NODE_OPTIONS` behavior. Any result
collection whose ordering is observable SHALL be sorted by rules stated by the
Component specification before serialization.

When `package-npm` (`packaging=npm`) is not selected, a
JavaScript source root, in a frontend role or otherwise, SHALL NOT declare or depend
on any npm package.

When `package-npm` is selected together with this Flavor, generated JavaScript MAY declare
an enumerated npm dependency closure. That closure SHALL be lockfile-pinned
(`package-lock.json`) and installed only after the host `npm` toolchain is detected;
see the `package-npm` Flavor specification. Generation SHALL NOT invent lockfile bytes or
unpinned registry ranges.

#### Scenario: Equivalent hosts execute the same request

- **WHEN** Linux, macOS, or Windows executes the same checked scripts and input through a compatible pinned Node.js runtime
- **THEN** the application emits the same JSON value independent of host path separators and locale

#### Scenario: npm without the package Flavor is rejected

- **WHEN** generated JavaScript declares an npm package and `package-npm` is not selected
- **THEN** the composition is not admitted by this Flavor
