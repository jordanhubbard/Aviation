---
name: "make-build-system"
description: "GNU Make build-system design. Use for Literate AI workflow tasks."
metadata:
  author: "Literate AI maintainers <literate-ai-maintainers@users.noreply.github.com>"
schema: "urn:literate-ai:schema:v1:specification-to-source-skill"
skill_id: "make-build-system"
version: "1.6.2"
title: "GNU Make build-system design"
stages:
  - "generate"
dependencies: []
limitations:
  - "Generated Makefiles must declare phony targets explicitly with .PHONY."
  - "Do not write derived artifacts inside the admitted source tree; direct all build output to a declared OUT directory or a target-local subdirectory."
  - "Compose recipe commands with the selected OS Flavor; do not introduce an undeclared POSIX-shell or PowerShell dependency."
  - "Do not treat this Flavor as authority over an explicit Component specification or selected Flavor requirement."
  - "Do not fetch dependencies or invoke package managers during source generation; local Make build and test validation is required."
  - "Do not write a workspace-root Makefile or any other file outside the admitted source/ tree as generated application output; the Standard lifecycle invokes source/Makefile directly. This generation duty does not confine a self-modifying project's Makefile or other load-bearing project authority to _build."
  - "The detailed Makefile must honor framework-supplied OBJECT_ROOT, OUT, EXPORT_PATH, and LITAI_LANGUAGE_TOOL command-line variables without rewriting or relativizing them."
  - "Every recipe invocation of the framework-supplied language tool must double-quote the exact expansion as `\"$(LITAI_LANGUAGE_TOOL)\"` so absolute Windows paths containing spaces remain one executable token."
  - "The all target must produce one self-contained portable file at EXPORT_PATH; a directory or launcher that depends on the source tree is not a Standard artifact."
  - "Recipe commands must not create interpreter caches or bytecode inside the admitted source tree. For Python, invoke every import-bearing build and test helper with bytecode disabled (`-B`) or with `PYTHONDONTWRITEBYTECODE=1`; any explicit cache must be redirected beneath OBJECT_ROOT."
trust: "repository-reviewed"
---
# GNU Make build-system design

Treat Make as a strong build-system preference, meaning a default recommendation in this prompt rather than a runtime mandate. Explicit Component specification text and selected Flavor requirements always take precedence. If they require or justify another build system, follow them and record an honest coherent build design; an ordered `-make` selector removes this Flavor and therefore removes this skill before generation.

Generate a portable, self-contained Makefile with the following structure and targets.

## Top-level variables

Declare all configuration at the top of the Makefile as `?=` assignable variables so operators can override them from the command line without editing the file:

```makefile
OBJECT_ROOT         ?= _build/objects
OUT                 ?= _build/artifacts
TARGET              ?= run
EXPORT_PATH         ?= $(OUT)/$(TARGET)
LITAI_LANGUAGE_TOOL ?= python3    # select the matching language-tool default
SRCS                := $(wildcard source/*.py)   # adjust for the selected language
```

## Required phony targets

Every generated Makefile MUST contain a `.PHONY` declaration listing all phony targets, and MUST implement `all`, `test`, and `clean`:

```makefile
.PHONY: all test clean

all: $(EXPORT_PATH)

test: all
	# run the full generated test suite; exit non-zero on any failure

clean:
	# invoke a generated, selected-language cleanup helper for $(OUT)
```

`all` is listed first so it is the default target when `make` is invoked with no arguments. `clean` MUST remove only files under `$(OUT)` or other declared output directories; it MUST NOT delete or modify any source file.

Before completing generation, invoke the selected Make tool with the exact generated
Makefile and disposable overrides for `OBJECT_ROOT`, `OUT`, `EXPORT_PATH`, and
`LITAI_LANGUAGE_TOOL`. Require `all` to create the exact export, `test` to pass with a
nonzero discovered-test count, and both framework modes to pass against that export.
Never substitute a `build` target for the locked profile's `all` target. This local
validation may compile or assemble declared source, but it must not fetch dependencies,
invoke a package manager, publish artifacts, or write outside disposable output roots.

The lifecycle may invoke `all` repeatedly with a new absolute `EXPORT_PATH` while
intermediate state remains. `all` MUST therefore be genuinely phony and MUST always
run the rule or helper that verifies or recreates the exact requested export. Do not
make `all` merely depend on `$(EXPORT_PATH)` and assume Make's timestamp check is
sufficient: Windows drive-qualified command-line paths and retained intermediate state
make that formulation brittle. A repeated `make ... all` must either leave a verified
regular file at the exact `EXPORT_PATH` or fail nonzero; it must never report "Nothing
to be done" while the export is absent.

## Build output isolation

