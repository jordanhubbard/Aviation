---
namespace: aviation
version: 0.1.0
display_name: Aviation weather
profiles:
  - library
  - portable
sample: false
provides:
  - name: aviation.weather
    version: 0.1.0
    interface:
      uri: interfaces/weather.md
      pin: null
requires: []
authoring_inputs:
  - kind: specification-to-source-skill
    uri: skills/specification-to-source/portable-application-implementation/SKILL.md
  - kind: specification-to-source-skill
    uri: skills/specification-to-source/portable-specification-planning/SKILL.md
workflow_definition:
  uri: workflows/production/staging/dev/workflow.md
routing_policy:
  uri: routing/production/staging/dev/routing.json
flavor_slots: []
entrypoints: []
acceptance_contracts:
  - kind: acceptance-contract
    uri: acceptance/weather.md
source_dependencies: []
---
# Aviation weather

This Component owns provider-neutral aviation-weather observations, METAR parsing,
flight-category classification, operational warnings, forecast normalization, and
departure-window scoring. It also owns adapters for the established Aviation Weather,
Open-Meteo, and OpenWeatherMap providers. It does not own airport identity, route
planning, aircraft-specific limitations, application presentation, or pilot-in-command
decision making.

The public surface is defined by `interfaces/weather.md`. Every language binding must
pass `acceptance/weather.md` against `acceptance/vectors.json`.

### Requirement: Applications consume one weather capability

Applications SHALL use `aviation.weather` for METAR parsing, provider access,
flight-category classification, warnings, and forecast scoring. Application-private
code MAY combine weather with routes, aircraft limitations, or presentation, but SHALL
NOT retain independent implementations of the common algorithms or provider adapters.

#### Scenario: A flight planner requests current conditions

- **WHEN** the planner fetches and classifies airport weather
- **THEN** its private service layer delegates acquisition and interpretation to
  `aviation.weather`

### Requirement: Weather semantics are deterministic

Visibility SHALL use statute miles, wind speed SHALL use knots, ceiling SHALL use feet
AGL, temperature SHALL use degrees Fahrenheit where the public field is suffixed `_f`,
and flight categories SHALL be one of `VFR`, `MVFR`, `IFR`, `LIFR`, or `UNKNOWN`.
Missing observation values SHALL remain missing rather than becoming operationally
favorable defaults.

#### Scenario: Required category inputs are missing

- **WHEN** visibility or ceiling is absent
- **THEN** classification returns `UNKNOWN`

### Requirement: Provider access is bounded and cacheable

Provider adapters SHALL use bounded timeouts, normalize station identifiers, reject
provider error responses, and support finite-TTL caching with stale-on-error behavior
where an earlier successful observation exists.

#### Scenario: A provider is temporarily unavailable

- **WHEN** a cached value has expired and refresh fails
- **THEN** an adapter configured for stale fallback may return the last successful value

### Requirement: Independent acceptance owns parity

TypeScript and Python realizations SHALL execute the same Component-owned synthetic
vectors. Network access and provider credentials SHALL NOT be required by acceptance.

#### Scenario: A parser changes

- **WHEN** its normalized output diverges from a shared vector
- **THEN** common SDK CI fails before an application can mask the regression
