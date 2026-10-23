---
name: "python-portable-application"
description: "Python portable application. Use for Literate AI workflow tasks."
metadata:
  author: "Literate AI maintainers <literate-ai-maintainers@users.noreply.github.com>"
schema: "urn:literate-ai:schema:v1:specification-to-source-skill"
skill_id: "python-portable-application"
version: "1.4.12"
title: "Python portable application"
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
  - "Do not require standard input, a shell, or environment-specific package installation."
  - "Do not rely on repository-local modules unless the execution contract explicitly permits them."
  - "Do not let build, test, packaging, or cleanup invocations create `__pycache__` or `.pyc` files inside the admitted source tree; use `-B` or `PYTHONDONTWRITEBYTECODE=1`, or redirect `PYTHONPYCACHEPREFIX` beneath the declared object root."
trust: "repository-reviewed"
---
# Python portable application

Implement the selected Python Flavor with the standard library and any explicitly admitted native SDK imports supplied in the locked recipe. Expose a callable main at source/main.py, accept the specified positional arguments directly, return JSON-compatible values, and keep module imports portable across Linux, macOS, and Windows. Its executable wrapper must dispatch the Standard `--litai-test` and `--litai-smoke` modes, otherwise parse one complete UTF-8 JSON arguments array from argv[1], call main(*arguments), and emit only the returned JSON value plus a trailing newline on standard output. Put the native generated-test implementation at source/tests/litai_test.py and keep it independent of source/tests/manifest.json. If a build target invokes `unittest discover`, implement every discovered test as a `unittest.TestCase` method; do not emit pytest-style free test functions for that runner. Before completing generation, run the exact build system's ordinary test target and require it to discover and pass every manifest case—zero discovered tests is a failure even when the command exits successfully.

When the recipe contains admitted native SDK dependencies, import their declared
packages and use the locked public integration contracts. Do not replace a dependency
with a generated imitation, install another version, or guess paths to SDK caches. The
Standard lifecycle supplies the verified imports. Generate the real behavior tests and
check syntax during generation; defer SDK-dependent execution checks, including the
ordinary test target and `--litai-test`, to that authorized lifecycle. Do not claim
runtime success from a syntax check or a mock. The ordinary self-check instructions
below apply to checks that do not require those framework-supplied SDK imports.

When the selected build exports one file, that file must implement normal execution,
`--litai-test`, and `--litai-smoke` without importing any module that was not embedded in
the export or supplied as an explicitly admitted SDK dependency. Source-only `tests` modules are unavailable after custody is discarded; copy
or generate the current test dispatcher into the artifact rather than importing it at
runtime. Exercise both framework modes against the exact exported path before completing
generation.

When the selected build system emits a Python zipapp, remember that a `module:function`
zipapp entry invokes `function()` with no positional arguments. Point it at a
zero-argument archive wrapper that passes `sys.argv[1:]` to the CLI dispatcher, or make
the selected callable itself accept no required arguments. Never point a zipapp directly
at `_cli(argv)` or another callable that requires an argument. The build's default target
must still create the one self-contained runnable file at the framework-supplied exact
`EXPORT_PATH`; running tests without creating that export is not a successful build.

A single-file zipapp has no directory on disk: inside it, `Path(__file__).parent` is the
archive file itself, so opening a packaged runtime-data asset beside `__file__` fails
with `NotADirectoryError`, not `FileNotFoundError`. Read every asset embedded in the
archive through `pkgutil.get_data` or `importlib.resources`, which work both from the
archive and from the source tree. Keep those assets inside an importable package and
name that package, as in `pkgutil.get_data("app", "data/bands.json")`; a top-level
`__main__` script has no package to resolve them from. Generated tests that substitute inline data do not
exercise this path, so `--litai-smoke` must load the real runtime-data assets, and the
build's test target must run `--litai-smoke` against `EXPORT_PATH` as well as
`--litai-test`.

Before completing generation, walk PATH directories in their declared order. Within
each directory consider both `python` and `python3`, select the first compatible Python
3.11+ interpreter, and never allow a preferred executable name in a later directory to
outrank a compatible interpreter in an earlier directory. Use that interpreter to run
`source/main.py --litai-test`, and repair every implementation or generated-test failure
until that command exits zero and reports every manifest case as passed. Every generated
Make recipe or helper invocation that imports from the admitted source tree must disable
bytecode writes (`-B` or `PYTHONDONTWRITEBYTECODE=1`) or redirect `PYTHONPYCACHEPREFIX`
beneath the framework-supplied object root. Verify after `all`, `test`, and `clean` that no
`__pycache__`, `.pyc`, or other derived file appeared under `source/`. This is a
generation-time self-check, not lifecycle authority; do not replace, weaken, or claim
the later independent build and test phases.

For internal/private helper functions (not the Component's `main` entry point already
covered by `source/tests/manifest.json`) with a non-obvious precondition, postcondition,
or invariant relied on by a caller — one whose violation would produce silently wrong
output rather than an obvious crash — add a plain `assert` statement at the point the
condition must hold, with a message identifying which invariant failed
(`assert idx < len(items), "idx out of range in _resolve_offset"`). Do not use `assert`
to validate data that originates outside the process (CLI arguments, file contents,
network input) — Python's `assert` statements are stripped when run with `-O`, and
external input validation must fail the same way in every invocation mode; raise a typed
exception for that case instead. Where a helper's contract is naturally described as "for
all valid inputs of shape X, property Y holds" rather than as a specific pre/post-check
at a single call site, and the `hypothesis` package is available in the execution
environment (it is not part of the standard-library-only baseline this skill otherwise
requires — confirm the selected build target actually permits a third-party test
dependency before using it), prefer a `hypothesis`-based property test in
`source/tests/` over inline `assert`s for that helper, since property-based generation
covers the input space an example-based `assert` cannot. Do not gate an assertion behind
a flag or config value — an untriggered contract provides no evidence; if a check is too
expensive to run unconditionally, omit it rather than making its execution conditional
on something other than Python's own `-O`/`__debug__` semantics. A contract assertion
that fires during `source/tests/litai_test.py` or `--litai-test` execution is an ordinary
generated-test failure, not a new failure channel; repair it the same way any other
failing manifest case is repaired before completing generation.
