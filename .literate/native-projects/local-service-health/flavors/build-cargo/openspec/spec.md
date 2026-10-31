# Cargo build-system Flavor

### Requirement: Cargo uses locked registry dependency authority

When `build.system=cargo` is selected, generated Rust source MUST contain
`source/Cargo.toml` and MUST NOT contain `source/Cargo.lock`. The authorized lifecycle
SHALL derive the lock from the admitted manifest in a disposable build projection. The
derived lock MUST contain checksummed registry packages only; path, Git, workspace,
build, target-specific, and development dependency authority is outside this initial
profile.

#### Scenario: Standard builds a locked package

- **WHEN** a Rust Component selects the Cargo build-system Flavor
- **THEN** the lifecycle copies admitted source to an external build projection and runs `cargo generate-lockfile`
- **AND** freezes the derived lock, runs `cargo metadata --locked --format-version=1`, and retains their exact evidence
- **AND** runs `cargo build --locked` for the profile's named binary
- **AND** both commands use `CARGO_TARGET_DIR` beneath the framework object root
- **AND** neither command changes the admitted source tree, which contains no `Cargo.lock`

### Requirement: The exported binary retains Standard runtime checks

The Cargo binary MUST implement the selected Rust Flavor's `--litai-test` and
`--litai-smoke` modes. This profile does not require `cargo test`; broad native Cargo test
execution remains outside the initial contract.

#### Scenario: Generated tests run from the exported artifact

- **WHEN** the locked Cargo build succeeds
- **THEN** the Standard test phase invokes the exported binary with `--litai-test`
- **AND** any nonzero result rejects the generated candidate
