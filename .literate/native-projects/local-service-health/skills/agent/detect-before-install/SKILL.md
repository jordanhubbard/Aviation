---
name: detect-before-install
description: Detect and bootstrap missing Literate AI host prerequisites on vanilla macOS, Linux, or Windows workers. Use when preparing a new worker, diagnosing a missing compiler/build/coding CLI, or running the cross-platform matrix on a host whose tools have not yet been provisioned.
metadata:
  author: Literate AI maintainers <literate-ai-maintainers@users.noreply.github.com>
---

# Detect before install

Treat every worker as a vanilla OS plus the Python and SSH access needed to launch the
bootstrap. Never infer that a previous image or interactive session installed the rest.

## Workflow

1. On Windows, run `scripts/bootstrap.ps1`; on macOS or Linux, run
   `scripts/bootstrap.py --profile sample-worker`. Both report missing commands without
   changing the host. The Windows launcher treats the Store application alias as absent
   unless it executes as Python 3.11+.
2. If installation is authorized, rerun with `-InstallMissing` or
   `--install-missing`. The scripts invoke
   only the native package manager and installs only packages associated with absent
   capabilities.
3. Preserve the emitted JSON as worker evidence. Add its `path_entries` to the worker
   process, then rediscover and pin every selected executable through Literate AI.
   Preserve the absolute discovered launcher path when a command is a symlink or wrapper;
   resolving it into a package-internal script makes its reported parent unusable as a
   `PATH` entry.
   On Windows, place generated-source, object, and Python caches in short sibling
   directories beneath `%USERPROFILE%\\.litai`; do not assume the host has enabled the
   optional long-path policy.
4. Stop on unavailable privilege, package-manager, package, or authentication state.
   Never report a partial bootstrap as ready. Clock synchronization to `time.nist.gov` is
   attempted in the same host-configuration step and recorded under `clock_sync`; a
   failed or skipped attempt is logged on stderr and must not by itself mark the report
   `passed` false.
5. Authenticate the selected coding CLI separately. Installation never fabricates,
   copies, or logs credentials.

Use `references/tool-matrix.md` when changing the profile or package mappings. Keep
language/build requirements in Flavors; this operational profile is the repository's
cross-platform sample-worker baseline, not Component authority.

Usernames, hostnames, destinations, and private routing skills belong in ignored
user/session configuration, never this reusable skill. Use the configure-test-workers
skill to create or select that private matrix.

## Safety rules

- Detect before every install and skip every capability already present.
- Use argv subprocesses, never shell command strings or downloaded installer scripts.
- Pin non-OS bootstrap packages in the scripts and record the package manager and command
  names in evidence. Python 3.11+ and its usable `venv`/`ensurepip` closure are separate
  detected worker capabilities, not merely an assumed launcher. On Debian-family hosts,
  install `python3-venv` when the runtime exists without that closure.
- On Windows, prefer an existing Chocolatey; use Windows Package Manager only to acquire
  Chocolatey when it is absent. A newly installed package manager may require a fresh
  worker process before continuing.
- Keep Windows cache roots compact without abbreviating receipt field names. A vanilla
  host may retain the 260-character legacy path ceiling, and content-addressed object
  paths consume much of that budget before artifact-relative paths are appended.
- Treat the Microsoft Visual C++ 14 runtime as a Windows Bazel prerequisite. Require
  `MSVCP140.dll`, `VCRUNTIME140.dll`, and `VCRUNTIME140_1.dll` beneath System32; install
  the `vcredist140` package only when that complete runtime capability is absent.
- Treat the Microsoft x64 C++ compiler as a separate Windows Bazel prerequisite. Accept
  `cl.exe` on `PATH` or discover it through `vswhere` and the standard Visual Studio
  installation roots. MinGW does not satisfy this capability. When it is absent, use
  Windows Package Manager to install `Microsoft.VisualStudio.2022.BuildTools` with the
  `Microsoft.VisualStudio.Workload.VCTools` workload noninteractively, then rediscover
  the compiler before continuing.
- On Linux, require root or noninteractive `sudo`; never pause a remote worker for a
  password. Codex workspace-write also requires usable unprivileged user namespaces;
  installing `bubblewrap` cannot override an AppArmor/sysctl policy that denies them.
  When `kernel.apparmor_restrict_unprivileged_userns=1`, require and load the
  distribution's `/etc/apparmor.d/bwrap-userns-restrict` policy before invoking Codex;
  its absence is a host-policy prerequisite failure, not a source-generation retry.
  Prefer enabling that OS capability or another coding CLI. Use
  `LITAI_CODEX_SANDBOX=danger-full-access` only for a runner already isolated by an
  external VM/container policy, and make that an explicit private worker choice.
  On macOS, an absent Homebrew is installed as a pinned Git checkout in
  `/opt/homebrew` using system Git and noninteractive `sudo`; no downloaded installer
  script is executed. Refuse to overwrite an existing nonfunctional prefix.
- Do not upgrade tools that already satisfy command discovery. Version constraints are
  applied later by the selected specification and Flavors.
