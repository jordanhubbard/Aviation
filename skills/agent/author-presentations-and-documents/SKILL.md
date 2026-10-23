---
name: author-presentations-and-documents
description: Create, revise, and regenerate evidence-backed slide decks and technical documents from a Literate-AI project's current authority. Use when a user asks for PowerPoint, Google Slides, Word, Google Docs, an architecture or roadmap document, an executive narrative, or another polished project artifact that must stay synchronized with specifications and code.
metadata:
  author: Literate AI maintainers <literate-ai-maintainers@users.noreply.github.com>
---

# Author presentations and documents

Create project artifacts from current authority, not from memory or stale marketing copy.

## Workflow

1. Read the root `AGENTS.md`, root `SKILL.md`, and declared documentation spine.
2. Define the communication job: audience, decision or understanding required, central
   takeaway, output format, publication target, and source constraints. Honor the
   user's explicit ecosystem preference first. Otherwise use a selected
   `documentation.ecosystem` Flavor when one is declared. If neither decides the
   destination, retain an editable local artifact and ask only when publishing matters.
3. Separate current behavior, current limitations, near-term investment, and long-term
   direction. Never present a roadmap outcome as implemented or invent metrics.
4. Every project's user-facing documentation must establish the project's own identity
   before describing the framework that built it. The getting-started document must open
   with what this project is, what problem it solves, and how a user installs and
   operates it — not with Literate AI framework commands. Framework workflow belongs in
   a clearly separated "Development workflow" or "Contributing" section. Parent-inherited
   documentation is a fallback for topics the child has not yet documented, not a
   substitute for project identity. A getting-started page that is still the unmodified
   parent template does not count as documented.
5. When documenting an installable application or service, make the user path operational,
   not merely buildable. The getting-started path must identify supported prerequisites,
   the exact released or generated artifacts to obtain, installation destination,
   configuration files and required values, secret injection without example credentials,
   persistence and network assumptions, startup order, health/readiness checks, one
   representative successful request, expected result, upgrade/rollback boundary, and
   uninstall or cleanup. Distinguish contributor generation/build commands from end-user
   installation. If packaging, service registration, configuration schema, or a stable
   install command does not exist, state that limitation prominently and link the active
   work that owns it; never substitute an internal smoke harness or `litai rebuild` for an
   installable product workflow.
6. Separate each consequential claim from the mechanism that makes it true, and carry
   both. A claim asserts an outcome; a mechanism names the artifacts, identities, rules,
   and ordering that produce it. An artifact whose every page states outcomes reads as
   promotion regardless of how accurate it is.
7. Use a dedicated presentation or document capability when available, but never make a
   proprietary MCP, connector, or one user's installed agent plugin a hidden requirement.
   Otherwise use a declared project-local toolchain such as Node with a presentation or
   document library, or Python with an OOXML library. Keep its package manifest and lock
   with the authoring package; install only into an ignored environment under `OBJ_DIR`
   after the user authorizes installation. Preserve editable native objects and use
   generated imagery only when it materially improves the explanation.
8. Create a durable authoring package beneath the project's declared documentation roots
   or its documented artifact convention. Preserve the narrative specification, factual
   source ledger, generation prompts, build source, owned assets, regeneration entry
   point, current deliverable links, and QA record needed to reproduce the artifact.
9. Run `litai document verify --manifest FILE --component FILE`; Python owns the
   deterministic OOXML, manifest, access, credential, geometry, notes, and placeholder
   checks. Then render every slide or page. Inspect the complete contact sheet plus dense or
   image-led pages at full size. Fix unintended overlap, clipping, overflow, broken
   connectors, unreadable type, unresolved placeholders, and unsupported claims.
   Follow "Layout that survives publication" — geometry-escape is not this pass.
9. Run the content review in "Review depth before layout" before treating the artifact
   as complete, and record its result in the QA record alongside the visual findings.
10. Export the local editable artifact beneath the project's output convention. A local
   artifact and reproducible package are the portable baseline. If a selected
   `documentation.ecosystem` Flavor requests publication, read that Flavor's complete
   binding before touching a service. The binding owns tool discovery, optional
   installation, authentication, update semantics, access mapping, and read-back
   verification. Publish only when the user authorizes the exact destination; record its
   link without embedding credentials.
11. Before publishing a declared document pair, preflight both destination resources
    without mutation. Resolve the explicitly intended account, verify that it is the
    active provider account, verify both exact stable resource IDs and their edit/export/
    sharing capabilities, and only then update either member. If `gcloud` has no active
    account, give the operator the concrete `gcloud auth login ACCOUNT` and `gcloud
    config set account ACCOUNT` recovery; never guess or silently select an account.
12. Write an idempotent publication receipt after each member. Bind the artifact release,
    source revision and hashes, provider account, stable resource IDs, access mapping,
    update result, and exported read-back hashes. On partial failure, retain the receipt
    and resume only the missing member after repeating the complete preflight. A pair is
    not published merely because the first member or its local export succeeded.

## Layout that survives publication

A bounding-box-inside-the-surface scan (geometry-escape) is necessary and not
sufficient. Two-line titles that paint into subtitles, section tags that collide with a
brand pill, and captions that collide with the footer all fail even when every element
sits inside the declared surface.

- Size text boxes for the destination's substituted fonts, not only the authoring face.
  Google Slides substitutes Arial for Helvetica Neue; Arial is wider and wraps earlier.
- Put a cell's copy in that shape's text frame as real paragraphs. A newline character
  inside one paragraph is not a line break after Google import. Do not overlay a second
  text box on a filled cell for that cell's copy.
- Reserve a title band and a footer band so titles, tags, body, and the footer cannot
  share the same vertical range. Auto-fit is a backstop, not a substitute for a box
  that is too small.
