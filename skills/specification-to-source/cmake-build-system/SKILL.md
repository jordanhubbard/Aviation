---
name: "cmake-build-system"
description: "CMake build-system design. Use for Literate AI workflow tasks."
metadata:
  author: "Literate AI maintainers <literate-ai-maintainers@users.noreply.github.com>"
schema: "urn:literate-ai:schema:v1:specification-to-source-skill"
skill_id: "cmake-build-system"
version: "1.0.0"
title: "CMake build-system design"
stages:
  - "generate"
dependencies: []
limitations:
  - "Generated CMakeLists.txt files must declare exactly one root add_executable target named litai_artifact."
  - "Do not write derived artifacts inside the admitted source tree; the build must be out-of-source and all derived output must live beneath the framework-supplied OBJECT_ROOT."
  - "Compose add_custom_command/add_custom_target commands with the selected OS Flavor and prefer ${CMAKE_COMMAND} -E portable file operations over shell utilities."
  - "There is no `${CMAKE_COMMAND} -E chmod` subcommand; it does not exist in any CMake release and fails the build. Never invent a `cmake -E` subcommand not in `cmake -E help`'s exact list. To change permissions, use CMake's `file(CHMOD ...)` command inside a `-P` script invoked via add_custom_command, or execute_process. Prefer avoiding the problem entirely: e.g. Python's zipapp module already marks its output executable, so a packaging step that already produces an executable artifact needs no separate chmod step at all."
  - "Do not treat this Flavor as authority over an explicit Component specification or selected Flavor requirement."
  - "Do not fetch dependencies or invoke package managers during source generation; local CMake configure, build, and test validation is required."
  - "Do not write a workspace-root CMakeLists.txt or any other file outside the admitted source/ tree as generated application output; the Standard lifecycle configures and builds source/CMakeLists.txt directly. This generation duty does not confine a self-modifying project's own CMake authority to _build."
  - "The generated CMakeLists.txt must honor framework-supplied OBJECT_ROOT, OUT, EXPORT_PATH, and LITAI_LANGUAGE_TOOL cache variables without rewriting or relativizing them."
  - "The litai_artifact target's build must produce one self-contained portable file at EXPORT_PATH; a directory or launcher that depends on the source tree is not a Standard artifact."
trust: "repository-reviewed"
---
# CMake build-system design

Treat CMake as a strong build-system preference, meaning a default recommendation in this prompt rather than a runtime mandate. Explicit Component specification text and selected Flavor requirements always take precedence. If they require or justify another build system, follow them and record an honest coherent build design; an ordered `-cmake` selector removes this Flavor and therefore removes this skill before generation.

Generate a portable, self-contained `CMakeLists.txt` with the following structure and conventions.

## Minimum version and project declaration

Every generated `CMakeLists.txt` MUST begin with `cmake_minimum_required` and `project()`:

```cmake
cmake_minimum_required(VERSION 3.20)
project(litai_component LANGUAGES CXX)   # adjust LANGUAGES for the selected language
```

## Framework-supplied cache variables

Declare the framework-supplied variables as cache entries with safe local defaults so a
human operator can configure the project without passing them explicitly:

```cmake
set(OBJECT_ROOT ${CMAKE_BINARY_DIR} CACHE PATH "Framework-owned intermediate object root")
set(OUT "${CMAKE_BINARY_DIR}/artifacts" CACHE PATH "Framework-owned artifact root")
set(EXPORT_PATH "${OUT}/litai_artifact" CACHE FILEPATH "Exact exported artifact path")
set(LITAI_LANGUAGE_TOOL "" CACHE STRING "Framework-observed language tool executable")
```

Treat these as opaque values selected by the framework: do not rewrite, relativize, or
rediscover `LITAI_LANGUAGE_TOOL` from `PATH` when it is set. Human invocations may rely
on the defaults above; lifecycle invocations remain bound to the observed language
toolchain and framework-owned output custody.

## One root executable target

Every generated `CMakeLists.txt` MUST declare exactly one root target named
`litai_artifact` that builds the complete generated application:

```cmake
add_executable(litai_artifact ${SOURCES})   # adjust for the selected language ecosystem
```

After building `litai_artifact`, a `POST_BUILD` custom command MUST copy the built
binary to the exact `EXPORT_PATH` so the target always leaves one self-contained
portable file there, independent of the generator's own output-directory layout:

