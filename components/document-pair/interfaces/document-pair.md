# Ecosystem Document Pair Capability 1.0

This contract is ecosystem-neutral. It defines the public surface every documentation
artifact set exposes to its consumers and to the reviewers who must access it.

A realized provider SHALL produce a **document pair** for exactly one selected
`documentation.ecosystem` target. The pair has two independently selectable members:

| Member | Google Workspace target | Microsoft 365 target |
| --- | --- | --- |
| `narrative` | Google Doc | Word document hosted on SharePoint or OneDrive |
| `presentation` | Google Slides | PowerPoint deck hosted on SharePoint or OneDrive |

At least one member SHALL be realized. Both SHALL be realized when the consuming
Component declares both. A pair whose members are realized in different ecosystems is
invalid.

## Public surface

The provider SHALL expose the realized pair through the
`LITAI_CAPABILITY_DOCUMENT_PAIR` environment variable. The value is an absolute path to
a UTF-8 JSON manifest containing exactly:

- `ecosystem` — the selected `documentation.ecosystem` target value;
- `members` — an object with optional `narrative` and `presentation` keys, each an
  object with `local_artifact` (absolute path to the editable local export),
  `published_location` (the ecosystem URL, or `null` when unpublished), and
  `access` (the resolved access record defined below); and
- `authoring_package` — an absolute path to the durable authoring package directory.

Consumers SHALL read this manifest and SHALL NOT import, copy, or depend on private
provider layout, build scripts, intermediate renders, or asset sources.

## Access requirements

Access is part of the contract, not a deployment detail. Every realized member SHALL
carry an `access` record with:

- `audience` — one of `private`, `named-principals`, `organization`, or `public`;
- `principals` — the explicitly granted identities when `audience` is
  `named-principals`, otherwise an empty array;
- `permission` — one of `view`, `comment`, or `edit`; and
- `link_sharing` — whether an unauthenticated link resolves the artifact.

A provider SHALL NOT widen `audience` beyond the value the consuming Component
declares. Publication to any external destination requires explicit authorization from
the requesting principal; an unauthorized provider SHALL leave `published_location`
null and realize the local member only. A manifest SHALL NOT embed credentials, tokens,
or refresh material.

## General formatting requirements

These apply to both ecosystems. Ecosystem Flavors contribute the concrete mapping.

- A presentation member SHALL declare an exact surface geometry and SHALL contain no
  element whose bounding box falls outside it.
- A presentation member SHALL contain no pair of text-bearing frames whose bounding
  boxes overlap. Geometry-escape does not detect painted overflow or colliding titles.
- A presentation member SHALL carry per-page speaker notes for every page.
- A narrative member SHALL carry a heading hierarchy with no skipped levels.
- Both members SHALL preserve editable native objects. Rasterizing text into an image
  to satisfy a layout constraint is a contract violation.
- Both members SHALL resolve every placeholder. No page may ship an unresolved token.
- Every consequential claim SHALL trace to the authoring package's factual ledger.

## Authoring package

A realized provider SHALL retain a durable authoring package containing the narrative
specification, the factual source ledger, the generation prompts, the build source, the
owned assets, the regeneration entry point, the current deliverable links, and the QA
record. The package is the reproduction surface; the exported artifacts are projections
of it.

## Terminal consumers

A consuming Component MAY declare itself terminal by providing no capability of its
own. A terminal document Component is project-specific: it cannot be inherited,
forked, or composed into another project's graph. It remains citable by its Component
URI, and its published locations remain linkable. Providers SHALL NOT treat a terminal
consumer's content as a reusable template.
