# Swift implementation Flavor

### Requirement: Portable Swift implementation

When `implementation.language-ecosystem=swift` is selected, generate a Swift
standard-library application rooted at `source/main.swift`. It SHALL expose the
portable JSON application behavior without Foundation, platform-specific APIs, or
third-party packages unless another selected Flavor explicitly requires them.

Every Swift source file in the generated tree SHALL compile together into one
executable using the native builder's compiler invocation. `source/main.swift`
SHALL own the only top-level executable statements; supporting and generated test
files SHALL contain declarations without a second program entrypoint. Generation
SHALL compile this complete source set and execute its generated tests before
returning it.

#### Scenario: Swift application executes

- **WHEN** the generated source is compiled with the selected Swift host realization
- **THEN** the native entrypoint accepts the declared JSON argument and emits the
  specified JSON result on every supported selected operating system
