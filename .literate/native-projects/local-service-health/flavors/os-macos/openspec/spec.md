# macOS host Flavor

### Requirement: Portable macOS host execution

The generated application SHALL use the selected language's portable APIs for paths,
temporary storage, UTF-8 text, and process-independent computation on macOS. It SHALL
NOT require a platform shell, fixed filesystem root, or macOS-only dependency unless
the application specification explicitly requires one.

#### Scenario: Generated application runs on macOS

- **WHEN** the `platform.os=macos` Flavor and one implementation-language Flavor are selected and the application is compiled by that host toolchain
- **THEN** the compiled entrypoint completes its acceptance scenario without relying on case-sensitive paths or non-portable shell behavior

### Requirement: Remote-worker clock synchronization

When this Flavor is selected for a remote worker, host configuration SHALL attempt to
synchronize the host clock to the public NTP source `time.nist.gov`. The attempt is
best-effort: a missing client, missing noninteractive privilege, blocked UDP/123, or
nonzero client exit SHALL be recorded in host-bootstrap evidence and SHALL NOT fail
sample-worker capability readiness. Skewed clocks are a frequent cause of coding-agent
TLS and token failures.

#### Scenario: Host configuration attempts NTP synchronization

- **WHEN** the sample-worker host bootstrap runs on a macOS remote worker
- **THEN** it attempts an argv-bounded one-shot sync to `time.nist.gov` with `sntp`
  when present, otherwise queries that source and attempts `date -u`
- **AND** a failed or skipped attempt is present in the bootstrap report's `clock_sync`
  object without making `passed` false solely for that reason
