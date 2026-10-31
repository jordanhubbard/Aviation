---
name: align-workers
description: Probe, inventory, and align configured macOS, Linux, and Windows workers with the repository's declared prerequisites and the user's private expectations (coding CLI, model, provider configuration, secret files). Use before any worker-backed work — release qualification, sample fan-out, remote rebuilds — and whenever a worker fails for an environmental reason.
metadata:
  author: Literate AI maintainers <literate-ai-maintainers@users.noreply.github.com>
---

# Align workers

Never hand-repair a worker from memory. One command compares every configured worker
with two declared sources of expectations and reports each gap with its remediation:

- **Repository prerequisites**: `literate.worker-template.json` (committed). Commands
  per OS family, a minimum Python, minimum free disk, where Windows tools live off
  `PATH`, and the paths Microsoft Defender must not scan in real time
  (`defender_exclusions`; `{workspace}` is the worker's workspace) plus the executables
  whose file activity it must not scan (`defender_process_exclusions`; `{python}` is
  the real base interpreter behind the template Python, or an absolute `.exe` path;
  shells and script hosts are refused). A process exclusion covers every process of
  that executable on the worker, not only gate work, including packages it installs.
  The Windows release gate reads the same file, so tools are declared once.
- **User expectations** (private, never committed): the coding CLI and model in the
  project-scoped `test.json`, and `worker-alignment.json` in the user configuration
  root (`litai config paths` reports both). It names files every worker must hold, as
  source path to home-relative destination (`secret: true` for credentials), and the
  argv that installs a missing command per OS family.

## Workflow

1. `litai worker list`, then `litai worker align --all`. Inspection is read-only. It
   checks SSH reachability, required commands, Python, free disk, Windows Defender
   exclusions, every declared file by content hash, and makes one live model call
   through the selected coding CLI on each worker. `--worker-id ID` narrows it;
   `--skip-model` skips the model call.
2. Read every finding; each carries a remediation. `aligned: true` with exit status 0
   is the only ready state.
3. `litai worker align --all --apply` with the user's authorization. It runs only
   declared installs for missing commands, adds missing Defender path and process
   exclusions (an administrator SSH session is required; the report names each
   excluded executable), and replaces only files whose bytes differ. It backs the
   old copy up as `<file>.bak-<UTC>` and keeps secrets owner-only. It then
   inspects again and reports what is true afterwards.
4. Gaps that `--apply` does not own:
   - repository tools without a declared install: run the detect-before-install
     bootstrap with its install flag;
   - low disk: `litai worker health`, then an authorized `litai worker cleanup`;
     align never deletes worker data;
   - a model failure with aligned files: check the provider and its key against the
     user's source of truth before blaming the model.
5. Rerun until aligned, then start the worker-backed work.

## Rules

- Keep hostnames, endpoints, credentials, and organization install commands in user
  configuration; the repository template holds only portable prerequisites.
- Secret sources are paths the user chose (for example a private key directory).
  Never print, log, or commit their contents; reports carry hash prefixes only.
- Add a newly discovered prerequisite to `literate.worker-template.json` (repository)
  or `worker-alignment.json` (user) instead of repeating a manual fix.

## Prefer user-supplied workers for fast turnaround

For complex projects where minimum turnaround matters, prefer user-supplied runners
over hosted CI/CD workers. Use the host running the coding CLI first, then aligned
`workers.json` workers, and CI/CD only for platform and action cells those cannot
cover, or when the project marks CI mandatory. User workers keep warm caches,
environments, and synced checkouts, and need no queue or upload. Hosted CI starts
cold each run. Release qualification follows the same order (`litai release
qualify`); align the workers first so a misaligned worker does not fall through to
slow CI.