- Workflow pages are picture-led: a diagram or text-free image plus short labels. A
  paragraph that restates the flow is the defect, not a caption. Native-shape diagrams
  count as pictures; do not replace a real specification excerpt or control-model
  diagram with decorative raster that hides the mechanism.
- Run the document-pair geometry contract, including the text-bearing-frame overlap
  scan. A clean geometry-escape result is not an overflow pass. Record visual
  inspection of the contact sheet and full-size pages in the QA record.
- After publishing to Google Slides, read the published copy. Font substitution can
  introduce overlaps the local PPTX did not show.

## Publishing to Google Workspace or Microsoft 365: consider the document pair

When the destination is a Google Workspace or Microsoft 365 `documentation.ecosystem`
Flavor, and the consuming Component declares (or should declare) the
`literate-ai.document-pair` capability from `components/document-pair/`, do not assume a
single artifact is sufficient. That capability's interface
(`components/document-pair/interfaces/document-pair.md`) recognizes two independently
selectable members — `presentation` (Google Slides / PowerPoint) and `narrative` (Google
Doc / Word) — and requires both to be realized whenever a consuming Component declares
both.

- A presentation and a narrative answer different needs even for the same audience: the
  presentation is a succinct, claim-led argument; the narrative is the comprehensive,
  multi-page technical account the same claims trace back to. Prefer generating both
  over stretching one artifact to serve both jobs, unless the Component's declared
  realization names only one member.
- Both members share one factual ledger and one publication-authorization gate. A change
  to the ledger can invalidate either artifact independently of which authoring source
  was edited — re-verify both, not only the one that was directly touched.
- Both destinations must pass a read-only preflight before either is mutated. Stable
  resources are updated in place unless the user explicitly authorizes a copy; a missing
  or inaccessible second member blocks the pair before the first update begins.
- Once published, cite both resulting links from the authoring package's `README.md`,
  near the top, so they stay easy to find. Do not bury a link only inside a QA record or
  a deliverables appendix.
- A provider SHALL NOT widen the declared access audience beyond what the Component
  declares, for either member; narrowing is always permitted.

## Keep the portable baseline honest

- No MCP is mandatory. A connector may accelerate publication, but the authoring package
  must remain reproducible without that connector.
- Detect required format libraries, fonts, and renderers before authoring. Prefer existing
  `PATH` tools. If a required tool is absent, either request authorization for a
  project-local installation or return the exact missing prerequisite and installation or
  login action. Never silently weaken native-object, notes, geometry, or visual-QA gates.
- Keep package closure isolated beneath `OBJ_DIR`; never place `node_modules`, virtual
  environments, rendered pages, or office-conversion state in the repository source tree.
- A missing renderer may block visual acceptance even when structural OOXML checks pass.
  Report that distinction explicitly rather than claiming completion.

## Carry mechanism, not only claim

- Show the durable authority itself at least once. An artifact arguing that a readable
  specification is the product must display a real specification excerpt. An artifact
  arguing that evidence ships with the result must display a real receipt, plan, diff,
  inventory, or command transcript. Never argue for readable intent without showing it.
- Prefer the rule with its consequences over the adjective. "Exact" and "governed" are
  assertions; the identities a key binds, the identities it deliberately refuses to bind,
  and the invalidation blast radius that follows are the evidence.
- Cover the negative path. An artifact that only renders the success sequence invites the
  reader's first objection and answers none of it. Show what happens when a gate fails,
  what is invalidated, what is retained, and what must run again.
- Answer cost and containment when the audience owns budget or risk. Concurrency bounds,
  budget decisions, reuse predicates, and the boundary material never crosses are
  routinely the first questions asked and the last topics authored.
- Spend page budget on distinct ideas. Restating one lifecycle in several visual forms
  consumes the room that unaddressed subjects need; a depth deficit and a breadth deficit
  are usually the same missing pages.
- When one artifact serves both a decision audience and an implementing audience, keep a
  claim-led main sequence and carry the supporting mechanism in a clearly separated
  annex, appendix, or reference section rather than diluting either.

## Carry the boundaries into the artifact

- Author speaker notes or equivalent per-page prose for every page. State the supporting
  authority, the limits recorded in the factual ledger, and what the page does not claim.
- Assume the artifact will be forwarded without its author. A caveat that survives only
  in the authoring package or in live narration is not carried by the artifact.
- Keep the ledger and the notes consistent. When a boundary changes in the ledger, update
  every page whose notes depend on it.

## Review depth before layout

Answer these before the artifact is complete. Record each answer in the QA record.

- Could a skeptical practitioner in the audience reconstruct how the system works from
  this artifact alone, or only that its authors believe it works?
- Which pages state a mechanism, and which only assert an outcome? Report the ratio.
- Is the project's central subject shown as a concrete artifact anywhere?
- Which pages restate an idea another page already made? Justify or remove each.
- Which questions this audience will certainly ask go unanswered?
- For an installable service, can a user who does not contribute to the repository install,
  configure, start, verify, upgrade or roll back, and remove it without consulting build
  logs, generated-source paths, or private maintainer knowledge?
- Does every quantified figure trace to the factual ledger, and does every figure
  presented as measured actually measure the property under discussion?

## Preserve project boundaries

- Treat presentations and technical documents as maintained documentation artifacts, not
  Component source and not generation-prompt authority.
- Keep generated previews, layout JSON, temporary conversions, and access tokens outside
  the repository.
- Preserve user-owned templates, branding, and unrelated working-tree changes.
- Link every consequential claim to a specification, current implementation, retained
  evidence, or an explicitly labeled future assumption.
- A polished artifact cannot grant build, execution, publication, or release authority.
- Documentation Flavors choose an artifact ecosystem, not content authority. Do not
  silently rewrite claims, audience, or approval state while converting formats.