All derived artifacts MUST be written under `$(OBJECT_ROOT)`, `$(OUT)`, or the exact `$(EXPORT_PATH)`. Recipe lines that produce intermediate files MUST write beneath `$(OBJECT_ROOT)` and the final portable artifact MUST be produced at `$(EXPORT_PATH)`. Never write build output next to source files. This constraint makes `make clean` a reliable and complete reset.

Interpreter caches count as build output. A recipe that imports or discovers modules from the admitted source tree will, by default, let the interpreter drop a cache next to the source (for Python, `__pycache__/*.pyc`), which mutates the admitted tree and fails Standard admission. Suppress that cache in every recipe that runs the language tool over source. For Python, either invoke the tool as `$(LITAI_LANGUAGE_TOOL) -B ...` or set `PYTHONDONTWRITEBYTECODE=1` on the recipe line; when a cache is genuinely wanted, redirect it beneath `$(OBJECT_ROOT)` (for example with `PYTHONPYCACHEPREFIX=$(OBJECT_ROOT)/pycache`). Apply the equivalent cache-suppression for any other selected interpreter. The `all`, `test`, and `clean` targets must all leave the admitted `source/` tree byte-for-byte unchanged.

The Standard lifecycle invokes the root Makefile with exact command-line overrides for `OBJECT_ROOT`, `OUT`, `EXPORT_PATH`, and `LITAI_LANGUAGE_TOOL`. Treat those values as opaque paths selected by the framework. Do not append another target name to `EXPORT_PATH`, convert it to a relative path, or replace `LITAI_LANGUAGE_TOOL` by rediscovering a compiler or interpreter from `PATH`. Human invocations may rely on the defaults above; lifecycle invocations remain bound to the observed language toolchain and framework-owned output custody.

`all` MUST produce one self-contained portable file at `$(EXPORT_PATH)`: a Python zipapp, a self-contained JavaScript file, or the native C++/Rust executable selected by the language Flavor. That file must preserve ordinary JSON invocation plus the `--litai-test` and `--litai-smoke` modes without depending on the generated source tree after export. The Standard lifecycle enters the generated `source/` directory and invokes its detailed Makefile directly; a human-facing delegation Makefile must not be required for lifecycle correctness.

## Explicit prerequisite declarations

Make has no sandbox. Every file-level dependency between targets MUST appear as a Make prerequisite. When a rule produces `$(OUT)/foo.o` from `src/foo.c` and `src/foo.h`, both source files are prerequisites:

```makefile
$(OUT)/foo.o: src/foo.c src/foo.h | $(OUT)
	$(CC) $(CFLAGS) -c $< -o $@
```

Undeclared prerequisites cause spurious incremental-build failures.

## Host portability

Compose commands with the selected OS Flavor. Do not introduce an undeclared POSIX-shell dependency on Windows or a PowerShell dependency on Linux and macOS. Prefer direct compiler, package-manager, and generated executable invocations. For filesystem operations such as recursive cleanup, generate a small helper in the selected language so the same target semantics work on Linux, macOS, and Windows.

## Integration with the selected language ecosystem

This skill covers the build-system layer only. It composes with the language skill already selected by the project Flavor set. Defer to the language skill for compiler flags, package manager invocation, test runner selection, and artifact format. Reference the language skill's declared variables and commands in the Makefile rather than duplicating them. Route every compiler or interpreter invocation through the double-quoted `"$(LITAI_LANGUAGE_TOOL)"` expansion. The value is an opaque executable path, not a shell fragment; double quoting is mandatory even when the local default is a one-word command because framework-selected absolute Windows paths commonly contain spaces. If filesystem assembly is needed, generate a helper in the selected language and run it through that same quoted variable so the build does not acquire an undeclared shell-tool dependency.

## Generated application Makefile stays in source/

This skill generates the detailed Makefile for a **product** Component. Write that
Makefile under the admitted `source/` tree of the generation workspace. Do not emit a
repository-root Makefile as generated application output; Standard coding-CLI admission
rejects files outside `source/` as `coding_cli.unexpected_output`.

`_build` (and the `OBJECT_ROOT`/`OUT` defaults beneath it) and `BUILD_DIR` are the
advisory cache prefixes for this generated application's disposable objects and
fungible source, never a cage for load-bearing project authority — see
`repository-layout` for the full rule.

A coding CLI writing a root Makefile **as generated application output** remains wrong.
Writing or updating the **project's** Makefile as project authority is allowed and is
out of scope for this generation skill. The Standard lifecycle enters `source/` and
invokes its Makefile directly, so a delegating root Makefile is never required for
lifecycle correctness.

## No hardcoded host paths

Never embed absolute paths that are specific to the generation host. Use `$(OUT)` for output, rely on `PATH` for tool discovery, and document any non-standard tool requirement in the Component specification rather than hard-coding its path.
