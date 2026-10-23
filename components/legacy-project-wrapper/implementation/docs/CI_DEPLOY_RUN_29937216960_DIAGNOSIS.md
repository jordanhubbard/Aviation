# CI Diagnosis — "Deploy Aviation Applications" run 29937216960

Diagnosis only. No application code, Dockerfile, or workflow file was changed by this
investigation; the recommended fixes below are for a follow-up fix task.

| Field | Value |
| --- | --- |
| Repository | `jordanhubbard/Aviation` |
| Workflow | `Deploy Aviation Applications` (`.github/workflows/deploy.yml`) |
| Run | [29937216960](https://github.com/jordanhubbard/Aviation/actions/runs/29937216960) |
| Branch / SHA | `main` @ `030112e1bf41864a8e834303de6be002b880bc2e` |
| Trigger | `push` to `main` |
| Overall conclusion | failure |

## Job outcomes

| Job | ID | Result | Blocking? |
| --- | --- | --- | --- |
| Determine What to Deploy | 88981755912 | success | — |
| Build Flight School | 88981785054 | success | yes |
| Build ForeFlight Dashboard | 88981785101 | success | yes |
| **Build Flight Planner** | **88981785115** | **failure** | **yes** |
| Build Accident Tracker | 88981785182 | failure | no (`continue-on-error: true`) |
| Deploy to Staging | 88982538646 | skipped | — |
| Rollback on Failure | 88982538998 | success | — |
| Deploy to Production | 88982539429 | skipped | — |

`Deploy to Staging` requires `needs.build-flightplanner.result == 'success' || 'skipped'`, so the
Flight Planner failure is what gated the deployment. `Build Accident Tracker` carries
`continue-on-error: true`, so its failure did not gate staging on its own — but it is a real,
reproducible failure and is documented below as a secondary finding.

---

## Primary (blocking) failure — Build Flight Planner

* **Failing step:** `Build and push` (step 6, `docker/build-push-action@v7`, `context: .`,
  `file: ./apps/flight-planner/Dockerfile`, `push: true`).
* **Failing command inside the build:** `RUN npm ci` in the `frontend-build` stage of
  `apps/flight-planner/Dockerfile` (line 5), running on `node:20-alpine`.
* **CI annotation (`.github#395`):**

  ```
  buildx failed with: ERROR: failed to build: failed to solve:
  process "/bin/sh -c npm ci" did not complete successfully: exit code: 1
  ```

The failure happens in the frontend dependency-install stage, *before* the registry push, so no
`ghcr.io` credential or permission problem is involved (the `Log in to Container Registry` step
succeeded, and the two sibling image builds pushed successfully in the same run).

### Root cause

`apps/flight-planner/frontend/package.json` pins two mutually incompatible devDependencies:

| Package | Range in `package.json` | Version in `package-lock.json` | Declared peer |
| --- | --- | --- | --- |
| `eslint` | `^8.55.0` | `8.57.1` | — |
| `eslint-plugin-react-refresh` | `^0.5.2` | `0.5.2` | `eslint: ^9 \|\| ^10` |

`eslint-plugin-react-refresh` dropped ESLint 8 support at `0.5.0` (peer range moved from
`>=8.40` on the `0.4.x` line to `>=9`). npm's strict peer-dependency resolution therefore
rejects the tree and `npm ci` exits 1:

```
npm error code ERESOLVE
npm error While resolving: eslint-plugin-react-refresh@0.5.2
npm error Found: eslint@8.57.1
npm error   dev eslint@"^8.55.0" from the root project
npm error Could not resolve dependency:
npm error peer eslint@"^9 || ^10" from eslint-plugin-react-refresh@0.5.2
npm error Conflicting peer dependency: eslint@10.8.1
```

Note that `package.json` and `package-lock.json` are *in sync* with each other (no lockfile-drift
error); the conflict is baked into the pinned versions themselves, which is why the build fails
deterministically on every run rather than intermittently.

### Reproduction (local, offline-deterministic)

Docker is unavailable in the diagnosis sandbox, so the failing layer was reproduced directly by
copying `apps/flight-planner/frontend/{package.json,package-lock.json}` into an empty directory —
exactly the file set the Dockerfile's `frontend-build` stage copies before `RUN npm ci` — and
running `npm ci` (npm 10.9.8; CI's `node:20-alpine` ships the same npm 10 line):

```
$ npm ci
npm error code ERESOLVE
...
EXIT=1
```

The local exit code and error class match the CI annotation exactly.

### Corroboration

`apps/foreflight-dashboard/frontend` pins `eslint@^8.57.1` together with
`eslint-plugin-react-refresh@^0.4.5` (an ESLint-8-compatible line) and its image built and pushed
successfully in the same run. `apps/aviation-accident-tracker/frontend` and
`apps/g1000-simulator` are already on `eslint@^10.1.0`, so only Flight Planner sits on the
broken combination.

### Classification

**code** — a dependency pin inside the repository. It is not infrastructure (checkout, Buildx,
registry login, and pushes all succeeded), not a flaky test (no test executes in this step; the
failure is deterministic and reproduced offline), and not an external-dependency outage (the
registry served the packages fine; the conflict is between two versions the repo itself pins).

### Recommended fix

Downgrade the plugin to the ESLint-8-compatible line in
`apps/flight-planner/frontend/package.json` and regenerate the lockfile:

```jsonc
"eslint-plugin-react-refresh": "^0.4.5"   // was "^0.5.2"
```

```bash
cd apps/flight-planner/frontend && npm install --package-lock-only
```

**Verified locally:** with `^0.4.5` (resolving to `0.4.26`, peer `eslint: >=8.40`),
`npm install --package-lock-only` succeeds, `npm ci` exits 0 (524 packages installed), and the
subsequent Dockerfile step `npm run build` (`tsc && vite build`) also exits 0 — 12,948 modules
transformed, `dist/` emitted. So this one-line change plus a lockfile regeneration is expected to
carry the `frontend-build` stage to completion.

Alternatives considered:

* Upgrade `eslint` to `^9`/`^10` and keep `eslint-plugin-react-refresh@^0.5.2`. Correct long-term
  direction (it is where the other apps already are) but a larger change: ESLint 9 requires flat
  config, and this app still uses `.eslintrc.cjs` plus `@typescript-eslint@^6`, which would need
  bumping too. Better as its own task.
* `npm ci --legacy-peer-deps` in the Dockerfile. Unblocks CI without fixing the incompatibility
  and silently installs a plugin against an unsupported ESLint. Not recommended.

**Not** accept-as-transient: the failure is deterministic and reproduces offline.

---

## Secondary (non-blocking) failure — Build Accident Tracker

* **Failing step:** `Build and push backend`.
* **Failing command:** the multi-`--workspace` `npm ci` in the `development` stage of
  `apps/aviation-accident-tracker/Dockerfile`.
* **CI annotation (`.github#361`):**

  ```
  buildx failed with: ERROR: failed to build: failed to solve: process "/bin/sh -c npm ci
      --workspace @aviation/accident-tracker-backend
      --workspace @aviation/accident-tracker-frontend
      --workspace @aviation/shared-sdk
      --workspace @aviation/keystore
      --workspace @aviation/ui-framework" did not complete successfully: exit code: 1
  ```

### Root cause

Not the reason given in the workflow comment (`# non-blocking: npm workspaces not yet configured
in root package.json`) — the root `package.json` *does* declare `workspaces`. The actual cause is
that this repository is pnpm-managed (`pnpm-workspace.yaml`, `pnpm-lock.yaml`, contract bootstrap
`pnpm install`) and its internal packages depend on each other through the pnpm/Yarn
`workspace:*` protocol, which npm does not understand:

```
packages/keystore/package.json:                    "@aviation/shared-sdk": "workspace:*"
packages/ui-framework/package.json:                "@aviation/shared-sdk": "workspace:*"
apps/aviation-accident-tracker/backend/package.json:  "@aviation/keystore": "workspace:*"
apps/aviation-accident-tracker/frontend/package.json: "@aviation/ui-framework": "workspace:*"
```

Reproduced locally by recreating the Dockerfile's file layout (root `package.json` /
`package-lock.json`, the backend and frontend manifests, the three `packages/` manifests) and
running the same command:

```
npm error code EUNSUPPORTEDPROTOCOL
npm error Unsupported URL Type "workspace:": workspace:*
EXIT=1
```

### Classification

**code** — a build-configuration mismatch (npm-based Dockerfile over a pnpm-based workspace),
deterministic, not infrastructure or flake.

### Recommended fix

Convert `apps/aviation-accident-tracker/Dockerfile` to pnpm (`corepack enable`, copy
`pnpm-lock.yaml` + `pnpm-workspace.yaml`, `pnpm install --frozen-lockfile --filter ...`), matching
the repository's declared bootstrap. Dropping `workspace:*` in favour of npm-resolvable ranges
would be the alternative, but it fights the repo's chosen package manager. Once the image builds,
the `continue-on-error: true` on `build-accident-tracker` and its stale comment should be removed
so the job is genuinely gating. This is separate work from the Flight Planner fix and should be
its own task.

---

## Notes and limitations

* Raw Actions log archives (`gh run view --log-failed`, `gh api .../jobs/<id>/logs`) redirect to
  Azure blob storage / `results-receiver.actions.githubusercontent.com`, which are outside this
  sandbox's egress allowlist and returned `403 Forbidden`. The diagnosis therefore uses the GitHub
  API job/step conclusions and check annotations (which name the exact failing command and exit
  code) plus local reproduction of the failing commands. Both sources agree.
* Docker is not installed in the diagnosis sandbox, so `docker build -f apps/flight-planner/Dockerfile .`
  could not be run end to end; the failing Dockerfile stage was reproduced command-for-command
  against the same input files instead.
