# Mix build-system Flavor

### Requirement: Mix uses declarative dependency authority

Generated Elixir source MUST contain one `source/mix-project.json` using
`literate-ai/mix-project@1`. It MUST NOT contain `mix.exs`, `mix.lock`, or
`.iex.exs`. The authorized lifecycle SHALL synthesize the executable project
and render its checksummed public Hex dependency lock outside admitted source
from exact source BOM pins (version, outer and inner checksums, requirements).

#### Scenario: Build a locked Hex graph

- **WHEN** an Elixir Component selects the Mix build-system Flavor
- **THEN** the lifecycle refuses Hex packages the source BOM does not pin exactly
- **AND** fetches with its bound Hex plugin only against the rendered admitted lock
- **AND** requires the acquired lock and archive checksums to equal those pins before compilation
- **AND** compiles only dependency bytes re-extracted from the verified archives
- **AND** runs native compilation with all output beneath the external object root
- **AND** rejects source mutation, changed tools, or mismatched dependency evidence

### Requirement: Retained packages preserve native import authority

The exported artifact MUST retain compiled application and Hex dependency bytes,
module inventory, native phase evidence, and attributable generated tests.
Library exports MUST implement the exact locked Elixir import surface and pass
native import observation plus separately authored independent acceptance.

#### Scenario: Consume a retained library

- **WHEN** a current consumer imports an admitted compiled Mix library
- **THEN** it uses the exact retained provider and dependency trees
- **AND** conflicting application names, versions, or bytes reject consumption
- **AND** source retirement does not prevent authorized execution or bounded evidence reopening
