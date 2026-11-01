# Release 1.0 contribution inventory

- **Status:** active
- **Owning queue item:** [RELEASE-001](active-work.md#release-001-reconcile-all-outstanding-contributions-into-release-10)
- **Completion / archival evidence:** pending contribution reconciliation and release publication

All items below are included in 1.0.0 by explicit user direction. A scope assignment
does not establish merge, test, supersession, or completion evidence.

## Tracker contributions in the original scope

The original scope contains 47 contributions. All 44 dependency/CI PRs are now
closed with individual comparisons and exact-main CI evidence in their comments.
PR #210 and issues #176/#332 remain included in 1.0 until their complete
acceptance is qualified. No feature request is closed by the dependency batch.

| Kind | Item | Title | State |
| --- | --- | --- | --- |
| issue | [#332](https://github.com/jordanhubbard/Aviation/issues/332) | Complete isolated remote E2E coverage for all Aviation services | included; reconciliation pending |
| issue | [#176](https://github.com/jordanhubbard/Aviation/issues/176) | feat: AI decision explanation layer for each app | included; reconciliation pending |
| review | [#303](https://github.com/jordanhubbard/Aviation/pull/303) | Make Aviation's last three CI jobs green (integration-tests, pip-audit, trivy) (task_b3e16b5f6d9f43a69307f2827a7f6368) | closed; current pins equal/newer, exact-main named jobs pass |
| review | [#296](https://github.com/jordanhubbard/Aviation/pull/296) | chore(deps): bump codecov/codecov-action from 6 to 7 | closed; incorporated/superseded by #396; exact-main CI passes |
| review | [#295](https://github.com/jordanhubbard/Aviation/pull/295) | chore(deps): bump actions/checkout from 6 to 7 | closed; incorporated/superseded by #396; exact-main CI passes |
| review | [#294](https://github.com/jordanhubbard/Aviation/pull/294) | chore(deps-dev): bump @types/node from 20.19.37 to 26.0.1 in /apps/weather-briefing | closed; incorporated/superseded by #396; exact-main CI passes |
| review | [#293](https://github.com/jordanhubbard/Aviation/pull/293) | chore(deps-dev): bump @types/node from 20.19.37 to 26.0.1 in /packages/keystore | closed; incorporated/superseded by #396; exact-main CI passes |
| review | [#292](https://github.com/jordanhubbard/Aviation/pull/292) | chore(deps): bump the npm_and_yarn group across 2 directories with 6 updates | closed; incorporated/superseded by #396; exact-main CI passes |
| review | [#291](https://github.com/jordanhubbard/Aviation/pull/291) | chore(deps): bump the npm_and_yarn group across 3 directories with 6 updates | closed; incorporated/superseded by #396; exact-main CI passes |
| review | [#290](https://github.com/jordanhubbard/Aviation/pull/290) | chore(deps): bump the npm_and_yarn group across 3 directories with 6 updates | closed; incorporated/superseded by #396; exact-main CI passes |
| review | [#285](https://github.com/jordanhubbard/Aviation/pull/285) | chore(deps): bump the npm_and_yarn group across 3 directories with 7 updates | closed; incorporated/superseded by #396; exact-main CI passes |
| review | [#282](https://github.com/jordanhubbard/Aviation/pull/282) | chore(deps): bump the npm_and_yarn group across 3 directories with 7 updates | closed; incorporated/superseded by #396; exact-main CI passes |
| review | [#272](https://github.com/jordanhubbard/Aviation/pull/272) | chore(deps): bump the npm_and_yarn group across 1 directory with 5 updates | closed; incorporated/superseded by #396; exact-main CI passes |
| review | [#270](https://github.com/jordanhubbard/Aviation/pull/270) | chore(deps-dev): bump @types/node from 20.19.37 to 25.7.0 in /apps/flight-tracker | closed; incorporated/superseded by #396; exact-main CI passes |
| review | [#269](https://github.com/jordanhubbard/Aviation/pull/269) | chore(deps): bump ws from 8.20.0 to 8.20.1 in /apps/flight-tracker | closed; workspace override and lock resolve 8.22.0 |
| review | [#265](https://github.com/jordanhubbard/Aviation/pull/265) | chore(deps): bump uuid from 13.0.0 to 14.0.0 in /apps/aviation-accident-tracker/backend in the npm_and_yarn group across 1 directory | closed; incorporated/superseded by #396; exact-main CI passes |
| review | [#264](https://github.com/jordanhubbard/Aviation/pull/264) | chore(deps): bump pnpm/action-setup from 4 to 6 | closed; incorporated/superseded by #396; exact-main CI passes |
| review | [#263](https://github.com/jordanhubbard/Aviation/pull/263) | chore(deps): bump dependabot/fetch-metadata from 3.0.0 to 3.1.0 | closed; incorporated/superseded by #396; exact-main CI passes |
| review | [#262](https://github.com/jordanhubbard/Aviation/pull/262) | chore(deps): update pytz requirement from >=2024.1 to >=2026.1.post1 in /apps/flightschool | closed; incorporated/superseded by #396; exact-main CI passes |
| review | [#261](https://github.com/jordanhubbard/Aviation/pull/261) | chore(deps): update email-validator requirement from >=2.0.0 to >=2.3.0 in /apps/flightschool | closed; incorporated/superseded by #396; exact-main CI passes |
| review | [#260](https://github.com/jordanhubbard/Aviation/pull/260) | chore(deps): update pillow requirement from >=10.0.0 to >=12.2.0 in /apps/flightschool | closed; incorporated/superseded by #396; exact-main CI passes |
| review | [#259](https://github.com/jordanhubbard/Aviation/pull/259) | chore(deps): update google-auth-oauthlib requirement from >=1.2.0 to >=1.3.1 in /apps/flightschool | closed; incorporated/superseded by #396; exact-main CI passes |
| review | [#258](https://github.com/jordanhubbard/Aviation/pull/258) | chore(deps): update werkzeug requirement from >=3.1.0 to >=3.1.8 in /apps/flightschool | closed; incorporated/superseded by #396; exact-main CI passes |
| review | [#256](https://github.com/jordanhubbard/Aviation/pull/256) | chore(deps-dev): bump typescript from 5.9.3 to 6.0.3 in /apps/flight-tracker | closed; incorporated/superseded by #396; exact-main CI passes |
| review | [#255](https://github.com/jordanhubbard/Aviation/pull/255) | chore(deps-dev): bump typescript from 5.9.3 to 6.0.3 in /apps/weather-briefing | closed; incorporated/superseded by #396; exact-main CI passes |
| review | [#254](https://github.com/jordanhubbard/Aviation/pull/254) | chore(deps-dev): bump typescript from 5.9.3 to 6.0.3 in /packages/keystore | closed; incorporated/superseded by #396; exact-main CI passes |
| review | [#251](https://github.com/jordanhubbard/Aviation/pull/251) | chore(deps-dev): bump vitest from 1.6.1 to 4.1.4 in /packages/shared-sdk | closed; incorporated/superseded by #396; exact-main CI passes |
| review | [#250](https://github.com/jordanhubbard/Aviation/pull/250) | chore(deps): bump redis from 5.11.0 to 5.12.1 in /packages/shared-sdk | closed; incorporated/superseded by #396; exact-main CI passes |
| review | [#249](https://github.com/jordanhubbard/Aviation/pull/249) | chore(deps-dev): bump @types/node from 20.19.37 to 25.6.0 in /packages/shared-sdk | closed; incorporated/superseded by #396; exact-main CI passes |
| review | [#245](https://github.com/jordanhubbard/Aviation/pull/245) | chore(deps): bump pytest from 8.0.2 to 9.0.3 in /apps/foreflight-dashboard in the pip group across 1 directory | closed; exact 9.0.3 pin already incorporated |
| review | [#243](https://github.com/jordanhubbard/Aviation/pull/243) | chore(deps-dev): bump vitest from 1.6.1 to 4.1.3 in /packages/ui-framework | closed; incorporated/superseded by #396; exact-main CI passes |
| review | [#242](https://github.com/jordanhubbard/Aviation/pull/242) | chore(deps): bump dotenv from 17.4.0 to 17.4.1 in /apps/aviation-accident-tracker/backend | closed; incorporated/superseded by #396; exact-main CI passes |
| review | [#240](https://github.com/jordanhubbard/Aviation/pull/240) | chore(deps-dev): bump @types/node from 20.19.37 to 25.5.2 in /packages/ui-framework | closed; incorporated/superseded by #396; exact-main CI passes |
| review | [#239](https://github.com/jordanhubbard/Aviation/pull/239) | chore(deps-dev): bump @types/node from 20.19.37 to 25.5.2 in /apps/aviation-accident-tracker/backend | closed; incorporated/superseded by #396; exact-main CI passes |
| review | [#235](https://github.com/jordanhubbard/Aviation/pull/235) | chore(deps-dev): bump jsdom from 29.0.1 to 29.0.2 in /packages/ui-framework | closed; incorporated/superseded by #396; exact-main CI passes |
| review | [#234](https://github.com/jordanhubbard/Aviation/pull/234) | chore(deps): bump python-multipart from 0.0.22 to 0.0.24 in /apps/foreflight-dashboard | closed; current qualified pin is 0.0.31 |
| review | [#233](https://github.com/jordanhubbard/Aviation/pull/233) | chore(deps): bump uvicorn from 0.42.0 to 0.44.0 in /apps/foreflight-dashboard | closed; incorporated/superseded by #396; exact-main CI passes |
| review | [#231](https://github.com/jordanhubbard/Aviation/pull/231) | chore(deps): bump faker from 40.11.1 to 40.13.0 in /apps/foreflight-dashboard | closed; incorporated/superseded by #396; exact-main CI passes |
| review | [#229](https://github.com/jordanhubbard/Aviation/pull/229) | chore(deps-dev): bump msw from 1.3.5 to 2.13.0 in the dev-dependencies group | closed; incorporated/superseded by #396; exact-main CI passes |
| review | [#221](https://github.com/jordanhubbard/Aviation/pull/221) | chore(deps-dev): bump @typescript-eslint/parser from 6.21.0 to 8.58.0 in /apps/flight-planner/frontend | closed; incorporated/superseded by #396; exact-main CI passes |
| review | [#220](https://github.com/jordanhubbard/Aviation/pull/220) | chore(deps-dev): bump jsdom from 23.2.0 to 29.0.1 in /apps/flight-planner/frontend | closed; incorporated/superseded by #396; exact-main CI passes |
| review | [#219](https://github.com/jordanhubbard/Aviation/pull/219) | chore(deps): bump requests from 2.33.0 to 2.33.1 in /apps/foreflight-dashboard | closed; incorporated/superseded by #396; exact-main CI passes |
| review | [#217](https://github.com/jordanhubbard/Aviation/pull/217) | chore(deps): bump pandas from 3.0.1 to 3.0.2 in /apps/foreflight-dashboard | closed; incorporated/superseded by #396; exact-main CI passes |
| review | [#216](https://github.com/jordanhubbard/Aviation/pull/216) | chore(deps): bump redis from 5.10.0 to 5.11.0 | closed; incorporated/superseded by #396; exact-main CI passes |
| review | [#210](https://github.com/jordanhubbard/Aviation/pull/210) | feat: implement aviation stubs — fuzzy ingest matching + nav radio sim | included; reconciliation pending |
| review | [#209](https://github.com/jordanhubbard/Aviation/pull/209) | chore(deps): bump the npm_and_yarn group across 1 directory with 2 updates | closed; incorporated/superseded by #396; exact-main CI passes |
| review | [#190](https://github.com/jordanhubbard/Aviation/pull/190) | chore(deps-dev): bump typescript from 5.9.3 to 6.0.2 in /apps/aviation-accident-tracker/backend | closed; incorporated/superseded by #396; exact-main CI passes |

## Reconciled branches

### Completed dependency consolidation

The retained workspace now incorporates the requested package/requirement changes
from all remaining dependency PRs, preserving newer existing requirements. The
Flight Planner ESLint plugin moves with its parser to avoid an incompatible peer
pair. CI actions use checkout v7, pnpm setup v6, Codecov v7, and Dependabot
metadata v3.1.0. Removed npm locks are replaced by the current pnpm workspace
lock; it resolves the #209 brace-expansion 5.0.5 and yaml 1.10.3 fixes.

Local validation passes: 13 Node test suites with none skipped, seven affected
application builds, both affected frontend lint commands, 194 ForeFlight tests,
and 64 Flight School tests (25 pre-existing replaced-route skips). The full
retained harness passed build, test, and package, producing finalized receipt
`sha256:30b09e9b999a7898e83459402d33223f7fed27b27e2e79376aa8e17fff5f7171`.
These are retained implementation checks, not native Component generation
acceptance. The batch landed through [#396](https://github.com/jordanhubbard/Aviation/pull/396)
at `b59c3862052efaac74fdbd62c602a5fa9d2fef30`. All six exact-main workflows passed:
[Monorepo](https://github.com/jordanhubbard/Aviation/actions/runs/41324522685),
[SDK](https://github.com/jordanhubbard/Aviation/actions/runs/41324522531),
[Integration](https://github.com/jordanhubbard/Aviation/actions/runs/41324522534),
[Dependency Scan](https://github.com/jordanhubbard/Aviation/actions/runs/41324522532),
[Performance](https://github.com/jordanhubbard/Aviation/actions/runs/41324522682),
and [Deployment Images](https://github.com/jordanhubbard/Aviation/actions/runs/41324522721).
The forty remaining dependency PRs were then closed with their unchanged-head
comparisons and pushed supersession markers. Together with #303/#269/#245/#234,
this resolves 44 of the original 47 contributions. Original refs remain available.

### Remaining feature acceptance

PR #210 still needs implementation/review: the current G1000 adapter delegates
to common avionics, but Flight Planner's old radio adapter retains unfinished
controls, and the proposed repository fuzzy matcher is not wired by that PR.
Complete the intended ingest integration and radio behavior through tested common
SDK contracts and application adapters, preserving exact-match behavior and
checking ambiguous/invalid input. Do not reintroduce app-private avionics models.

Issue #176 requires a shared explanation client, a standard explanation endpoint
and decision control in every application, and follow-up questions through the
current brain API and model fallback. The current Accident Tracker, Chat,
Planner, and G1000 wiring is partial evidence; complete and test the application
matrix, including unavailable-service behavior and deterministic model mocks.

Issue #332 follows the [SDK remote E2E program](sdk-remote-e2e-program.md).
All twelve adapters exist. Remaining acceptance is a route-by-route inventory
completeness audit and traversal against exact deployed builds, with isolated
tagged data, external-service mocks, failure cleanup, traces, zero residuals, and
the required post-deployment gate. Public runs of older builds and local
production-image checks do not substitute for that final deployed evidence.

### Historical branch dispositions

All fourteen original branches have evidence-backed supersession dispositions.
Unique missing behavior was recovered through [#394](https://github.com/jordanhubbard/Aviation/pull/394).
The supported lifecycle state is `dead` (superseded), not an ancestry claim.
Original refs remain reachable; no branch was deleted.

| Branch | State |
| --- | --- |
| `chore/migrate-beads-to-mac` | superseded by main migration `030112e1b` |
| `dependabot/npm_and_yarn/express-rate-limit-8.3.2` | superseded by current manifest and pnpm lock |
| `feat/ai-explainer-layer` | recovered timeout and UI in #394; current backend route retained |
| `feat/aircraft-classification-ingest-stubs` | missing statistics tests recovered in #394; SDK calculations retained |
| `feat/dynamic-filter-options` | superseded by persisted distinct queries; SQLite regression added in #394 |
| `feat/sdk-aircraft-operating-profile` | original profile incorporated in `f425ab232`; extended SDK qualified |
| `mac/agent_bullwinkle/task_b3e16b5f6d9f43a69307f2827a7f6368-lease_e283b71f51ee452ab5` | superseded by current security dependency pins |
| `mac/agent_bullwinkle/task_d1b32e44832344c1b4100e1b7cccba68-lease_8170c1e1bbdc4e9691` | missing malformed-GPX test recovered in #394 |
| `mac/agent_jordanh-worker1/task_d1b32e44832344c1b4100e1b7cccba68-lease_b4fd997576404f0e83` | missing roundtrip and storage-isolation tests recovered in #394 |
| `mac/agent_natasha/task_92572af2ef6c4b9b846cc76e9d048ad8-lease_6351d80bc0384a8881` | hazard fixtures and tests preserved; normalization extends contract |
| `mac/agent_natasha/task_92572af2ef6c4b9b846cc76e9d048ad8-lease_90dd2ffd6cff4aa78f` | NOTAM tests preserved; weather consumer qualified by five tests |
| `mac/agent_natasha/task_b3e16b5f6d9f43a69307f2827a7f6368-lease_527a400ba6504ad78e` | superseded by blocking audit/integration jobs |
| `mac/agent_natasha/task_b3e16b5f6d9f43a69307f2827a7f6368-lease_a3b82db56e8445b291` | superseded by current security dependency pins |
| `mac/agent_natasha/task_b3e16b5f6d9f43a69307f2827a7f6368-lease_be65d626931a4fafa1` | superseded by current audit jobs and documented exclusions |

## Reconciled worktrees

| Branch | Finding | State |
| --- | --- | --- |
| `accident-tracker-review` | formerly dirty rpe checkout | clean; preserved at `f4279a68e87a17ef4a6baf4cd53ab04931bcaa26`, pushed `recovery/reconcile-rpe-exports` |
| `chore/openapi-docs` | formerly dirty xqe checkout | clean; preserved at `02dd415206d56e1968186d17d062f56b745f2564`, pushed `recovery/reconcile-xqe-help`; missing help landed in #394 |
| `feat/sdk-aircraft-operating-profile` | formerly unresolved sdk-autopilot checkout | clean; supported supersession marker pushed |
| `feat/sdk-nav-providers` | unowned lifecycle lock only | clean; lock moved recoverably under ignored `_build/reconciliation-recovery/`; no source edits removed |

## Reconciliation evidence recorded during recovery

The progress notes below describe the intermediate comparisons. Their pending
landing statements are superseded by the final validation record below.

Main baseline: `a427101c8849147238630bb58424d71dcb2b19d9`. All six
post-merge workflows passed, including Dependency Scan, Integration Tests, and
Common Aviation SDK. Comparisons map old application/package paths into
`components/legacy-project-wrapper/implementation`.

- Router test branch `191b0a24047695d5496247262f3572ae19965b2f` contributes
  malformed-GPX rejection. Branch `01ada9f9708ea41e8c150d40a9e9d3198844925a`
  contributes FPL round-trip and explicit store isolation. Those three missing
  cases are recovered in the current router suite; its delete-then-GET case was
  already covered by `test_delete_then_get_returns_404`. The resulting suite
  passes all 45 tests on Python 3.14.7. Landing remains pending.
- Security branches `be5c40724fab1c9b58f474cafc0e935b169af8e1` and
  `d1136bb5b52b0330d4ddedc22c8f420ef3767f52` are superseded by current
  workspace overrides: ip-address 10.7.4, ws 8.22.0, react-router and
  react-router-dom 7.18.4, and ForeFlight PyJWT 2.15.0. Their historical
  lockfile updates must not replace the current pnpm workspace lock.
- Security branches `ba08b17a37ca65cd3f43a352d0c1cacec0c1eef6` and
  `d5940f5b07bccfcb4ae43487670ba449fbf25fd4` are superseded by current
  blocking Trivy/pip-audit and integration jobs, removal of the obsolete
  Compose startup/teardown, and the setuptools upgrade before pip-audit.
  Current `.trivyignore` retains their documented exclusions. The exact main
  Dependency Scan and Integration Tests workflows pass.
- The express-rate-limit branch `d4ebdf5a662f108f96cb3a25fb1dd0d6913930dc`
  requests ^8.3.2, already declared by the current Accident Tracker backend.
  The branch's npm lockfile is superseded by the current pnpm workspace lock;
  package install and application qualification still need recording here.
- The rpe worktree's SDK export edits are present in the current barrel,
  including cache, airport, navigation, weather, datetime, and GoogleCalendar.
  Its untracked historical merge report and dirty index file are preserved.
- The xqe Makefile's help addition was missing and is recovered here. Its
  accident-tracker run target already exists in the current Makefile.
- The nav-provider worktree's only untracked path is a lifecycle lock; no
  source edits were found. Active-process inspection found no process using
  the four flagged worktrees. Lock disposition remains pending.

Next: validate the recovered changes in CI, preserve and resolve dirty worktree
state, then finish behavior and patch-equivalence checks for the remaining
feature, migration, hazard, NOTAM, dynamic-filter, and aircraft branches.

Further validated recovery:

- All 591 shared TypeScript SDK tests pass on the reconciliation tree, covering
  current aircraft, hazard, and NOTAM behavior.
- Recovered the ForeFlight branch's two missing classification-statistics tests;
  both affected suites pass (43 tests). Current calculations use the SDK while
  preserving tailwheel, complex, and high-performance totals.
- Recovered the AI-explainer branch's ten-second fetch timeout using the current
  brain-client API. All 12 explainer tests and its TypeScript build pass. The
  branch's application wiring remains unresolved.
- Preserved rpe edits and its historical merge report in commit `f4279a6` and
  xqe edits in `02dd415`, with recovery branches. Both original worktrees are
  now clean; files were committed without replacement or deletion.
- Nav-provider lifecycle lock had no open owner and was moved recoverably to
  that worktree's ignored `_build/reconciliation-recovery/` directory. Its Git
  status is now clean. No source changes were removed.
- Four superseded security-branch lifecycle markers were pushed successfully;
  original branch refs and commits remain available.

Additional comparisons:

- Aircraft profile commit `c7d778f9` was incorporated as `f425ab232` (#361).
  Current `aircraft.ts` is an extension of that contract, with the original
  airspeed limits and C172 profile plus fuel, dimensions, performance, and type
  designators. The branch's second commit requested the follow-redirects fix;
  the current lock resolves 1.16.2. All 591 SDK tests and 29 Python
  flight-dynamics conformance tests pass.
- Hazard branch fixtures are byte-for-byte equal to main. Its entire test file
  remains, with three additional fail-closed/geometry cases. Implementation
  additions are the qualified normalization/validation contract. All SDK tests pass.
- NOTAM branch tests are byte-for-byte equal to main. The public implementation
  adds qualified record validation; Weather Briefing retains the branch's NOTAM
  client, formatting, and unavailable-service fallback.
- The beads migration has a successor commit `030112e1b` on main. Current source
  contains no beads modules or reporters; live error-reporting uses MAC clients.
  GitHub and the Literate AI roadmap now own release tracking. The old branch
  and its ticket conversion remain reachable for historical recovery.
- Recovered the AI explanation control into the current event-detail UI, using
  the existing backend route. Its component cancels pending requests on close,
  isolates state by event ID, and distinguishes analysis from official findings.
  Three UI tests and the production frontend build pass.

- Dynamic filter persistence now has a direct SQLite regression test: distinct
  values are sorted, duplicates and empty values disappear, newly ingested
  countries appear, and unapproved column names cannot execute SQL. It passes.
- Five focused Weather Briefing tests pass for empty NOTAM results, severity
  ordering, provider failure, missing weather, and stop-time cache cleanup. The
  historical `service.test.ts` is obsolete (undeclared Jest and removed APIs);
  its runner failure is not counted as validation. The current service build passes.
- Six additional supersession markers were pushed for migration, express-rate-limit,
  dynamic filters, aircraft profiles, hazards, and NOTAMs. Together with the four
  security dispositions, ten of the original fourteen branch blockers are resolved.
  The two router-test branches, AI branch, and ForeFlight branch await landing of
  their recovered work through #394 and exact post-merge validation.

Browser validation of the recovered explanation control passed at 1280px and
390px: loading, successful analysis, and unavailable-service retry states all
rendered, no page errors occurred, and neither viewport had document overflow.
The narrow layout now constrains inputs, tables, and modal padding. Screenshots
were inspected from disposable validation storage. Third-party map requests were
blocked and API responses were deterministic fixtures for this UI check.

## Final branch and worktree validation

Recovered changes landed through #394 at main
`5ae9f08fbf62fb1f0f5ed3a72f4f4fd30d7dcea8`. All six workflows passed on
that exact merge commit:

- [Monorepo CI/CD](https://github.com/jordanhubbard/Aviation/actions/runs/41277329831)
- [Common Aviation SDK](https://github.com/jordanhubbard/Aviation/actions/runs/41277329855)
- [Integration Tests](https://github.com/jordanhubbard/Aviation/actions/runs/41277330076)
- [Dependency Scan](https://github.com/jordanhubbard/Aviation/actions/runs/41277330024)
- [Performance Regression Check](https://github.com/jordanhubbard/Aviation/actions/runs/41277329953)
- [Deployment Images](https://github.com/jordanhubbard/Aviation/actions/runs/41277329863)

The full retained test harness passed before landing, and `litai verify` passed
on merged main: authority, 19 committed locks, and the current committed test
receipt. Finalized receipt identity:
`sha256:88154a449b13e51a781d801f17b316e69e99130c9ad2ffb9e664e8b25bab3c49`.

Supported supersession markers were pushed for all fourteen original branches.
The rpe/xqe historical branches and both preservation refs also carry explicit
dispositions. All four original worktrees are clean, and their preserved state
remains reachable. No historical worktree or branch was deleted.

This completes the fourteen-branch/four-worktree reconciliation. RELEASE-001
remains open: the tracker contributions above still require reconciliation and
a fresh release contribution sweep before 1.0.0 can be published.