```cmake
add_custom_command(
  TARGET litai_artifact POST_BUILD
  COMMAND ${CMAKE_COMMAND} -E copy
          $<TARGET_FILE:litai_artifact> "${EXPORT_PATH}"
)
```

The lifecycle may invoke `cmake --build <build-dir> --target litai_artifact` repeatedly
against a new `EXPORT_PATH` while intermediate state remains; the `POST_BUILD` copy runs
every time the target's build step runs, so a repeated invocation must leave a verified
regular file at the exact requested `EXPORT_PATH` or fail non-zero.

## Discoverable tests

Register the generated test suite with CTest so `ctest --test-dir <build-dir>` runs
every generated test case and exits non-zero on any failure:

```cmake
enable_testing()
add_test(NAME litai_tests COMMAND litai_artifact --litai-test)
```

Before completing generation, invoke the selected CMake tool to configure an
out-of-source build directory, build the `litai_artifact` target with disposable
overrides for `OBJECT_ROOT`, `OUT`, `EXPORT_PATH`, and `LITAI_LANGUAGE_TOOL`, and run
the registered CTest suite. Require the build to create the exact export and the test
suite to pass with a nonzero discovered-test count, and both framework modes
(`--litai-test`, `--litai-smoke`) to pass against that export. This local validation may
compile or assemble declared source, but it must not fetch dependencies, invoke a
package manager, publish artifacts, or write outside disposable output roots.

## Build output isolation

All derived artifacts MUST be written under `${OBJECT_ROOT}`, `${OUT}`, or the exact
`${EXPORT_PATH}`. The configure step MUST bind the build directory outside the source
tree (`cmake -S source -B build`); never write build output next to source files. This
constraint makes a fresh `${CMAKE_COMMAND} -E rm -rf` of the build directory a reliable
and complete reset without touching any source file.

## Dependencies use standard CMake idioms

Declare third-party and system dependencies with `find_package` and link them with
`target_link_libraries` using the modern imported-target form:

```cmake
find_package(fmt CONFIG REQUIRED)
target_link_libraries(litai_artifact PRIVATE fmt::fmt)
```

Do not hand-roll compiler or linker flags that a `find_package` result or
`target_link_libraries` usage would otherwise provide.

## Host portability

Compose any `add_custom_command`/`add_custom_target` recipe with the selected OS
Flavor. Prefer `${CMAKE_COMMAND} -E` portable file operations (`copy`, `make_directory`,
`rm`, ...) over a platform-specific shell utility so the same target semantics work on
Linux, macOS, and Windows.

## Integration with the selected language ecosystem

This skill covers the build-system layer only. It composes with the language skill
already selected by the project Flavor set. Defer to the language skill for compiler
flags, package manager invocation, test runner selection, and artifact format.
Reference the language skill's declared sources and commands in `CMakeLists.txt` rather
than duplicating them. Route the primary compiler or interpreter invocation through
`${LITAI_LANGUAGE_TOOL}` when the selected language ecosystem exposes one (for example
by setting `CMAKE_CXX_COMPILER` or invoking it directly from a custom command) rather
than letting CMake's own compiler detection silently diverge from the framework's
locked toolchain.

## Generated application CMakeLists.txt stays in source/

This skill generates the detailed `CMakeLists.txt` for a **product** Component. Write
that file under the admitted `source/` tree of the generation workspace. Do not emit a
repository-root `CMakeLists.txt` as generated application output; Standard coding-CLI
admission rejects files outside `source/` as `coding_cli.unexpected_output`.

`_build` (and the `OBJECT_ROOT`/`OUT` defaults beneath it) and `BUILD_DIR` are the
advisory cache prefixes for this generated application's disposable objects and
fungible source, never a cage for load-bearing project authority — see
`repository-layout` for the full rule.

A coding CLI writing a root `CMakeLists.txt` **as generated application output**
remains wrong. Writing or updating the **project's** own CMake authority is allowed and
is out of scope for this generation skill. The Standard lifecycle configures and builds
`source/CMakeLists.txt` directly, so a delegating root `CMakeLists.txt` is never
required for lifecycle correctness.

## No hardcoded host paths

Never embed absolute paths that are specific to the generation host. Use `${OUT}` for
output, rely on CMake's own compiler and package discovery for tools, and document any
non-standard tool requirement in the Component specification rather than hard-coding
its path.
