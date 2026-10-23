# Private test matrix

`litai init` creates two synthetic files for optional cross-platform fanout and reports
their platform-resolved durable user destinations. Run `litai config paths` to refresh
that report. Copy `literate.workers.example.json` to `worker_config` and replace its SSH
placeholders. Copy `literate.test.example.json` to the project-scoped `test_config` and
select exact worker IDs with matching platform Flavors.

Never commit either private file. Worker names, credentials, dynamic provisioning
skills, and private routes are operator/session configuration rather than application
authority. Set `LITAI_TEST_CONFIG=/absolute/path/to/private-matrix.json` to override the
project-scoped default and
`LITAI_WORKER_CONFIG=/absolute/path/to/private-workers.json` for its worker catalog.

Live `litai rebuild` / sample generation in an initialized project fails closed unless
project-scoped user `test.json` (or `--coding-cli` / `--model`, or `CODING_CLI` /
`LITAI_LIVE_MODEL`) names both a coding CLI and a model. Copy the inert
`coding_cli` and `model` placeholders from `literate.test.example.json`. Remote
workers require `opencode`, configured with credentials for the pinned model's
provider (opencode resolves them; Literate AI does not require a specific key).

A one-shot local override does not rewrite user `test.json`:

```console
LITAI_SESSION_ID=dev make samples \
  SAMPLE_FLAVORS='--sample hello-component --coding-cli cursor-agent --model gpt-5.6-sol-high'
```

When POSIX SSH workers exist with those remote prerequisites and the JSON names that
pair, the bound live gate is:

```console
litai worker probe --all
litai release check PLAN.json --target local --project .
```

Without user `workers.json` the gate fails closed (`release.target_unconfigured`).

Before capability-gated work, run `litai worker probe --all`. It probes configured SSH
workers concurrently and atomically writes `worker-observations.json` beneath the
resolved user state root. An absent `nvidia-smi` means no discoverable NVIDIA
GPU; an installed command whose device query fails is degraded and must not be treated
as GPU-capable. These observations never overwrite minimum routing requirements.

The framework's sample suite defaults unpinned samples to exactly
`flavor://literate-ai/lang-python`, `flavor://literate-ai/build-make`, and the current
host OS. Explicit sample pins remain authoritative. Opt into the full supported matrix
with:

```console
make samples-platform-regression \
  TEST_CONFIG=/path/to/matrix.json SAMPLE='*' \
  SAMPLE_FLAVORS="--flavor flavor://literate-ai/os-* \
--flavor flavor://literate-ai/lang-* \
--flavor flavor://literate-ai/build-*"
```

The exact expanded Flavor selectors participate in the remote checkpoint identity, and
the persistent worker cache retains generated-source and build results between runs.
Supply `WORKER_CONFIG=/path/to/workers.json` alongside the matrix command.

For an external dispatcher, add a `kind: command` worker whose `command` is a direct
argument array. It receives one canonical request on standard input (or at the exact
`{request_file}` argument), returns one typed result, and reads credentials only through
declared environment bindings. Successful builds/tests publish an immutable,
credential-free artifact URI and exact content identity. LitAI validates this protocol;
the external command remains responsible for scheduling and provisioning.

A derived
project may connect the same private matrix to its CI or task router and run `litai
rebuild` for the selected Component and platform Flavor on each worker. The packaged
CLI does not yet claim a generic derived-project fanout verb; consult `litai help` for
the commands actually supported by the installed release.
