---
name: configure-test-workers
description: Configure private macOS, Linux, and Windows workers for Literate AI sample fan-out without committing hostnames, usernames, destinations, credentials, or dynamic provisioning logic. Use when creating a local test matrix, selecting a matrix file for litai or Make, or adapting a private task-routing skill to supply ephemeral workers.
metadata:
  author: Literate AI maintainers <literate-ai-maintainers@users.noreply.github.com>
---

# Configure test workers

Keep worker identities and provisioning policy outside the project repository. Let the
Python path adapter choose platform locations; do not construct them from remembered OS
conventions.

1. Run `litai config paths`, then `litai worker list` to inspect the private
   catalog. Use `litai worker add`, `show`, `update`, and `remove` for registrations;
   `--worker-config` selects another absolute catalog. These commands do not
   provision or destroy VMs. Use `--file` for complete advanced descriptors and
   `--if-identity` when applying an earlier reviewed catalog change.
2. Set the SSH endpoint and quoted home-relative workspace (for example
   `--workspace '~/litai'`), plus exact known OS/CPU/GPU requirements. Use
   `litai worker test --all` before dispatch; inspect every worker's independent
   result. Resolve host-key or authentication failures explicitly without disabling
   verification. A successful SSH test does not establish toolchain readiness.
3. Copy `literate.test.example.json` to the reported project-scoped `test_config` path,
   or pass another absolute matrix path with `--config`. Select exact worker IDs and one matching platform Flavor;
   never duplicate endpoints, credentials, or provisioning commands in this matrix. The
   `coding_cli` and `model` fields are free for you to choose — including an inexpensive
   model you know — but the id must be one the coding CLI can actually resolve. After
   setting or changing them, run `litai worker verify-model` before trusting the config:
   it runs one bounded preflight and fails closed with `coding_cli.model_unavailable`
   (naming the model and the real cause) if the id does not resolve, instead of failing
   deep inside a live run. List valid ids with the coding CLI itself (for opencode:
   `opencode models`); a bare provider alias that only the interactive session resolves
   (e.g. `router/...`) is not necessarily the id a `run` subprocess accepts (it may
   need the full `custom-provider/router/...` form).
4. Static registrations are sufficient; do not provision merely because capacity is
   missing. Dynamic allocation requires explicit enablement in the user's local
   configuration, a user-supplied provisioner command, and user-supplied credential
   bindings. When enabled, inspect that command's `--help` or `help` before using the
   user's private routing workflow. Keep provider-specific arguments in that workflow;
   do not invent framework configuration fields or imply that the planned automatic
   provisioning handoff already exists. Materialize assignments outside version control.
   Never copy routing commands, credentials, API keys, or resolved nodes into the project.
5. Run the detect-before-install skill on each assigned worker before Git acquisition or
   sample execution. Then follow the checkout-git-repository skill for any Git-backed
   workspace so shallow history, recursive submodules, and LFS hydration share one
   fail-closed contract. That bootstrap also attempts NTP synchronization to
   `time.nist.gov`; log and continue if it fails. Treat coding-agent authentication as
   a separate readiness gate.
6. Run `litai worker probe --all` to refresh the reported user-state
   `worker_observations` inventory. Review degraded NVIDIA results before
   selecting CUDA work: missing `nvidia-smi` means no discoverable NVIDIA device, while
   an installed command that cannot query its driver is an unknown/degraded state, not
   an empty inventory. Never copy observed capacity into authored minimum requirements.
7. Run `litai worker align --all` (the align-workers skill) and resolve every finding
   before dispatch; it checks the repository template, your coding CLI and model on
   each worker, declared files and secrets, and free disk.
8. Run one sample first, then expand the sample glob only after all workers pass
   platform, source-authority, and toolchain preflight.

For complex projects where minimum turnaround matters, prefer user-supplied runners over hosted CI/CD workers: the host running the coding CLI first, then aligned `workers.json` workers, and CI/CD only for platform and action cells those cannot cover or when the project marks CI mandatory. See `skills/agent/align-workers/SKILL.md`.

The checked-in examples define only synthetic workers and selections. Real worker and
matrix files are durable user configuration outside the project tree.

For explicitly requested dynamic capacity, use `litai worker provisioner configure`
with the user's local versioned command configuration, then explicit `enable`.
Use `command-help` to inspect the organization's adapter and `worker provision`
with a stable request ID. Static workers never require this setup. On failure,
inspect `provisioner status`; use `recover` only for a saved validated response,
without launching again. Never bake organization commands or credentials into
framework code or project configuration.
