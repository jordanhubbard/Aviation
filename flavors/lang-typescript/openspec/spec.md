# TypeScript implementation Flavor

### Requirement: Portable TypeScript implementation

When `implementation.language-ecosystem=typescript` is selected, generate a TypeScript
application for Node.js 20+ using only TypeScript and Node built-in modules. A
single-language application SHALL use `source/main.ts` as its entrypoint, accept one
UTF-8 JSON array containing the declared application arguments in `process.argv[2]`,
never read standard input, and write only the JSON result to standard output.

#### Scenario: TypeScript application typechecks and executes

- **WHEN** every generated TypeScript file is typechecked by `tsc --noEmit` using the
  selected Node.js toolchain
- **THEN** the application runs through that same toolchain and implements the selected
  acceptance contract

### Requirement: Deterministic dependency-free output

The generated application SHALL use no npm package, implicit network service,
locale-sensitive ordering, dynamic code loading, or ambient `NODE_OPTIONS` behavior.
Any result collection whose ordering is observable SHALL be sorted by rules stated by
the Component specification before serialization.

#### Scenario: Equivalent hosts execute the same request

- **WHEN** Linux, macOS, or Windows executes the same checked scripts and input through
  a compatible pinned Node.js runtime
- **THEN** the application emits the same JSON value independent of host path separators
  and locale
