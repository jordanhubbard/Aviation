---
schema: "literate-ai/flavor-markdown@1"
namespace: "literate-ai"
name: "accel-nvidia-cuda"
version: "1.0.0"
display_name: "NVIDIA CUDA accelerator"
primary_axis: "accelerator"
target: "nvidia-cuda"
secondary_constraints: []
applicable_capabilities:
  - "sample.portable-app"
provides:
  - name: "accelerator.nvidia.cuda"
    version: "1.0.0"
    contract: null
requires: []
specification_roots:
  - "openspec/spec.md"
authoring_inputs:
  - kind: "agent-skill"
    uri: "../../skills/agent/select-nvidia-accelerated-stack/SKILL.md"
  - kind: "specification-to-source-skill"
    uri: "../../skills/specification-to-source/generate-nvidia-cuda-application/SKILL.md"
contributions:
  - contribution_id: "cuda-toolchain-constraint"
    kind: "toolchain"
    merge_operator: "exact-singleton"
    slot: "nvcc"
    content:
      kind: "toolchain-constraint"
      uri: "toolchain.json"
  - contribution_id: "cuda-standard-command-profile"
    kind: "builder"
    merge_operator: "exact-singleton"
    slot: "standard-accelerator-command"
    content:
      kind: "standard-command-profile"
      uri: "standard-command-profile.json"
conflicts:
  - "flavor://samples/accelerator-cpu"
co_requisites: []
order_before: []
order_after: []
---
# NVIDIA CUDA accelerator

Select this Flavor only for a Linux or Windows worker whose current observation proves
a healthy NVIDIA CUDA device. Exact toolkit and package versions are resolved and locked
from the selected device, driver, language ABI, and current official compatibility data.
