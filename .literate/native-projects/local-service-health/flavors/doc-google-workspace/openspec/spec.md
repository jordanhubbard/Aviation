# Google Workspace documentation Flavor

### Requirement: Google Workspace is the collaboration surface

When `documentation.ecosystem=google-workspace` is selected, presentations SHALL target
Google Slides and technical documents SHALL target Google Docs when the user authorizes
those services. The project SHALL preserve a reproducible local editable source or
regeneration package and SHALL NOT store credentials or access tokens.

#### Scenario: An authorized artifact is published

- **WHEN** a user requests publication and authorizes Google Workspace
- **THEN** the artifact is published to the corresponding Google service
- **AND** its link is recorded without changing claims, audience, evidence, or approval
  state
- **AND** publication is not represented as build, execution, release, or content
  approval
