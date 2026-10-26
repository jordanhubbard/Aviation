# Microsoft 365 document-pair binding

This fragment binds `literate-ai.document-pair` to the `microsoft-365` target. It
decides format, collaboration surface, access vocabulary, and the concrete formatting
mapping. It decides nothing about content, claims, audience, or approval state.

## Member mapping

| Pair member | Realized artifact | Collaboration surface |
| --- | --- | --- |
| `narrative` | Word `.docx` | SharePoint document library or OneDrive |
| `presentation` | PowerPoint `.pptx` | SharePoint document library or OneDrive |

The editable artifact is the artifact. Unlike an import-based ecosystem, the local export
and the published file are the same format, so publication SHALL preserve native objects
by construction and SHALL NOT flatten, re-render, or downgrade them.

## Access mapping

| Interface `access.audience` | SharePoint or OneDrive sharing state |
| --- | --- |
| `private` | owner only |
| `named-principals` | specific-people links, per-principal |
| `organization` | people-in-your-organization link |
| `public` | anyone link, only where tenant policy permits it |

`permission` maps to `view`, `review`, and `edit` link types. When `link_sharing` is
false, no anonymous-access link SHALL exist. Where tenant policy forbids an audience the
consumer declared, the provider SHALL fail closed and leave the member unpublished
rather than silently narrowing or widening the grant. Access tokens and refresh material
SHALL NOT be written into the repository, the authoring package, or the manifest.

## Publication prerequisites and authentication

Local Word and PowerPoint realization requires no Microsoft service and no proprietary
MCP. SharePoint or OneDrive publication is a separate, explicitly authorized operation.

1. Prefer an already configured SharePoint or OneDrive connector. Otherwise detect an
   installed Microsoft Graph-capable CLI or client that can upload the exact file and
   inspect its sharing state; no particular agent connector is mandatory.
2. If no supported client is present, stop with the project's declared client and
   official installation guidance, or ask permission to install it into operator-managed
   storage. Detect before installing and never create an application registration,
   tenant consent grant, or global package installation implicitly.
3. Preflight authentication without uploading. If the account or token is absent or
   expired, request interactive device-code/browser login. A remote non-interactive
   worker must stop and report the required login or environment-provided credential;
   it must not wait for an interaction it cannot relay.
4. Keep access and refresh tokens out of repositories, artifacts, manifests, logs, and
   command transcripts. Never widen the declared audience to make publication succeed.
5. Upload to the user-authorized SharePoint library, OneDrive location, or exact existing
   item; then download it and inspect the realized access grant, editable objects, slide
   or page count, visible text, and notes before recording `published_location`.

## Formatting mapping

- Surface geometry is the PowerPoint slide size. Every shape, textbox, image, and
  connector SHALL fall inside it.
- Text-bearing frames SHALL NOT overlap. Geometry-escape does not detect painted
  overflow or colliding titles.
- Body copy SHALL live in the owning shape's text frame as real paragraphs rather than
  as a second text box overlaid on a filled cell.
- Workflow pages SHALL be picture-led: a diagram or text-free image plus short labels.
  Native-shape diagrams count as pictures. Rasterizing a specification excerpt or
  control-model diagram to hide the mechanism is a contract violation.
- Per-page notes map to the PowerPoint notes slide. Every slide SHALL have one and it
  SHALL be non-empty.
- Narrative heading levels map to the Word built-in `Heading 1` through `Heading 6`
  styles without skipping a level. Direct character formatting SHALL NOT substitute for
  a heading style.
- Text SHALL remain text. Rasterized type is a contract violation.

### Requirement: Microsoft 365 realizes the document pair

When `documentation.ecosystem=microsoft-365` is selected, the `presentation` member SHALL
be realized as PowerPoint and the `narrative` member as Word, each published through
SharePoint or OneDrive when authorized, with a recorded access record.

#### Scenario: Tenant policy forbids the declared audience

- **WHEN** a consumer declares `audience: public` and tenant policy forbids anonymous
  links
- **THEN** the member remains unpublished, `published_location` is null, and the refusal
  is recorded rather than resolved by narrowing the grant silently
