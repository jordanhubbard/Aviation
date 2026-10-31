---
name: "elixir-portable-application"
description: "Elixir portable JSON application. Use for Literate AI workflow tasks."
metadata:
  author: "Literate AI maintainers <literate-ai-maintainers@users.noreply.github.com>"
schema: "urn:literate-ai:schema:v1:specification-to-source-skill"
skill_id: "elixir-portable-application"
version: "1.0.2"
title: "Elixir portable JSON application"
stages:
  - "generate"
dependencies:
  - schema: "urn:literate-ai:schema:v1:skill-reference"
    skill_id: "portable-application-implementation"
    version: "1.8.4"
    identity:
      schema: "urn:literate-ai:schema:v1:content-identity"
      algorithm: "sha256"
      digest: "55dece8843519c6ced884d7cd9eb5d8bff04ebccef055c74c5bfcf176ccd06cd"
limitations:
  - "Do not invoke Mix, install Hex packages, use Mix.install, or fetch dependencies."
  - "Do not turn untrusted strings into atoms or evaluate request data as code."
  - "Do not emit ExUnit progress or compiler logs on the product JSON output stream."
trust: "repository-reviewed"
---
# Elixir portable JSON application

Implement the selected Elixir Flavor at `source/main.exs` with helper modules beneath
`source/`. Use Elixir 1.18+ and Erlang/OTP 27+ standard libraries. Decode the sole
`System.argv()` argument with `JSON.decode!`, require an arguments array, validate
its shapes and domain constraints, and call ordinary application functions with its
positional elements. Encode the complete specified result with `JSON.encode!` and
one newline. Preserve exact integers and represent fractional domain values as
specified decimal strings or scaled integers.

Resolve every `Code.require_file` helper and test path relative to `__DIR__`, so the
copied artifact works from any current directory after source custody is gone.
Dispatch `--litai-test` and `--litai-smoke` before JSON parsing. Put native behavior
cases in `source/tests/litai_test.exs`; assertions must call the real application
logic and fail nonzero. Report precisely the generated test result envelope required
by `portable-application-implementation`, without reading the manifest. When using
ExUnit, suppress its progress output and emit the envelope only after all cases pass.

Keep Mix/Hex/Phoenix and release assembly outside this dependency-free profile.
When Make or Bazel requires one export file, assemble a self-contained `.exs`
script containing its helper modules and native tests at `EXPORT_PATH` (Make) or
`run.exs` (Bazel). Run it with the selected Elixir tool; never ship a shell launcher
or leave helper paths pointing into the former generation workspace.
A selected build-system Flavor may supply a reviewed wrapper or faithful build;
it does not relax these dependency or source-custody requirements.

For Bazel actions, read the exact executable from `LITAI_LANGUAGE_TOOL`; Standard
supplies it through `--action_env` together with a PATH containing the bound BEAM
installation. Do not assume an ambient `elixir` is visible in Bazel's sandbox.
For Make, use the `LITAI_LANGUAGE_TOOL` make variable as one quoted executable.

On Windows, keep Make/Bazel assembly code in an `.exs` file and pass its paths to
the selected launcher. Framework runtime phases invoke the bound native Erlang
entry point to preserve multiline code and JSON without batch-shell evaluation.

For a library recipe, implement the exact locked import surface instead of a
product JSON entrypoint. Keep public `.ex` modules beneath `source/<package>/`
and inside the package's CamelCase namespace (`invoice_api` becomes `InvoiceApi`).
Implement every declared function or macro name, including `?`/`!` suffixes when
declared. Put helpers inside the same retained package closure. Keep
`source/main.exs --litai-test` as the generated-test launcher; it must load retained
modules relative to `__DIR__` and report the normal generated-test envelope.
Compile the package's `.ex` closure with `Kernel.ParallelCompiler.compile/2` in
that launcher so struct and macro dependencies work independently of file order.
Define each module once; do not `Code.require_file` another package `.ex` file
from within a file in that same compiled closure.
The framework compiles the retained package closure for native import observation
and runs a separately reviewed `.exs` acceptance harness; generated tests do not
replace independent acceptance. Resolve library dependencies from the exact
runtime-provided provider artifact roots in the recipe, never from ambient modules
or a fetched Hex substitute.
