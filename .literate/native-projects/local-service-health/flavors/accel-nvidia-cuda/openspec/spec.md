# NVIDIA CUDA accelerator Flavor

### Requirement: Select only an observed healthy NVIDIA device

The CUDA variant SHALL be ineligible unless the selected worker is Linux or Windows and
its current typed observation reports `nvidia_status: ok`, sufficient per-device memory,
and every required compute capability. macOS, absent devices, stale observations, and
degraded driver queries SHALL be rejected before source generation.

#### Scenario: Driver query is degraded

- **WHEN** `nvidia-smi` exists but cannot query the driver
- **THEN** selection returns a typed ineligible result without invoking a coding CLI

### Requirement: Lock one compatible stack

The lifecycle SHALL resolve exact driver/toolkit/runtime/compiler/package/Python ABI and
GPU architecture compatibility from current official evidence and bind it into the
Component lock and CycloneDX evidence. Explicit specification or Flavor pins SHALL take
precedence and contradictions SHALL fail rather than silently select another stack.

#### Scenario: Compatible stack is resolved

- **WHEN** the observed driver and every target GPU architecture support one selected stack
- **THEN** its exact artifacts, hashes, sources, SM targets, and rationale are locked

### Requirement: Prove real GPU execution

Generated tests SHALL execute a deterministic device computation, compare it with an
independent CPU oracle, and prove that the selected NVIDIA device ran the kernel.

#### Scenario: Library falls back to CPU

- **WHEN** numerical output is correct but no selected CUDA device executed the work
- **THEN** acceptance fails for the CUDA-qualified variant
