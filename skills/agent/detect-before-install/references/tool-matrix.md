# Sample-worker tool matrix

The worker profile supports every repository sample. Detect commands first; package
names are installation hints only and never override a specification or Flavor pin.

| Capability | Commands | macOS/Homebrew | Ubuntu/APT | Windows package source |
| --- | --- | --- | --- | --- |
| Python runtime and isolated environments | `python3` or `python`, version 3.11+, plus importable `venv` and `ensurepip` | `python@3.13` | `python3`, `python3-venv` | pinned Python 3.13 via Windows Package Manager stage zero |
| source control | `git`, `git-lfs` | `git`, `git-lfs` | `git`, `git-lfs` | `git`, `git-lfs` |
| JS runtime | `node`, `npm` | `node` | `nodejs`, `npm` | `nodejs-lts` |
| native build | `make`, C++ compiler | `make`, `llvm` | `build-essential`, `clang` | Chocolatey `make`; Winget Visual Studio 2022 Build Tools with `Microsoft.VisualStudio.Workload.VCTools` |
| Rust | `rustc`, `cargo` | `rust` | `rustc`, `cargo` | `rust` |
| Bazel | `bazel` or `bazelisk` | `bazelisk` | pinned npm Bazelisk | `bazelisk` |
| coding agent | one of `codex`, `claude`, `cursor-agent`, `opencode` | pinned Codex npm package by default | same | same |
| Bazel Windows shell | `bash.exe` | n/a | n/a | supplied by `git` |
| Bazel Windows native runtime | n/a | n/a | n/a | `vcredist140` (VC++ 14 runtime DLLs) |

SSH transport and a system Python capable of launching the compatibility bootstrap are
the macOS/Linux stage-zero prerequisites. Windows PowerShell installs the pinned Python
runtime when necessary before invoking the shared Python bootstrap. Python 3.11+ is then
required in the final report. Coding-agent login or an environment token is a separate
readiness check. Each OS Flavor also requires a best-effort NTP sync to `time.nist.gov`
during this host-configuration step; a missing client, missing privilege, or failed
sync is recorded in `clock_sync` and does not fail sample-worker readiness.
Browser/toolchain additions remain Flavor-specific unless the sample-worker profile
begins exercising them unconditionally.

Git and Git LFS are one baseline capability pair. Installing the `git-lfs` package is
not sufficient checkout evidence by itself: each materialized repository must still use
repository-local LFS setup, hydrate its selected revision, and verify that required LFS
pointers were replaced. Apply the same rule recursively to submodules.

Windows workers use `%USERPROFILE%\\.litai\\sources`, `objects`, and `python` as the
default persistent cache roots. These are deliberately short, per-user, and independent;
do not require registry changes or administrator access merely to enable long paths.

## Current worker bootstrap record

This compact record captures what the repository actually needed on representative
workers on 2026-08-07 and 2026-08-08. It is operational evidence, not a Component or
Flavor version pin.

| Worker | Initially absent and installed | Verified baseline after detection |
| --- | --- | --- |
| macOS 26.6 arm64 | The first bootstrap also upgraded an existing Homebrew Python formula before versioned-Python discovery was fixed | Python `3.14.6`, Git `2.55.0`, Node `26.6.0`, npm `11.18.0`, Apple Clang `17.0.0`, Rust/Cargo `1.95.0`, Bazelisk `1.29.0`, Bazel `9.2.0`, Codex `0.146.0` |
| Ubuntu 26.04 x86_64 | Nothing; the required baseline was already present | Python `3.14.4`, Git `2.53.0`, Node `22.22.2`, npm `10.9.7`, GNU C++ `15.2.0`, Rust/Cargo `1.93.1`, Bazelisk `1.28.1`, Bazel `9.2.0`, Codex `0.146.0` |
| Ubuntu 24.04 x86_64 | `python3.12-venv` (generalized in the bootstrap as `python3-venv`), Bubblewrap `0.9.0`, Bazelisk `1.28.1`, and Codex `0.147.0` through pinned global npm packages; the bootstrap now uses noninteractive sudo for Linux global npm installation | Python `3.12.3` with isolated-environment support, Git `2.43.0`, Node `18.19.1`, npm `9.2.0`, GNU C++ `13.3.0`, Rust/Cargo `1.75.0`, Bazelisk `1.28.1`, Codex `0.147.0`; AppArmor's `kernel.apparmor_restrict_unprivileged_userns=1` still denies Codex/Bubblewrap loopback namespace creation, so private VM runs must explicitly select an external isolation policy or another coding CLI |
| Windows 11 build 26200 x86_64 | Python `3.13.14` through Winget; Chocolatey `2.7.3`; Bazelisk `1.29.0`, Git `2.55.0.3`, Make `4.4.1`, MinGW `16.1.0`, Node LTS `24.19.0`, Rust `1.97.1` through Chocolatey; direct Bazel execution exposed first an absent `vcredist140` runtime and then absent Visual C++ Build Tools | Detection now treats Git Bash, the three required VC++ 14 runtime DLLs, an x64 MSVC Build Tools installation, and the pre-existing Codex `0.147.0` as separate capabilities; MinGW is recorded but does not satisfy Bazel's compiler prerequisite |

On Windows, invoke npm-installed launchers by their `.cmd` names from PowerShell. A
vanilla execution policy may reject the sibling `.ps1` launchers even though the tools
are correctly installed. Do not substitute Chocolatey's MinGW compiler for MSVC in the
Bazel sample-worker profile: command discovery alone is not proof that Bazel can create
the configured C++ actions.

Coding-agent authentication is independent of dependency bootstrap. At the time of this
record, macOS and Windows were logged into Codex using ChatGPT; Ubuntu reported `Not
logged in` and must receive a token or interactive login before generation work there.
The Ubuntu 24.04 observation likewise had no Codex login or environment token, and its
fresh SSH identity lacked direct private-repository Git authorization; use private
working-tree transport until those separate credentials are provisioned.
