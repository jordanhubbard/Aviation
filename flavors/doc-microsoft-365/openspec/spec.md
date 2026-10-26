# Microsoft 365 documentation Flavor

### Requirement: Microsoft 365 is the collaboration surface

When `documentation.ecosystem=microsoft-365` is selected, presentations SHALL use
PowerPoint and technical documents SHALL use Word. The project SHALL keep the editable
artifact and regeneration package, and MAY publish through SharePoint or OneDrive when
the user authorizes those services. It SHALL NOT store credentials or access tokens.

#### Scenario: An authorized artifact is published

- **WHEN** a user requests publication and authorizes Microsoft 365
- **THEN** the editable PowerPoint or Word artifact is published through the available
  SharePoint or OneDrive surface
- **AND** its link is recorded without changing claims, audience, evidence, or approval
  state
- **AND** publication is not represented as build, execution, release, or content
  approval
