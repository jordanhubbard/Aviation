# Google Workspace document-pair binding

This fragment binds `literate-ai.document-pair` to the `google-workspace` target. It
decides format, collaboration surface, access vocabulary, and the concrete formatting
mapping. It decides nothing about content, claims, audience, or approval state.

## Member mapping

| Pair member | Realized artifact | Editable local export |
| --- | --- | --- |
| `narrative` | Google Doc | `.docx` retained under the project output convention |
| `presentation` | Google Slides | `.pptx` retained under the project output convention |

A Slides presentation SHALL be created by importing the verified local export as native
Slides objects. Uploading a rendered image per page is a contract violation, because it
destroys the editable native objects the interface requires.

## Access mapping

| Interface `access.audience` | Google Drive sharing state |
| --- | --- |
| `private` | owner only |
| `named-principals` | explicit per-principal grants, link sharing off |
| `organization` | domain-restricted link |
| `public` | anyone with the link |

`permission` maps to the Drive roles `reader`, `commenter`, and `writer`. When
`link_sharing` is false, the artifact SHALL NOT carry an `anyone-with-link` grant. OAuth
tokens and refresh material SHALL NOT be written into the repository, the authoring
package, or the capability manifest.

## Publication prerequisites and authentication

Local `.docx` and `.pptx` realization does not require Google services, a Google MCP, or
`gcloud`. Publication is a separate, explicitly authorized operation.

1. Prefer an already configured Google Workspace connector when it can update the exact
   supplied resource and export it for verification. Otherwise detect `gcloud` on `PATH`.
2. If `gcloud` is absent, stop with the official Google Cloud CLI installation guidance
   for the host, or ask permission to install it through that host's package manager.
   Detect before installing and never perform an unconditional or global installation.
3. Immediately before publication, run `gcloud auth print-access-token`. If it reports no
   active account, tell an interactive user to complete `gcloud auth login`; on a remote
   non-interactive worker, stop and report login as a host prerequisite. If Drive rejects
   the token's scope or the principal lacks access, report that distinction explicitly.
4. Keep the token only in process memory and pass it only as the bearer header of the
   Google API request. Never print it, persist it, place it in a command transcript, or
   add it to an artifact manifest.
5. A supplied Docs or Slides URL names the exact resource to update in place unless the
   user explicitly requests a copy. Export or read the updated resource back and compare
   page count, visible text, speaker notes, and the access record with the accepted local
   artifact before recording `published_location`.

## Formatting mapping

- Surface geometry is the Slides page size. Every element's bounding box SHALL fall
  inside it.
- Text-bearing frames SHALL NOT overlap. Geometry-escape does not detect painted
  overflow or colliding titles.
- Size boxes for Google Arial substitution, not only the authoring face (Helvetica Neue
  is narrower than Arial). After an authorized in-place update, read the published
  Slides copy; wrap introduced by substitution fails even when the local PPTX did not.
- Body copy SHALL live in the owning shape's text frame as real paragraphs. A newline
  character inside one paragraph is not a line break after import. Overlaying a second
  text box on a filled cell for that cell's copy is a layout defect.
- Workflow pages SHALL be picture-led: a diagram or text-free image plus short labels.
  Native-shape diagrams count as pictures. Rasterizing a specification excerpt or
  control-model diagram to hide the mechanism is a contract violation.
- Per-page notes map to the Slides speaker-notes placeholder. Every page SHALL have one
  and it SHALL be non-empty.
- Narrative heading levels map to the Docs `HEADING_1` through `HEADING_6` named styles
  without skipping a level.
- Text SHALL remain text. Rasterized type is a contract violation.

### Requirement: Google Workspace realizes the document pair

When `documentation.ecosystem=google-workspace` is selected, the `presentation` member
SHALL be realized as Google Slides and the `narrative` member as a Google Doc, each with
a retained editable local export and a recorded access record.

#### Scenario: A deck is imported as native Slides

- **WHEN** a verified local presentation export is published to Google Workspace
- **THEN** it is imported as native Slides objects with its per-page notes preserved
- **AND** its link and resolved access record are written to the capability manifest
- **AND** no credential material is retained
