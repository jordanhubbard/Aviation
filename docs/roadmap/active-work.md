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
- **Next action:** Produce the evidence-linked boundary inventory for
  `components/legacy-project-wrapper/implementation`.
- **Evidence:** Phase 1.2 lift-and-shift identity `sha256:c5ca4361ba010f6e8d81c93398468f9f4f8b8cc352504bc8535fa74b7c6e9990`.

### [ ] ADOPT-003 — Preserve Aviation interfaces and integrate flight analyzer

- **Priority:** P0
- **Owner:** components/legacy-project-wrapper and flight-analyzer
- **Direction:** Keep existing Aviation functionality after Literate AI adoption and merge the KML flight analyzer with airport MSL elevation access.
- **Conclusion:** The CLI lift-and-shift preserved retained source and wrapper parity but moved the old workspace paths and workflows below the retained Component. Restore compatible entrypoints, then add the analyzer as an Aviation application and use the existing bundled airport dataset as optional corroborating touchdown evidence.
- **Depends on:** ADOPT-002 retained source boundary; KMLab FLIGHT-002
- **Implementation:**
  - [ ] Restore root workspace and CI entrypoints against the retained implementation
  - [ ] Integrate KMLab source, API, UI, tests, and runtime paths as an Aviation app
  - [ ] Add airport identity and MSL elevation to landing analysis with bias, missing-data, and proximity safeguards
- **Evidence:**
  - [ ] Literate AI project validate and verify pass
  - [ ] Existing Aviation app tests and all 54 KMLab tests pass in the merged tree
  - [ ] Synthetic touchdown tests exercise airport elevation, GPS bias, touch-and-go, and go-around
  - [ ] Hosted CI confirms retained apps and new analyzer after push
