# Qualified legacy build harness

### Requirement: Delegate only to qualified commands

The wrapper SHALL invoke only commands recorded by Phase 1 analysis and SHALL compare
their resulting tree identities with the direct baseline before adoption proceeds.

#### Scenario: Wrapper parity is established

- **WHEN** all available wrapper stages complete
- **THEN** every stage has exact successful parity evidence
