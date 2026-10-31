---
name: generate-nvidia-cuda-application
description: Generate and test a C++ CUDA or Python CUDA application from a Literate AI specification after an exact NVIDIA stack has been selected. Use when the selected accelerator Flavor is nvidia-cuda and generated source must prove real device execution, deterministic output, portable repository layout, and complete dependency evidence.
metadata:
  author: Literate AI maintainers <literate-ai-maintainers@users.noreply.github.com>
schema: urn:literate-ai:schema:v1:specification-to-source-skill
skill_id: generate-nvidia-cuda-application
version: 1.0.0
title: Generate an NVIDIA CUDA application
stages:
  - generate
dependencies: []
limitations:
  - Do not generate or claim a CUDA-qualified application without one current healthy NVIDIA worker observation and one exact compatible stack decision.
  - Do not accept CPU fallback, numerical equality alone, or the nvidia-smi CUDA banner as proof that the generated operation executed on a GPU.
  - Do not install packages or mutate system toolchains during source generation.
trust: repository-reviewed
---

# Generate an NVIDIA CUDA application

Consume the Component specification, selected language and OS Flavors, the CUDA Flavor,
and the locked stack decision produced by `select-nvidia-accelerated-stack`. Treat every
one of those inputs as authority. Never infer hardware or package compatibility from a
GPU marketing name.

1. Fail before writing source unless the supplied worker observation is current, reports
   `nvidia_status: ok`, contains a matching device, and the stack decision pins the
   compiler/runtime/package closure for that exact OS, architecture, driver, and compute
   capability.
2. Generate all application source, build metadata, and tests. Do not copy generated
   source into the specification repository. Put generated source under `BUILD_DIR` and
   objects, executables, package caches, and temporary environments under `OBJ_DIR`.
3. For C++, generate a small host entrypoint plus one or more `.cu` translation units.
   Compile CUDA code with the locked `nvcc` and the target SM selected from the worker
   observation. Check every CUDA API call and kernel launch, synchronize before reading
   results, and fail with a diagnostic on device or runtime errors. When the selected
   Standard Make profile supplies `LITAI_LANGUAGE_TOOL`, treat it as the exact `nvcc`
   path and generate `source/Makefile` so `all` compiles every C++ and CUDA translation
   unit with C++17, the locked `sm_<major><minor>` target, and writes only
   `EXPORT_PATH`. Do not resolve another compiler inside the Makefile.
4. For Python, use only the locked CUDA-capable package named by the stack decision.
   Verify that it reports CUDA available and that every test tensor or array resides on
   the selected CUDA device. Do not silently fall back to CPU. The generated Makefile
   shall package the complete Python application at `EXPORT_PATH` without installing or
   copying CuPy into the source tree; dependency preparation must expose the exact locked
   interpreter environment used for build, test, and run. Do not generate
   `requirements.txt`, `pyproject.toml`, or another package-manager authority unless the
   recipe also supplies its complete typed transitive parent-edge lock projection. The
   stack-selection record already supplies the exact prepared closure: include every
   selected distribution and edge as CycloneDX components and dependencies instead. In
   particular, importing `cupy` requires a component for the selected CUDA-specific
   distribution (for example `cupy-cuda13x`), not an invented package named `cupy`. When
   a distribution name and import name differ, copy every selected `top_level_imports`
   value into a repeated CycloneDX component property named
   `literate-ai:python-top-level-import`.
5. Preserve the Component's one-JSON-value invocation and result contract. Emit only the
   specified JSON result on stdout. Put diagnostics on stderr.
6. Generate unit tests for validation, empty and boundary inputs, deterministic results,
   and arithmetic correctness. Add an accelerator test that independently proves an
   NVIDIA device executed the operation; numerical equality alone is insufficient.
7. Keep build definitions declarative and offline after dependency preparation. Prefer
   Bazel unless the Component or another selected Flavor overrides it. Declare every
   source, generated test, toolkit library, runtime library, package, and data asset.
8. Record the exact driver, device UUID/model/memory/compute capability, toolkit,
   compiler, runtime, direct packages, transitive packages, and Component dependencies in
   the generated CycloneDX SBOM. Copy every Component, Flavor, and skill BOM reference
   byte-for-byte from the supplied managed graph; never retype or infer a digest. Every
   `dependencies[].ref`, `dependsOn` value, and composition dependency must equal one
   exact root or component `bom-ref`. Hardware observation is execution evidence, not
   portable Component identity.
9. Run generated tests, the independent acceptance cases, and a clean process invocation
   on the selected worker. Reject a CUDA-qualified result if device execution cannot be
   proven.
