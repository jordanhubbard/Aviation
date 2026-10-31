# Portable CPU accelerator Flavor

### Requirement: CPU-only execution

When `accelerator=cpu` is selected, the generated application SHALL perform its work
with the selected language's standard CPU facilities and require no accelerator SDK,
driver, device, or vendor-specific runtime.

#### Scenario: CPU application executes

- **WHEN** the CPU Flavor is composed with one OS and one implementation-language Flavor
- **THEN** the application builds and runs using only the host toolchains required by those Flavors
