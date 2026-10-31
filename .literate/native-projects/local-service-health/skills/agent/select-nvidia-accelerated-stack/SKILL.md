---
name: select-nvidia-accelerated-stack
description: Resolve and lock a CUDA, PyTorch, CuPy, or CUDA Python toolchain for one observed Linux or Windows NVIDIA worker. Use when a Literate AI Component selects an NVIDIA accelerator Flavor, when matching driver/toolkit/package/SM compatibility, or when diagnosing why a CUDA variant is ineligible.
metadata:
  author: Literate AI maintainers <literate-ai-maintainers@users.noreply.github.com>
---

# Select an NVIDIA accelerated stack

Resolve one exact stack from current official evidence. Never infer a GPU architecture
from its marketing name or treat the `CUDA Version` banner in `nvidia-smi` as an
installed toolkit.

1. Run `litai config paths` and load the selected worker's current typed observation
   from its reported `worker_observations` path. Require Linux or Windows,
   `nvidia_status: ok`, at least one device, exact driver version, per-device memory,
   and compute capability. A missing or degraded observation makes the CUDA variant
   ineligible before generation.
2. Load the Component's locked OS, architecture, language/Python ABI, accelerator,
   package, and build Flavors. Explicit specification and Flavor pins outrank this
   skill; reject contradictions rather than substituting another backend.
3. Consult the current official CUDA release notes and compatibility guide. Confirm the
   selected toolkit supports every targeted compute capability and the observed driver
   supports the toolkit. Minor-version compatibility has feature and PTX restrictions;
   when relying on it, compile explicit `sm_<major><minor>` targets and record that
   choice. Do not install a forward-compatibility package implicitly.
4. Resolve framework packages only from their official compatibility selectors:
   PyTorch's install matrix for the exact OS/package/Python combination, and CuPy's
   CUDA-specific distributions for NumPy/SciPy-compatible GPU arrays. NumPy and SciPy
   themselves remain CPU implementations; name a CuPy backend honestly and constrain
   code to the tested compatibility surface.
5. Detect `nvcc` and required native compilers before use. An absent toolkit may be
   satisfied by a locked wheel/runtime only when the selected library officially ships
   it and no native compilation is required. Never derive toolkit presence from the
   driver alone or mutate global/system packages without authorization.
6. Retain the consulted primary-source matrices as a typed compatibility document with
   exact package hashes, then run `litai worker resolve-nvidia --compatibility FILE
   --worker-id ID --python-abi ABI` plus explicit pins. Python validates the observation,
   driver floors, compute capabilities, ABI, packages, hashes, and selects the oldest
   eligible exact candidate. Feed that content-identified record into the Component lock
   and CycloneDX source/resolved SBOMs; do not reproduce selection mechanics in prose.
7. Generate a preflight plus a minimal device computation. Require known output and an
   independent CPU oracle; verify the selected GPU device actually executed the kernel.
   A runtime fallback to CPU is a failure for a CUDA-qualified variant.

Prefer the oldest currently supported toolkit/package combination that satisfies the
locked Component behavior and every observed device; this limits artifact churn without
overriding an explicit user pin. Re-resolve mutable upstream matrices at major rebuild
or release time and retain their fetched content identity with the lock.

Use primary sources: NVIDIA's CUDA
[compatibility guide](https://docs.nvidia.com/deploy/cuda-compatibility/),
[toolkit release notes](https://docs.nvidia.com/cuda/cuda-toolkit-release-notes/), and
[architecture matrix](https://docs.nvidia.com/datacenter/tesla/drivers/cuda-toolkit-driver-and-architecture-matrix.html);
PyTorch's [local install selector](https://docs.pytorch.org/get-started/locally/);
CuPy's official installation guide; and NumPy/SciPy's Array API and interoperability
documentation. Do not use blogs or remembered tables as resolution authority.
