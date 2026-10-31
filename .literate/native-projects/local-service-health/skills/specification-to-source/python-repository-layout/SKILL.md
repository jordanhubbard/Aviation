---
name: "python-repository-layout"
description: "Python repository layout. Use for Literate AI workflow tasks."
metadata:
  author: "Literate AI maintainers <literate-ai-maintainers@users.noreply.github.com>"
schema: "urn:literate-ai:schema:v1:specification-to-source-skill"
skill_id: "python-repository-layout"
version: "1.2.2"
title: "Python repository layout"
stages:
  - "plan"
  - "generate"
dependencies:
  - schema: "urn:literate-ai:schema:v1:skill-reference"
    skill_id: "repository-layout"
    version: "1.1.0"
    identity:
      schema: "urn:literate-ai:schema:v1:content-identity"
      algorithm: "sha256"
      digest: "39f0145075f349d8dac3bf0f00484c73a8588a3e9f3dd983240bac5dc4854a33"
limitations:
  - "Do not place importable product packages or project-specific build-backend modules directly at the repository root."
  - "Do not depend on the current working directory making undeclared root modules importable."
  - "Do not write __pycache__, bytecode, wheel staging, coverage data, or virtual environments into authored package directories."
trust: "repository-reviewed"
---
# Python repository layout

Use a `src/` layout for importable product code: packages live beneath
`src/<import_name>/`, tests live beneath `tests/`, and packaging plus tool configuration
lives in the root `pyproject.toml`. Declare console entrypoints through
`[project.scripts]`; do not keep executable product modules at the repository root or
rely on the working directory appearing first on `sys.path`. Test the installed or
editable distribution so missing package data and accidental root imports fail early.

A project-specific PEP 517 backend may be in-tree when required, but place it in a
dedicated authored tool directory such as `tools/build_backend/` and select it through
`build-system.backend-path`. Its distribution-root calculation must remain correct from
both a checkout and an sdist. Keep ordinary product modules under `src/`; an in-tree
backend is packaging tooling, not application source.

Configure wheel/build staging, bytecode, test caches, coverage output, and other derived
Python state beneath `OBJ_DIR`/`_build` where the corresponding tool supports a build
root (see `repository-layout` for the advisory-cache-prefix rule this follows). Create
each framework- or agent-managed virtual environment beneath
`OBJ_DIR/python-envs/<validated-session-id>` and propagate that session identity through
nested build commands. Parallel sessions must never install into, replace, or clean the
same environment. A conventional ignored root `.venv/` may remain only as explicitly
user-owned state; do not create or mutate it automatically. Never create or import a
root-level Python module merely to make source-tree execution convenient; use an
editable install, an explicit `PYTHONPATH=src` development command, or the installed
console entrypoint. Ordinary `clean` must retain `OBJ_DIR/python-envs`; only an
explicitly exclusive `really-clean` may remove every session environment.

## Parallel and randomised testing

Include `pytest-xdist` and `pytest-randomly` in the `dev` extra of
`[project.optional-dependencies]`. Configure them in `[tool.pytest.ini_options]`:

```toml
[tool.pytest.ini_options]
addopts = "-n auto --dist=loadfile --randomly-seed=12345"
testpaths = ["tests/unit"]
```

`-n auto` spawns one worker per logical CPU core via `pytest-xdist`, running each test
module in a separate process and reducing wall-clock time roughly in proportion to the
number of cores. `--dist=loadfile` keeps all tests from the same file on the same worker,
preventing intra-file ordering issues. Use an explicit fixed `--randomly-seed=<N>`, not
`last`: `last` reads the previous run's seed from `.pytest_cache`, which does not exist
on a fresh checkout (CI, a new clone, a cleaned worktree) — `pytest-randomly` then picks
an independent random seed per xdist worker, and workers disagree on collection order,
failing with "Different tests were collected between workers". A fixed seed still
randomises order (just deterministically across runs); pass a different `--randomly-seed=<N>`
on the command line to explore other orderings or reproduce a specific historical failure.

Do not use `scope="session"` fixtures that write shared mutable state to the filesystem
when `-n auto` is active, as workers run in separate processes with independent
`tmp_path` roots. Module- or function-scoped fixtures are safe.

When multiple test modules share a single external resource (e.g., a git repository
cache directory keyed off `OBJ_DIR` or a similar env variable), isolate it
per-worker with a session-scoped autouse fixture in `tests/unit/conftest.py`:

```python
import os
import pytest

@pytest.fixture(scope="session", autouse=True)
def _isolate_git_cache(tmp_path_factory: pytest.TempPathFactory):
    worker = os.environ.get("PYTEST_XDIST_WORKER", "main")
    obj = tmp_path_factory.getbasetemp() / f"obj-{worker}"
    obj.mkdir(exist_ok=True)
    old = os.environ.get("OBJ_DIR")
    os.environ["OBJ_DIR"] = str(obj)
    yield
    if old is None:
        os.environ.pop("OBJ_DIR", None)
    else:
        os.environ["OBJ_DIR"] = old
```

Each worker gets a unique directory, so concurrent `git fetch` calls from
different workers target different cache directories and never collide.
