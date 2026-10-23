---
name: "cpp17-portable-json-application"
description: "C++17 portable JSON application. Use for Literate AI workflow tasks."
metadata:
  author: "Literate AI maintainers <literate-ai-maintainers@users.noreply.github.com>"
schema: "urn:literate-ai:schema:v1:specification-to-source-skill"
skill_id: "cpp17-portable-json-application"
version: "1.4.11"
title: "C++17 portable JSON application"
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
  - "Do not depend on compiler extensions or operating-system-specific APIs."
  - "Headers under source/tests must be included by their source-root-relative path, such as tests/litai_test.hpp, unless every declared build target explicitly supplies the matching include directory. A same-directory include that passes an ad hoc compiler command but fails the generated Bazel target is not portable."
  - "Do not invent Bazel, Make, CMake, Meson, or other build-system metadata unless a selected build-system Flavor or the Component explicitly requires it. The Standard C++ adapter can compile the declared source tree directly; undeclared BUILD or MODULE files create dependency intent that the selected lifecycle cannot resolve or attest."
trust: "repository-reviewed"
---
# C++17 portable JSON application

Implement the selected C++ Flavor as straightforward, auditable, portable C++17 without third-party libraries. Put the native generated-test implementation at source/tests/litai_test.cpp, expose it through an ordinary header, compile it into the runnable artifact, and dispatch the Standard `--litai-test` and `--litai-smoke` modes before ordinary argument parsing without reading source/tests/manifest.json. Include that header as `tests/litai_test.hpp` from translation units compiled with `source` as their include root, or make every generated build target declare `source/tests` as an include directory; do not rely on an ad hoc compiler's same-directory header lookup when the Bazel target lacks the equivalent include path.
Read the complete JSON arguments array from argv[1], validate the shapes needed by the specification, perform the required computation, and write exactly one JSON result to standard output with deterministic key and value semantics. Trace the acceptance invocation and result before finishing. Keep every translation unit internally complete: declare or define every type and function before its first use, include every required standard header, and ensure the resulting source compiles as C++17. Use either one translation unit or ordinary headers plus separately compiled translation units. Never #include a .c, .cc, .cpp, or .cxx implementation file; put declarations and inline definitions in guarded headers and define every externally linked function exactly once.
Preserve object lifetimes: make a parser own its input by value, or first copy argv[1] into a named std::string whose lifetime spans the complete parse and pass that storage without retaining it. Portable generated parsers must not use std::string reference or std::string_view data members, and must never construct a non-owning parser directly from argv[1], because the implicit temporary string immediately dangles. For file reads, reject open failure and bad(); do not require eof() after std::istreambuf_iterator consumption because stream-buffer iteration need not set the stream eofbit. Report exceptional failures only on standard error.

Before completing generation, locate the first available C++ compiler from `c++`, `g++`, and `clang++` on `PATH`. Compile every generated `.cpp` translation unit together as C++17 with `source` on the include path, write the temporary executable outside the generated source tree, and run that executable with `--litai-test`. Repair missing files, declarations, definitions, headers, build metadata, test protocol, and behavior until compilation and the complete generated-test run both succeed. Remove the temporary executable afterward. Treat this as a generation-time self-check only; do not weaken, replace, or bypass any later authorized build, test, execution, or acceptance phase.

Keep every `tests/manifest.json` argument in the JSON value type required by the generation-safe invocation contract. In particular, encode a required object argument as an object, never as a string containing serialized JSON. The executable may receive the complete arguments array serialized through `argv[1]`, but that command-line transport does not change the callable signature recorded in the manifest or invoked by language-native tests.

Treat JSON strings as Unicode rather than raw platform bytes. If the generated application implements its own JSON reader, decode every standard JSON escape, including `\uXXXX`; combine valid UTF-16 surrogate pairs before encoding the scalar value as UTF-8; and reject malformed or unpaired surrogates. Emit valid UTF-8 JSON on every host. Exercise both a non-ASCII string and an escaped supplementary-plane scalar during the generation-time self-check so Windows code-page defaults or an ASCII-only parser cannot survive until independent acceptance.

Generate build-system files only when the selected recipe contains explicit Component or
build-system Flavor authority for that system. In the absence of such authority, emit
the C++ sources, headers, tests, manifest, and CycloneDX BOM only; rely on the Standard
C++ adapter described by the execution contract. In particular, do not emit a
`BUILD.bazel` or `MODULE.bazel` merely because general framework guidance mentions Bazel.
