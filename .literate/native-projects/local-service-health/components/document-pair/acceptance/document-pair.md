# Document pair acceptance contract

These checks are mechanical. An independent acceptance oracle evaluates them against the
realized pair and its authoring package, without consulting the generating model.

## Requirement: The manifest resolves

### Scenario: Manifest is complete and well-formed

- **WHEN** `LITAI_CAPABILITY_DOCUMENT_PAIR` is resolved
- **THEN** the manifest parses as UTF-8 JSON, names exactly one `ecosystem`, realizes at
  least one member, and every realized member's `local_artifact` exists and is readable

### Scenario: No credential material is present

- **WHEN** the manifest and every retained QA artifact are scanned
- **THEN** no access token, refresh token, client secret, or bearer credential appears

## Requirement: Access matches the declared audience

### Scenario: Audience is not widened

- **WHEN** a realized member's `access.audience` is compared against the audience the
  consuming Component declared
- **THEN** the realized audience is equal to or narrower than the declared audience

### Scenario: Unauthorized publication does not occur

- **WHEN** no explicit publication authorization was supplied
- **THEN** every member's `published_location` is null and only local artifacts exist

## Requirement: The presentation member satisfies the geometry contract

### Scenario: No element escapes the surface

- **WHEN** every page's exported layout is scanned against the declared surface geometry
- **THEN** zero elements have a bounding box extending outside that surface

### Scenario: Text-bearing frames do not overlap

- **WHEN** every page's text-bearing frames are scanned pairwise
- **THEN** zero pairs have overlapping bounding boxes

### Scenario: Every page carries notes

- **WHEN** the exported presentation is inspected
- **THEN** the count of note surfaces equals the count of pages, and none is empty

## Requirement: The narrative member satisfies the structure contract

### Scenario: Heading levels do not skip

- **WHEN** the narrative member's heading hierarchy is walked in document order
- **THEN** no heading is more than one level deeper than its predecessor

## Requirement: The authoring package reproduces the artifact

### Scenario: Every required package element is present

- **WHEN** the `authoring_package` directory is inspected
- **THEN** the narrative specification, factual ledger, generation prompts, build source,
  assets, regeneration entry point, deliverable links, and QA record are all present

### Scenario: No unresolved placeholder ships

- **WHEN** the text of every realized member is scanned
- **THEN** no placeholder token remains unresolved
