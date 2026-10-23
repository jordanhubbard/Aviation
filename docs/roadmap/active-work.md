# Active work

This file is the durable resumption queue for user-directed and discovered work. Before
implementation, follow `skills/agent/record-user-directed-work/SKILL.md`.
Keep detailed designs in focused roadmap documents and link them here.

## Detailed-roadmap lifecycle

This file is the sole resumable queue. Create a supporting file beneath `docs/roadmap/`
only when one item cannot keep a program's rationale, ordering, and acceptance contract
readable. Put this visible header immediately after the detailed document's title:

```markdown
- **Status:** active
- **Owning queue item:** [AREA-NNN](active-work.md#area-nnn-heading)
- **Completion / archival evidence:** pending while AREA-NNN remains open
```

Status is exactly `active`, `partial`, `deferred`, `completed`, or `historical`. The
owner must resolve to a checkbox or named program heading in this file. A terminal state
requires linked evidence. Keep a completed plan here only when doing so preserves useful
inbound links; move substantial closed programs beneath `docs/history/roadmap/`, retain
their owner, and mark them `historical`. Do not create a separate file for an ordinary
queue item or let `docs/roadmap/` become a plan archive.

## P0

### [ ] ONBOARD-001 — Replace this starter item with the first project outcome

- **Owner:** project core
- **Direction:** Record the user's desired outcome without copying conversation noise.
- **Conclusion:** State the evidence-backed implementation boundary.
- **Depends on:** none
- **Implementation:**
  - [ ] Name the next concrete change.
- **Evidence:**
  - [ ] Name the build, test, execution, or review proof required for completion.

Check the parent only after every required subtask and evidence item passes. Add the
release-visible outcome to `CHANGELOG.md`; Git preserves prior queue states.

<a id="adopt-002"></a>
### [ ] ADOPT-002 — Native Literate AI rewrite

- **Owner:** project architecture / Components / Flavors / skills / assets
- **Direction:** Execute
  [ADR 0002](../decisions/0002-native-literate-ai-rewrite.md) through the
  [native rewrite program](native-rewrite-program.md), preserving retained source
  authority until each boundary independently qualifies.
- **Next action:** Complete the public contract and file-by-file classification
  of the initial map in `docs/roadmap/native-boundary-inventory.md` before
  selecting the first native boundary.
- **Evidence:** Phase 1.2 lift-and-shift identity `sha256:c5ca4361ba010f6e8d81c93398468f9f4f8b8cc352504bc8535fa74b7c6e9990`.
  Retained conversion stage is backed by current test receipt
  `sha256:60e252aceb5834018a21d3ec5a75b667c564e207ea3cf02d475b3245640c3c79`;
  original source remains release authority.

### [x] ADOPT-003 — Preserve Aviation interfaces and integrate flight analyzer

- **Priority:** P0
- **Owner:** components/legacy-project-wrapper and flight-analyzer
- **Direction:** Keep existing Aviation functionality after Literate AI adoption and merge the KML flight analyzer with airport MSL elevation access.
- **Conclusion:** The CLI lift-and-shift preserved retained source and wrapper parity but moved the old workspace paths and workflows below the retained Component. Restore compatible entrypoints, then add the analyzer as an Aviation application and use the existing bundled airport dataset as optional corroborating touchdown evidence.
- **Depends on:** ADOPT-002 retained source boundary; KMLab FLIGHT-002
- **Implementation:**
  - [x] Restore root workspace and CI entrypoints against the retained implementation (root symlinks, Make wrapper, and GitHub workflows)
  - [x] Integrate KMLab source, API, UI, tests, and runtime paths as an Aviation app (`apps/flight-track-analyzer`)
  - [x] Add airport identity and MSL elevation to landing analysis with bias, missing-data, and proximity safeguards (61 analyzer tests)
- **Evidence:**
  - [x] Literate AI project validate and verify pass (authority, two locks, current retained receipt at 4646278fb)
  - [x] Existing Aviation app tests and all 54 KMLab tests pass in the merged tree (`make test`: 13 Node suites, Go, 61 analyzer tests)
  - [x] Synthetic touchdown tests exercise airport elevation, GPS bias, touch-and-go, and go-around (`app/tests/test_airports.py`)
  - [x] Hosted CI confirms retained apps and new analyzer after push (PR #304, a5fa6fa9d: 19 checks passed, Dependabot skipped)

### [x] ADOPT-004 — Repair retained deployment workflow after conversion

- **Priority:** P0
- **Owner:** workflows/deploy.yml
- **Direction:** Restore the main-branch deployment dry run after the Literate AI source relocation.
- **Conclusion:** The job-level working directory is unavailable before checkout, and Docker builds must use the real retained implementation as context so workspace COPY instructions see actual files.
- **Depends on:** ADOPT-003 merged adoption
- **Implementation:**
  - [x] Remove the unnecessary workflow-wide working directory and point Docker actions at the retained implementation (`.github/workflows/deploy.yml` in PR #305).
- **Evidence:**
  - [x] Workflow YAML parses, PR #305 passed 19 checks, and exact main run 39905597056 built four images and passed the staging dry run at c8b958a34.
