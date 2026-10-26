---
name: preflight-host-toolchains
description: Resolve, verify, and install the host tools a Literate AI lifecycle needs — Python, a coding CLI, Flavor-scoped toolchains, and remote worker bootstraps — without silently changing a selected provider or installing without authorization. Use before generation, build, release, or routing work to a test worker.
metadata:
  author: Literate AI maintainers <literate-ai-maintainers@users.noreply.github.com>
---

# Preflight host toolchains

Resolve explicit specification and Flavor pins exactly. Otherwise use bounded `PATH`
discovery and report a missing selected tool instead of silently changing provider,
language, build system, or target. Never install or upgrade a host tool without the
user's authorization.

## Framework prerequisites

The framework dependencies are Python 3.11+, Git, and Git LFS. Treat Git and Git LFS as
one repository-materialization baseline on every supported OS. Read init's
`prerequisites` report before installing Flavor-scoped tools. Generation additionally needs one authenticated `codex`, `claude`,
`cursor-agent`, or `opencode`; honor `CODING_CLI`, else use the first on `PATH`.

Selected Flavors may require further toolchains, and skill changes require NVIDIA
SkillEvaluator; read [host bootstrap evidence](../../../docs/user/installation.md) for
the complete conditional dependency matrix and exact installation rules.

For an end-user installation, `make install` creates an isolated runtime beneath
`${PREFIX:-$HOME/.local}/share/literate-ai/venv` and a stable `litai` launcher beneath
`${PREFIX:-$HOME/.local}/bin`; an explicit `PREFIX` takes precedence. The ignored
`.venv` is contributor state and is not the user installation.

When verifying changes to this repository itself, prefer `make python-check` (or any
other `make` target that depends on `$(RUNTIME_PREREQUISITE)`) over a hand-rolled
`python -m venv`/`uv venv`. Make's `$(PYTHON_ENV)` already resolves to
`$(OBJ_DIR)/python-envs/$(LITAI_SESSION_KEY)` — worktree-scoped through `OBJ_DIR`
defaulting to `$(CURDIR)/_build`, and session-scoped through `LITAI_SESSION_ID` (or a
per-process fallback) — so concurrent agents working the same tree do not create,
reuse, or delete each other's environments. An ad hoc venv with a fixed name (e.g.
`.venv`, `.verify-venv`) in a shared worktree directory has no such isolation and can
collide with another agent's in-flight run.

## Reuse validated worker bootstraps

Apply the same host bootstrap evidence to worker installs: preserve package-manager
locks and obtain user authorization first.

First follow `skills/agent/configure-test-workers/SKILL.md` to obtain private
assignments. Refresh their ignored capacity inventory with `litai worker probe --all`;
observed CPU, memory, and GPU facts do not replace authored routing requirements or
grant dynamic provisioning authority.

When a Standard SSH worker lacks the exact project-pinned non-editable framework
distribution, export its complete target-specific closure with `litai worker wheelhouse
export`. Stage the wheelhouse manifest, then
use `litai worker bootstrap --wheelhouse ... --manifest ... --closure-identity ...
--distribution-identity ...`. The worker verifies every wheel before extraction, installs with
no package index, verifies installed RECORD content, and atomically activates the
exact framework and closure identities. Never skip a wheel identity gate.
Use `--replace-existing` only for explicit replacement. A coordinator may stage the
stdlib-only `literate_ai.remote_worker_bootstrap` module. Never use ambient or editable
packages, arbitrary remote commands, worker-side indexes, or unpinned installs.

For each routed worker, follow `skills/agent/detect-before-install/SKILL.md`. Its
sample-worker invocation is the explicit install authorization: it treats macOS, Linux,
and Windows as vanilla hosts, detects every capability first, installs only missing
packages, and preserves a compact JSON bootstrap report with the run.

## Keep host state honest

Keep framework Python dependencies in the ignored project environment and use the
repository-pinned Node contributor closure. On Windows, preserve native paths and
command wrappers; Bazel test rules need the `bash.exe` shipped by Git for Windows,
discovered through `BAZEL_SH`, `PATH`, or the standard Git install directories — never
substitute another POSIX shell to conceal a portability defect. Never weaken SSH host
verification or a browser sandbox to make bootstrap appear green.
