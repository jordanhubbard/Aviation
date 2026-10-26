# repo.sh / packman build-system Flavor

### Requirement: repo-man is a removable build-system preference

When `build.system=repo-man` is selected, conversion and generation MUST treat a
recorded platform `build.sh` / `build.bat` wrapper as the operator-facing build
entrypoint when present, and otherwise use the recorded `repo.sh` / `repo.bat`
driver. This is a strong default preference, not permission to invent packman or
premake commands. Explicit Component requirements and other selected Flavor
requirements take precedence. Removing the Flavor with the ordered `-repo-man`
selector removes both this fragment and its exact build skill before the generation
recipe is formed.

#### Scenario: Default applies without an override

- **WHEN** the Component declares a compatible build-system slot
- **AND** the project default selects `+repo-man`
- **AND** no later selector removes or replaces it
- **THEN** the exact generation recipe includes the repo-man Flavor and build skill

#### Scenario: Explicit subtraction removes the default

- **WHEN** a later selector is `-repo-man`
- **THEN** the generation recipe contains neither the repo-man Flavor fragment nor its
  build skill

### Requirement: Only recorded repo_man build entrypoints may be invoked

Wrappers and generated recipes MUST invoke only build commands recorded in
`.literate/harness-inventory.json` (or an equivalent convert inventory). A recorded
platform build wrapper takes precedence over its lower-level repo_man driver. They
MUST NOT invent `repo.sh` subcommands, packman URLs, or premake flags.

#### Scenario: Converted wrapper delegates to recorded roots

- **WHEN** convert detected repo_man roots at `kit` and `rendering`
- **THEN** `litai.harness.mk` exposes one target per recorded root
- **AND** each target runs that root's exact recorded build command

#### Scenario: Root build covers automatic nested qualification

- **WHEN** convert records an undotted root `build` stage and nested repo_man
  `build.*` stages
- **THEN** automatic baseline, wrapper parity, and retained receipt execution run the
  root stage and record the nested stages as covered by it
- **AND** `litai.harness.mk` keeps every nested stage manually callable
- **WHEN** no undotted root `build` stage is recorded
- **THEN** automatic qualification executes each recorded nested build stage
